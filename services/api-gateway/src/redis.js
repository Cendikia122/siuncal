import crypto from "crypto";
import IORedis from "ioredis";

// Shared ioredis client for rate limiting and short-lived caching.
// Reuses the same connection settings as the BullMQ workers (REDIS_HOST/PORT/PASSWORD).
let client = null;

const redisConnectionOptions = (overrides = {}) => ({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT || 6379),
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  ...overrides
});

export const createRedisClient = (overrides = {}) => {
  const redis = new IORedis(redisConnectionOptions(overrides));
  redis.on("error", () => {
    // Swallow: rate limiting and caching fall back gracefully when Redis is down.
  });
  return redis;
};

export const getRedis = () => {
  if (client) return client;
  client = createRedisClient();
  return client;
};

export const checkRedisReady = async () => {
  const probe = createRedisClient({ lazyConnect: true });
  probe.on("error", () => {
    // The readiness caller reports the explicit ping/connect failure.
  });

  try {
    await probe.connect();
    await probe.ping();
    return { ok: true };
  } finally {
    probe.disconnect();
  }
};

export const publishToChannel = async (channel, message, { redis = getRedis() } = {}) => {
  try {
    const payload = typeof message === "string" ? message : JSON.stringify(message);
    await redis.publish(channel, payload);
    return true;
  } catch {
    return false;
  }
};

export const tryAcquireRedisLock = async (key, value, ttlMs, { redis = getRedis() } = {}) => {
  try {
    const result = await redis.set(key, value, "PX", ttlMs, "NX");
    return result === "OK";
  } catch {
    return null;
  }
};

const parsePubSubMessage = (rawMessage) => {
  if (typeof rawMessage !== "string") return rawMessage;
  try {
    return JSON.parse(rawMessage);
  } catch {
    return rawMessage;
  }
};

export const subscribeToChannel = async (channel, callback, { subscriber = createRedisClient({ lazyConnect: true }) } = {}) => {
  const handleMessage = (receivedChannel, rawMessage) => {
    if (receivedChannel !== channel) return;
    const message = parsePubSubMessage(rawMessage);
    void Promise.resolve(callback(message, { channel: receivedChannel, raw: rawMessage })).catch(() => {
      // Pub/sub callbacks are best-effort; do not crash the API process.
    });
  };

  subscriber.on("message", handleMessage);

  try {
    if (subscriber.status === "wait" && typeof subscriber.connect === "function") {
      await subscriber.connect();
    }
    await subscriber.subscribe(channel);
    return async () => {
      subscriber.off("message", handleMessage);
      try {
        await subscriber.unsubscribe(channel);
      } catch {
        // Already disconnected or Redis unavailable.
      }
      if (typeof subscriber.disconnect === "function") subscriber.disconnect();
    };
  } catch {
    subscriber.off("message", handleMessage);
    if (typeof subscriber.disconnect === "function") subscriber.disconnect();
    return async () => {};
  }
};

// --- Rate limiting (fixed window, atomic across instances) ---------------------
// In-memory fallback so per-instance protection survives a Redis outage.
const fallbackBuckets = new Map();
const fallbackConsume = (key, windowMs, max) => {
  const now = Date.now();
  const b = fallbackBuckets.get(key);
  if (!b || b.resetAt <= now) {
    fallbackBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { limited: false, retryAfterSec: 0 };
  }
  b.count += 1;
  if (b.count > max) return { limited: true, retryAfterSec: Math.max(1, Math.ceil((b.resetAt - now) / 1000)) };
  return { limited: false, retryAfterSec: 0 };
};

// Atomic INCR + PEXPIRE-on-first-hit, then read PTTL. One round trip.
const RL_SCRIPT =
  "local c=redis.call('INCR',KEYS[1]) " +
  "if c==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end " +
  "local t=redis.call('PTTL',KEYS[1]) return {c,t}";

export const rlConsume = async (key, windowMs, max) => {
  try {
    const res = await getRedis().eval(RL_SCRIPT, 1, `rl:${key}`, String(windowMs));
    const count = Number(res[0]);
    const ttl = Number(res[1]);
    if (count > max) return { limited: true, retryAfterSec: Math.max(1, Math.ceil(ttl / 1000)) };
    return { limited: false, retryAfterSec: 0 };
  } catch {
    return fallbackConsume(key, windowMs, max);
  }
};

// --- Metric counters ------------------------------------------------------------
// Redis-backed when available, with process-local fallback during Redis outages.
const fallbackCounters = new Map();
const fallbackMetricEvents = new Map();

export const incrementMetricCounter = async (key) => {
  try {
    return Number(await getRedis().incr(`metric:${key}`));
  } catch {
    const next = (fallbackCounters.get(key) || 0) + 1;
    fallbackCounters.set(key, next);
    return next;
  }
};

export const getMetricCounter = async (key) => {
  try {
    return Number(await getRedis().get(`metric:${key}`) || 0);
  } catch {
    return fallbackCounters.get(key) || 0;
  }
};

const pruneFallbackMetricEvents = (key, now, windowMs) => {
  const cutoff = now - windowMs;
  const events = (fallbackMetricEvents.get(key) || []).filter((ts) => ts >= cutoff);
  fallbackMetricEvents.set(key, events);
  return events;
};

export const recordRollingMetricEvent = async (key, { windowMs }) => {
  const now = Date.now();
  const redisKey = `metric:${key}:events`;
  const member = `${now}:${crypto.randomUUID()}`;

  try {
    const result = await getRedis()
      .multi()
      .zadd(redisKey, now, member)
      .zremrangebyscore(redisKey, 0, now - windowMs)
      .pexpire(redisKey, windowMs * 2)
      .zcard(redisKey)
      .exec();
    return Number(result?.[3]?.[1] || 0);
  } catch {
    const events = pruneFallbackMetricEvents(key, now, windowMs);
    events.push(now);
    fallbackMetricEvents.set(key, events);
    return events.length;
  }
};

export const getRollingMetricCount = async (key, { windowMs }) => {
  const now = Date.now();
  const redisKey = `metric:${key}:events`;

  try {
    const result = await getRedis()
      .multi()
      .zremrangebyscore(redisKey, 0, now - windowMs)
      .pexpire(redisKey, windowMs * 2)
      .zcard(redisKey)
      .exec();
    return Number(result?.[2]?.[1] || 0);
  } catch {
    return pruneFallbackMetricEvents(key, now, windowMs).length;
  }
};

// --- Short-lived cache (e.g. /public/vehicles) ---------------------------------
export const cacheGetJson = async (key) => {
  try {
    const raw = await getRedis().get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const cacheSetJson = async (key, value, ttlSeconds) => {
  try {
    await getRedis().set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch {
    // Cache is best-effort; ignore failures.
  }
};

// Prune expired fallback buckets so the Map can't grow unbounded during an outage.
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of fallbackBuckets) if (b.resetAt <= now) fallbackBuckets.delete(k);
  for (const [k, events] of fallbackMetricEvents) {
    const fresh = events.filter((ts) => ts > now - 24 * 60 * 60 * 1000);
    if (fresh.length) fallbackMetricEvents.set(k, fresh);
    else fallbackMetricEvents.delete(k);
  }
}, 60000).unref();
