import http from "http";
import net from "net";
import cors from "cors";
import crypto from "crypto";
import dotenv from "dotenv";
import express from "express";
import jwt from "jsonwebtoken";
import multer from "multer";
import { z } from "zod";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import WebSocket, { WebSocketServer } from "ws";
import { pool, query } from "./db.js";
import {
  checkRedisReady,
  rlConsume,
  cacheGetJson,
  cacheSetJson,
  getRollingMetricCount,
  publishToChannel,
  recordRollingMetricEvent,
  subscribeToChannel,
  tryAcquireRedisLock
} from "./redis.js";
import {
  checkObjectStorageReady,
  getObjectBuffer,
  getPublicReportBucket,
  isObjectStorageConfigured,
  putBufferObject,
  putJsonObject
} from "./object-storage.js";
import {
  enqueuePublicReportReviewBatch,
  startPublicReportReviewWorker
} from "./public-report-review.js";
import {
  enqueuePublicReportEvidenceProcessing,
  getPublicReportEvidenceProcessingSummary,
  recordPublicReportEvidenceEnqueueFailure,
  startPublicReportEvidenceWorker
} from "./public-report-evidence.js";
import {
  enqueueHeatmapGeneration,
  startHeatmapWorker
} from "./heatmap-worker.js";
import { ingestVehicleTelemetry } from "./telemetry-intake.js";
import {
  getTelemetryQualityReport,
  renderTelemetryQualityCsv
} from "./telemetry-quality.js";
import { buildDeviceTamperCandidate } from "./device-tamper.js";
import {
  DEVICE_TAMPER_METRIC_WINDOW_MS,
  telemetryIdentityMetricKey
} from "./telemetry-quality-metrics.js";
import {
  publicReportExtByMime,
  publicReportMimeTypes,
  validatePublicReportEvidenceImage
} from "./image-validation.js";
import {
  validate,
  loginSchema,
  mobileLoginSchema,
  mobileRegisterSchema,
  mobileTokenSchema,
  mobileRefreshSchema,
  trackingConsentSchema,
  ownerSchema,
  vehicleSchema,
  driverSchema,
  deviceSchema,
  geofenceSchema,
  publicReportSchema,
  vehicleTelemetrySchema,
  passengerTelemetrySchema,
  sosEmergencySchema,
  driverPanicSchema,
} from "./validation.js";
import {
  createRealtimeFilters,
  createRealtimePayloads,
  filterRealtimeIncidents,
  parseRealtimeBbox,
  realtimePassengerScopeKey,
  realtimeVehicleScopeKey
} from "./realtime-feed.js";
import { createRealtimeBroadcaster } from "./realtime-broadcaster.js";
import { createRealtimeConnectionHandler } from "./realtime-connection.js";
import {
  createOwnerListScope,
  createVehicleListScope,
  stripTotalCount
} from "./dashboard-list-scope.js";
import { createReadinessChecker } from "./readiness-checks.js";
import { createRealtimeQueries } from "./realtime-queries.js";
import { createPassengerLocationAccess } from "./passenger-location-access.js";
import {
  buildEmergencyIncident,
  deriveEmergencyEscalation
} from "./emergency-response.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const app = express();
// Behind the reverse proxy (Caddy), trust the first proxy hop so req.ip reflects
// the real client IP (X-Forwarded-For) — required for correct per-IP rate limiting.
// TRUST_PROXY_HOPS=0 disables it for direct exposure. See docs/runbooks/security-hardening.md.
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);
if (trustProxyHops > 0) app.set("trust proxy", trustProxyHops);
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:3000").split(",").map((origin) => origin.trim());
// --- HIGH-05: Validate CORS origins, reject wildcard with credentials ---
if (corsOrigins.includes("*")) {
  console.warn("⚠ WARNING: CORS_ORIGINS contains '*'. This is insecure with credentials:true. Falling back to localhost.");
}
const safeCorsOrigins = corsOrigins.filter((o) => o !== "*");
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (safeCorsOrigins.includes(origin)) return callback(null, true);
    if (/^https:\/\/.*\.vercel\.app$/.test(origin)) return callback(null, true);
    if (/^http:\/\/localhost(:\d+)?$/.test(origin) || /^http:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS: " + origin));
  },
  credentials: true,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "X-Passenger-Tracking-Token",
    "x-csrf-token",
    "ngrok-skip-browser-warning"
  ]
}));
app.use(express.json({ limit: "1mb" }));

// --- HIGH-07: Security headers ---
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org; connect-src 'self' ws: wss:; frame-ancestors 'none'");
  next();
});

// --- CRIT-01: JWT secret harus dikonfigurasi, tidak ada fallback ---
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging") {
    throw new Error("FATAL: JWT_SECRET environment variable is required");
  }
  console.warn("⚠ WARNING: JWT_SECRET not set. Using random ephemeral secret (dev only). Tokens will NOT survive restarts.");
}
const jwtSecret = process.env.JWT_SECRET || crypto.randomBytes(64).toString("base64url");

const realtimeIntervalMs = Number(process.env.REALTIME_INTERVAL_MS || 5000);
const accessTokenTtl = process.env.ACCESS_TOKEN_TTL || "15m";
const accessTokenTtlSeconds = accessTokenTtl.endsWith("m") ? parseInt(accessTokenTtl) * 60 : accessTokenTtl.endsWith("h") ? parseInt(accessTokenTtl) * 3600 : 900;
const refreshTokenTtlDays = Number(process.env.REFRESH_TOKEN_TTL_DAYS || 14);
const cookieSecure = process.env.COOKIE_SECURE === "true";
const cookieSameSite = process.env.COOKIE_SAMESITE || "Lax";
const deviceOfflineMinutes = Number(process.env.DEVICE_OFFLINE_MINUTES || 10);
const deviceTamperImpossibleSpeedKmh = Number(process.env.DEVICE_TAMPER_IMPOSSIBLE_SPEED_KMH || 140);
const deviceTamperIdentityMismatchThreshold = Number(process.env.DEVICE_TAMPER_IDENTITY_MISMATCH_THRESHOLD || 3);
const slaAckMinutes = Number(process.env.SLA_ACK_MINUTES || 5);
const slaResolveMinutes = Number(process.env.SLA_RESOLVE_MINUTES || 30);
const playbackMaxRangeHours = Number(process.env.PLAYBACK_MAX_RANGE_HOURS || 24);
const playbackMaxPoints = Number(process.env.PLAYBACK_MAX_POINTS || 5000);
const telemetryRateLimitWindowMs = Number(process.env.TELEMETRY_RATE_LIMIT_WINDOW_MS || 60000);
const telemetryRateLimitMax = Number(process.env.TELEMETRY_RATE_LIMIT_MAX || 120);
const telemetryIpRateLimitMax = Number(process.env.TELEMETRY_IP_RATE_LIMIT_MAX || Math.max(telemetryRateLimitMax * 50, 1000));
const realtimeVehiclesLimit = Number(process.env.REALTIME_VEHICLES_LIMIT || 1000);
const realtimePassengersLimit = Number(process.env.REALTIME_PASSENGERS_LIMIT || 500);
const passengerLocationRequireScopeForOperator = process.env.PASSENGER_LOCATION_REQUIRE_SCOPE_FOR_OPERATOR === "true";
const passengerLocationMaskOperatorIdentity = process.env.PASSENGER_LOCATION_MASK_OPERATOR_IDENTITY !== "false";
const telemetryIngestToken = process.env.TELEMETRY_INGEST_TOKEN || "";
const telemetryHmacSecret = process.env.TELEMETRY_HMAC_SECRET || "";
// --- MED-01: Global rate limiting config ---
const globalRateLimitWindowMs = Number(process.env.GLOBAL_RATE_LIMIT_WINDOW_MS || 60000);
const globalRateLimitMax = Number(process.env.GLOBAL_RATE_LIMIT_MAX || 100);
const loginRateLimitWindowMs = Number(process.env.LOGIN_RATE_LIMIT_WINDOW_MS || 900000);
const loginRateLimitMax = Number(process.env.LOGIN_RATE_LIMIT_MAX || 10);
const publicTrackingRateLimitWindowMs = Number(process.env.PUBLIC_TRACKING_RATE_LIMIT_WINDOW_MS || 60000);
const publicTrackingRateLimitMax = Number(process.env.PUBLIC_TRACKING_RATE_LIMIT_MAX || 600);
const redisHealthUrl = process.env.REDIS_HEALTH_URL || "";
const rulesEngineHealthUrl = process.env.RULES_ENGINE_HEALTH_URL || "";
const notificationServiceHealthUrl = process.env.NOTIFICATION_SERVICE_HEALTH_URL || "";
const serviceHealthTimeoutMs = Number(process.env.SERVICE_HEALTH_TIMEOUT_MS || 1500);
const realtimeNotificationWindowMs = Number(process.env.REALTIME_NOTIFICATION_WINDOW_MS || 5 * 60 * 1000);
const publicReportRateLimitWindowMs = Number(process.env.PUBLIC_REPORT_RATE_LIMIT_WINDOW_MS || 10 * 60 * 1000);
const publicReportRateLimitMax = Number(process.env.PUBLIC_REPORT_RATE_LIMIT_MAX || 5);
const emergencySosRateLimitWindowMs = Number(process.env.EMERGENCY_SOS_RATE_LIMIT_WINDOW_MS || 5 * 60 * 1000);
const emergencySosRateLimitMax = Number(process.env.EMERGENCY_SOS_RATE_LIMIT_MAX || 3);
const emergencyDuplicateWindowMinutes = Number(process.env.EMERGENCY_DUPLICATE_WINDOW_MINUTES || 5);
const emergencyAckSlaSeconds = Number(process.env.EMERGENCY_ACK_SLA_SECONDS || 60);
const emergencyAssignmentSlaSeconds = Number(process.env.EMERGENCY_ASSIGNMENT_SLA_SECONDS || 180);
const publicReportMaxAttachmentMb = Number(process.env.PUBLIC_REPORT_MAX_ATTACHMENT_MB || 5);
const publicReportMaxAttachments = Number(process.env.PUBLIC_REPORT_MAX_ATTACHMENTS || 3);
const passengerTrackingTokenTtlDays = Number(process.env.PASSENGER_TRACKING_TOKEN_TTL_DAYS || 30);
const mobileRefreshTokenTtlDays = Number(process.env.MOBILE_REFRESH_TOKEN_TTL_DAYS || 30);
const mobileVerificationTtlMinutes = Number(process.env.MOBILE_VERIFICATION_TTL_MINUTES || 30);
const mobileResetTtlMinutes = Number(process.env.MOBILE_RESET_TTL_MINUTES || 30);

const checkReadiness = createReadinessChecker({
  query,
  checkRedisReady,
  checkObjectStorageReady
});

if (["production", "staging"].includes(process.env.NODE_ENV)) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev-secret") {
    throw new Error("FATAL: JWT_SECRET must be set to a strong, non-default value in production/staging");
  }
  if (process.env.JWT_SECRET.length < 32) {
    throw new Error("FATAL: JWT_SECRET must be at least 32 characters long");
  }
  if (!cookieSecure) {
    console.warn("⚠ WARNING: COOKIE_SECURE is false in production. Cookies may be sent over HTTP.");
  }
}

const asyncHandler = (handler) => async (req, res, next) => {
  try {
    await handler(req, res, next);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Unexpected server error" } });
  }
};

const parseBoundedInt = (value, defaultValue, { min = 1, max = 200 } = {}) => {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.floor(parsed), min), max);
};

const {
  fetchLatestVehicles,
  fetchOpenIncidents
} = createRealtimeQueries({
  query,
  parseBoundedInt,
  realtimeVehiclesLimit
});

const {
  getPassengerLocationAccessPolicy,
  serializePassengerForPrincipal
} = createPassengerLocationAccess({
  requireScopedOperatorAccess: passengerLocationRequireScopeForOperator,
  maskOperatorIdentity: passengerLocationMaskOperatorIdentity
});

app.use((req, res, next) => {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  res.setHeader("x-request-id", requestId);
  res.on("finish", () => {
    const payload = {
      ts: new Date().toISOString(),
      request_id: requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      duration_ms: Date.now() - started,
      user_id: req.user?.user_id || null
    };
    console.log(JSON.stringify(payload));
  });
  next();
});

const signToken = (user) =>
  jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      full_name: user.full_name,
      roles: user.roles
    },
    jwtSecret,
    { expiresIn: accessTokenTtl }
  );

const parseCookies = (header = "") =>
  header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});

const setCookie = (res, name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  parts.push(`Path=${options.path || "/"}`);

  const existing = res.getHeader("Set-Cookie");
  const next = Array.isArray(existing) ? [...existing, parts.join("; ")] : existing ? [existing, parts.join("; ")] : [parts.join("; ")];
  res.setHeader("Set-Cookie", next);
};

const clearCookie = (res, name) => {
  setCookie(res, name, "", { maxAge: 0, path: "/" });
};

const hashToken = (token) => crypto.createHash("sha256").update(token).digest("hex");

const issueRefreshToken = async (userId) => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + refreshTokenTtlDays * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING token_id`,
    [userId, tokenHash, expiresAt]
  );
  return { token: raw, tokenId: rows[0].token_id, expiresAt };
};

const issuePassengerTrackingToken = async ({ userId, userAgent }) => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + passengerTrackingTokenTtlDays * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    `INSERT INTO passenger_tracking_tokens (user_id, token_hash, expires_at, user_agent)
     VALUES ($1, $2, $3, $4)
     RETURNING token_id, session_id, expires_at`,
    [userId, tokenHash, expiresAt, userAgent || null]
  );
  return {
    token: raw,
    tokenId: rows[0].token_id,
    sessionId: rows[0].session_id,
    expiresAt: rows[0].expires_at
  };
};

const issueMobileRefreshToken = async (userId) => {
  const raw = crypto.randomBytes(48).toString("base64url");
  const expiresAt = new Date(Date.now() + mobileRefreshTokenTtlDays * 24 * 60 * 60 * 1000);
  const { rows } = await query(
    `INSERT INTO mobile_refresh_tokens (user_id, token_hash, expires_at)
     VALUES ($1, $2, $3)
     RETURNING token_id, expires_at`,
    [userId, hashToken(raw), expiresAt]
  );
  return { token: raw, tokenId: rows[0].token_id, expiresAt: rows[0].expires_at };
};

const issueAccountToken = async ({ table, userId, ttlMinutes }) => {
  const raw = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await query(
    `INSERT INTO ${table} (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashToken(raw), expiresAt]
  );
  return raw;
};

const enqueueAccountEmail = async ({ recipient, template, token }) => {
  await query(
    `INSERT INTO account_email_outbox (recipient, template, payload)
     VALUES ($1, $2, $3)`,
    [recipient, template, JSON.stringify({ token })]
  );
};

const mobileSessionPayload = async (user, refresh = null) => {
  const mobileRefresh = refresh || await issueMobileRefreshToken(user.user_id);
  return {
    user,
    access_token: signToken(user),
    refresh_token: mobileRefresh.token,
    refresh_expires_at: mobileRefresh.expiresAt,
    tracking_consent_required: true
  };
};

const setAuthCookies = async (res, user) => {
  const accessToken = signToken(user);
  const refresh = await issueRefreshToken(user.user_id);
  const csrfToken = crypto.randomBytes(24).toString("base64url");

  // --- LOW-04: Set maxAge on cookies to match token TTL ---
  setCookie(res, "sentra_access", accessToken, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/",
    maxAge: accessTokenTtlSeconds
  });
  setCookie(res, "sentra_refresh", refresh.token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/",
    maxAge: refreshTokenTtlDays * 24 * 60 * 60
  });
  setCookie(res, "sentra_csrf", csrfToken, {
    httpOnly: false,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/",
    maxAge: accessTokenTtlSeconds
  });

  return { accessToken, refreshToken: refresh.token };
};

const auditLog = async (req, { action, entityType, entityId, metadata }) => {
  if (!req.user) return;
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        req.user.user_id,
        action,
        entityType || null,
        entityId ? String(entityId) : null,
        metadata ? JSON.stringify(metadata) : null,
        req.ip || null,
        req.headers["user-agent"] || null
      ]
    );
  } catch (error) {
    if (error?.code !== "42P01") throw error;
    console.warn("audit_logs table missing; skipping audit log write");
  }
};

const auditUserEvent = async (req, userId, action, metadata) => {
  try {
    await query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip, user_agent)
       VALUES ($1::uuid, $2, 'user', $1::text, $3, $4, $5)`,
      [
        userId,
        action,
        metadata ? JSON.stringify(metadata) : null,
        req.ip || null,
        req.headers["user-agent"] || null
      ]
    );
  } catch (error) {
    if (error?.code !== "42P01") throw error;
  }
};

const parseDateParam = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const getPlaybackWindow = (queryParams) => {
  const rawStart = queryParams.start || queryParams.from;
  const rawEnd = queryParams.end || queryParams.to;
  const start = rawStart ? parseDateParam(rawStart) : new Date(Date.now() - 2 * 60 * 60 * 1000);
  const end = rawEnd ? parseDateParam(rawEnd) : new Date();

  if (!start || !end) {
    return { error: "Parameter start/end harus berupa timestamp ISO-8601 yang valid." };
  }
  if (start >= end) {
    return { error: "Parameter start harus lebih awal dari end." };
  }

  const maxRangeMs = playbackMaxRangeHours * 60 * 60 * 1000;
  if (end.getTime() - start.getTime() > maxRangeMs) {
    return { error: `Range playback maksimum ${playbackMaxRangeHours} jam.` };
  }

  return { start, end };
};

const getPlaybackLimit = (queryParams) => {
  const requested = Number(queryParams.limit || playbackMaxPoints);
  if (!Number.isFinite(requested) || requested <= 0) return playbackMaxPoints;
  return Math.min(Math.floor(requested), playbackMaxPoints);
};

const loadVehiclePlayback = async ({ vehicleId, start, end, limit }) => {
  const positionsResult = await query(
    `SELECT
        vp.ts,
        vp.lat,
        vp.lon,
        vp.speed_kmh::float AS speed,
        vp.speed_kmh::float AS speed_kmh,
        vp.heading::float AS heading,
        vp.status,
        mp.provider AS match_provider,
        mp.match_status,
        mp.road_segment,
        mp.confidence::float AS match_confidence,
        mp.snapped_lat,
        mp.snapped_lon,
        mp.snap_distance_m::float AS snap_distance_m,
        mp.distance_along_route_m::float AS distance_along_route_m,
        mp.matched_heading::float AS matched_heading
     FROM vehicle_positions vp
     LEFT JOIN telemetry_matched_positions mp
       ON mp.vehicle_id = vp.vehicle_id
      AND mp.ts = vp.ts
      AND mp.position_id = vp.position_id
     WHERE vp.vehicle_id = $1
       AND vp.ts >= $2
       AND vp.ts <= $3
     ORDER BY vp.ts
     LIMIT $4`,
    [vehicleId, start, end, limit + 1]
  );

  const truncated = positionsResult.rows.length > limit;
  const positions = truncated ? positionsResult.rows.slice(0, limit) : positionsResult.rows;

  const eventsResult = await query(
    `SELECT
        incident_id AS event_id,
        type,
        severity,
        status,
        description,
        location_desc,
        lat,
        lon,
        created_at AS ts_start,
        resolved_at AS ts_end
     FROM incidents
     WHERE vehicle_id = $1
       AND created_at >= $2
       AND created_at <= $3
     ORDER BY created_at DESC
     LIMIT 100`,
    [vehicleId, start, end]
  );

  return {
    vehicle_id: vehicleId,
    start: start.toISOString(),
    end: end.toISOString(),
    limit,
    truncated,
    positions,
    points: positions,
    events: eventsResult.rows
  };
};

const csrfGuard = (req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  if (req.authSource === "header") return next();
  const cookies = parseCookies(req.headers.cookie || "");
  const csrfCookie = cookies.sentra_csrf;
  const csrfHeader = req.headers["x-csrf-token"];
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return res.status(403).json({ error: { code: "CSRF_ERROR", message: "Invalid CSRF token" } });
  }
  return next();
};

const auth = async (req, res, next) => {
  const header = req.headers.authorization || "";
  const cookies = parseCookies(req.headers.cookie || "");
  const token = header.startsWith("Bearer ") ? header.replace("Bearer ", "") : cookies.sentra_access;
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing token" } });
  }

  try {
    req.user = jwt.verify(token, jwtSecret);
    const { rows } = await query(
      "SELECT is_active FROM users WHERE user_id = $1",
      [req.user.user_id]
    );
    if (!rows.length || !rows[0].is_active) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Inactive account" } });
    }
    req.authSource = header.startsWith("Bearer ") ? "header" : "cookie";
    return csrfGuard(req, res, next);
  } catch (error) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid token" } });
  }
};

const requireRole = (roles) => (req, res, next) => {
  const userRoles = req.user?.roles || [];
  const allowed = roles.some((role) => userRoles.includes(role));
  if (!allowed) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Insufficient role" } });
  }
  return next();
};

const hasRole = (req, role) => (req.user?.roles || []).includes(role);
const requireOperatorDashboardRole = requireRole(["OPERATOR", "ANALISA"]);

const requiredDemoTables = [
  "anomalies",
  "alerts",
  "audit_logs",
  "account_email_outbox",
  "collective_anomalies",
  "email_verification_tokens",
  "heatmap_data",
  "incident_actions",
  "incidents",
  "passenger_current_positions",
  "passenger_latest",
  "passenger_positions",
  "passenger_tracking_consents",
  "mobile_refresh_tokens",
  "password_reset_tokens",
  "public_report_attachments",
  "public_report_evidence_processing",
  "public_report_reviews",
  "public_reports",
  "report_kpi_daily",
  "report_rit_daily",
  "sanction_actions",
  "sanctions",
  "telemetry_matched_positions",
  "vehicle_current_positions",
  "vehicle_latest",
  "vehicle_positions"
];

const requiredDemoColumns = [
  ["incidents", "reporter_user_id"],
  ["incidents", "reporter_session_id"],
  ["incidents", "source"],
  ["incidents", "emergency_category"],
  ["incidents", "trust_level"],
  ["incidents", "escalation_state"],
  ["incidents", "ack_due_at"],
  ["incidents", "assignment_due_at"],
  ["incidents", "escalation_target"],
  ["incidents", "escalation_last_at"],
  ["incident_actions", "metadata"]
];

const verifyRequiredSchema = async () => {
  const { rows: missingTableRows } = await query(
    `SELECT name
     FROM unnest($1::text[]) AS required(name)
     WHERE to_regclass(('public.' || required.name)::text) IS NULL
     ORDER BY name`,
    [requiredDemoTables]
  );
  const { rows: missingColumnRows } = await query(
    `SELECT required.table_name, required.column_name
     FROM unnest($1::text[], $2::text[]) AS required(table_name, column_name)
     WHERE NOT EXISTS (
       SELECT 1
       FROM information_schema.columns columns
       WHERE columns.table_schema = 'public'
         AND columns.table_name = required.table_name
         AND columns.column_name = required.column_name
     )
     ORDER BY required.table_name, required.column_name`,
    [
      requiredDemoColumns.map(([tableName]) => tableName),
      requiredDemoColumns.map(([, columnName]) => columnName)
    ]
  );

  if (missingTableRows.length > 0 || missingColumnRows.length > 0) {
    const missingTables = missingTableRows.map((row) => row.name);
    const missingColumns = missingColumnRows.map((row) => `${row.table_name}.${row.column_name}`);
    const missing = [...missingTables, ...missingColumns].join(", ");
    throw new Error(
      `Database schema is missing required demo objects: ${missing}. ` +
      "For reused Docker volumes, apply db/migrations/001_init.sql through 022_phase19_emergency_response.sql and seeds via infra/docker-compose/initdb/001_bootstrap.sql. " +
      "For Phase 19 emergency drift, run ./scripts/apply-phase19-emergency-runtime.sh."
    );
  }
};

// --- MED-01: Rate limiting (Redis-backed via redis.js; consistent across instances, in-memory fallback on Redis outage) ---
const createRateLimiter = (windowMs, maxRequests, keyFn) => async (req, res, next) => {
  try {
    const { limited, retryAfterSec } = await rlConsume(keyFn(req), windowMs, maxRequests);
    if (limited) {
      res.setHeader("Retry-After", retryAfterSec);
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } });
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

const globalRateLimit = createRateLimiter(globalRateLimitWindowMs, globalRateLimitMax, (req) => `global:${req.ip || req.socket.remoteAddress || "unknown"}`);
const loginRateLimit = createRateLimiter(loginRateLimitWindowMs, loginRateLimitMax, (req) => `login:${req.ip || req.socket.remoteAddress || "unknown"}`);
const rateLimitPublicTracking = createRateLimiter(
  publicTrackingRateLimitWindowMs,
  publicTrackingRateLimitMax,
  (req) => `public-tracking:${req.ip || req.socket.remoteAddress || "unknown"}`
);

const isPublicTrackingRead = (req) =>
  req.method === "GET" && (req.path === "/public/vehicles" || req.path.startsWith("/public/vehicles/"));
const isTelemetryWrite = (req) =>
  req.method === "POST" && (req.path === "/telemetry/vehicle" || req.path === "/telemetry/passenger");

app.use((req, res, next) => {
  if (isPublicTrackingRead(req) || isTelemetryWrite(req)) return next();
  return globalRateLimit(req, res, next);
});

const createIpRateLimiter = ({ windowMs, max, message, prefix }) => async (req, res, next) => {
  try {
    const userKey = req.user?.user_id || "anonymous";
    const key = `${prefix}:${userKey}:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
    const { limited } = await rlConsume(key, windowMs, max);
    if (limited) return res.status(429).json({ error: { code: "RATE_LIMITED", message } });
    return next();
  } catch (err) {
    return next(err);
  }
};

const rateLimitPublicReports = createIpRateLimiter({
  windowMs: publicReportRateLimitWindowMs,
  max: publicReportRateLimitMax,
  message: "Public report rate limit exceeded",
  prefix: "public-report"
});

const rateLimitEmergencySos = createIpRateLimiter({
  windowMs: emergencySosRateLimitWindowMs,
  max: emergencySosRateLimitMax,
  message: "Emergency SOS rate limit exceeded",
  prefix: "emergency-sos"
});

const limiterHash = (value) => crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 32);
const compactTelemetryIdentity = (value) => String(value || "").replace(/\s+/g, " ").trim().toUpperCase();

const telemetryIdentityKey = (req) => {
  const body = req.body || {};
  if (req.path === "/telemetry/passenger") {
    const sessionId = compactTelemetryIdentity(body.session_id || req.passengerTracking?.session_id);
    if (sessionId) return `passenger-session:${sessionId}`;
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const token = req.headers["x-passenger-tracking-token"] || bearer;
    if (token) return `passenger-token:${limiterHash(token)}`;
  }

  const deviceIdentity = compactTelemetryIdentity(
    body.vehicle_id
    || body.plate_no
    || body.device_id
    || body.imei_or_serial
    || body.device?.device_id
    || body.device?.imei_or_serial
  );
  if (deviceIdentity) return `vehicle-device:${deviceIdentity}`;

  const telemetryToken = req.headers["x-telemetry-token"] || (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (telemetryToken) return `vehicle-token:${limiterHash(telemetryToken)}`;
  return `unknown:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
};

const rateLimitTelemetry = async (req, res, next) => {
  try {
    const ipKey = `telemetry-ip:${req.ip || req.headers["x-forwarded-for"] || "unknown"}`;
    const ipResult = await rlConsume(ipKey, telemetryRateLimitWindowMs, telemetryIpRateLimitMax);
    if (ipResult.limited) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Telemetry gateway rate limit exceeded" } });
    }

    const identityKey = `telemetry-identity:${telemetryIdentityKey(req)}`;
    const identityResult = await rlConsume(identityKey, telemetryRateLimitWindowMs, telemetryRateLimitMax);
    if (identityResult.limited) {
      return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Telemetry identity rate limit exceeded" } });
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

const verifyTelemetryAuth = (req, res, next) => {
  // --- CRIT-02: Reject requests when NO auth method is configured ---
  if (!telemetryIngestToken && !telemetryHmacSecret) {
    console.error("SECURITY: Telemetry auth not configured. Set TELEMETRY_INGEST_TOKEN or TELEMETRY_HMAC_SECRET.");
    return res.status(503).json({ error: { code: "AUTH_NOT_CONFIGURED", message: "Telemetry authentication is not configured on this server" } });
  }

  if (telemetryIngestToken) {
    const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const provided = req.headers["x-telemetry-token"] || bearer;
    if (provided !== telemetryIngestToken) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid telemetry token" } });
    }
    return next();
  }

  if (telemetryHmacSecret) {
    const signature = req.headers["x-telemetry-signature"];
    const timestamp = req.headers["x-telemetry-timestamp"];
    if (!signature || !timestamp) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing telemetry signature" } });
    }

    const timestampMs = new Date(timestamp).getTime();
    if (!Number.isFinite(timestampMs) || Math.abs(Date.now() - timestampMs) > 5 * 60 * 1000) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid telemetry timestamp" } });
    }

    const body = JSON.stringify(req.body || {});
    const expected = crypto.createHmac("sha256", telemetryHmacSecret).update(`${timestamp}.${body}`).digest("hex");
    const normalizedSignature = String(signature).replace(/^sha256=/i, "");
    const expectedBuffer = Buffer.from(expected, "hex");
    const providedBuffer = Buffer.from(normalizedSignature, "hex");
    if (expectedBuffer.length !== providedBuffer.length || !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid telemetry signature" } });
    }
    return next();
  }

  return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "No valid authentication provided" } });
};

const passengerTrackingAuth = asyncHandler(async (req, res, next) => {
  const bearer = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const rawToken = req.headers["x-passenger-tracking-token"] || bearer;
  if (!rawToken) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing passenger tracking token" } });
  }

  const { rows } = await query(
    `SELECT
        ptt.token_id,
        ptt.user_id,
        ptt.session_id,
        ptt.expires_at,
        u.email,
        u.full_name,
        u.roles,
        u.is_active
     FROM passenger_tracking_tokens ptt
     JOIN users u ON u.user_id = ptt.user_id
     WHERE ptt.token_hash = $1
       AND ptt.revoked_at IS NULL
     LIMIT 1`,
    [hashToken(String(rawToken))]
  );

  const token = rows[0];
  if (!token || !token.is_active || !Array.isArray(token.roles) || !token.roles.includes("PUBLIC_USER")) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid passenger tracking token" } });
  }
  if (new Date(token.expires_at).getTime() <= Date.now()) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Passenger tracking token expired" } });
  }

  req.passengerTracking = token;
  return next();
});

const publicReportCategories = new Set(["NGETEM", "RECKLESS_DRIVING", "SECURITY", "SERVICE", "OTHER"]);
const publicReportStatuses = new Set(["PENDING_REVIEW", "ACKNOWLEDGED", "REJECTED", "ESCALATED_TO_INCIDENT", "RESOLVED"]);
const publicReportActions = new Set(["ACKNOWLEDGE", "REJECT", "ESCALATE_TO_INCIDENT", "RESOLVE"]);
const PUBLIC_REPORT_INVALID_IMAGE_REJECTIONS_METRIC = "public_report_invalid_image_rejections";
const PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_MS = 24 * 60 * 60 * 1000;
const PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_HOURS = PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_MS / (60 * 60 * 1000);
const publicReportInvalidImageWarningThreshold = parseBoundedInt(process.env.PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WARNING_THRESHOLD, 10, { max: 1_000_000 });
const publicReportInvalidImageErrorThreshold = Math.max(
  publicReportInvalidImageWarningThreshold,
  parseBoundedInt(process.env.PUBLIC_REPORT_INVALID_IMAGE_REJECTION_ERROR_THRESHOLD, 50, { max: 1_000_000 })
);

const recordInvalidPublicReportImageRejection = (reason) => {
  void recordRollingMetricEvent(PUBLIC_REPORT_INVALID_IMAGE_REJECTIONS_METRIC, {
    windowMs: PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_MS
  });
  console.warn(JSON.stringify({
    ts: new Date().toISOString(),
    event: "public_report_invalid_image_rejected",
    reason
  }));
};

const fetchLatestPassengers = async ({ activeWithinMinutes = 15, bbox = null, routeId = null, limit = realtimePassengersLimit } = {}) => {
  const params = [activeWithinMinutes, routeId || null];
  const filters = ["pl.ts >= now() - ($1::int * interval '1 minute')"];
  if (bbox) {
    params.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
    const minLonParam = params.length - 3;
    filters.push(`pl.geom && ST_MakeEnvelope($${minLonParam}, $${minLonParam + 1}, $${minLonParam + 2}, $${minLonParam + 3}, 4326)`);
  }
  params.push(parseBoundedInt(limit, realtimePassengersLimit, { max: 5000 }));

  const { rows } = await query(
    `SELECT
        pl.user_id,
        pl.session_id,
        u.full_name AS name,
        u.email,
        NULL::text AS phone,
        NULL::text AS profile_photo_url,
        pl.lat,
        pl.lon,
        pl.accuracy,
        pl.ts AS last_seen_at,
        pl.app_state,
        nv.nearest_plate_no,
        nv.nearest_vehicle_distance_m::float AS nearest_vehicle_distance_m
     FROM passenger_latest pl
     JOIN users u ON u.user_id = pl.user_id
     LEFT JOIN LATERAL (
       SELECT
          v.plate_no AS nearest_plate_no,
          ST_DistanceSphere(pl.geom, vl.geom) AS nearest_vehicle_distance_m
       FROM vehicle_latest vl
       JOIN vehicles v ON v.vehicle_id = vl.vehicle_id
       WHERE vl.geom IS NOT NULL
         AND ($2::text IS NULL OR v.route_id = $2)
       ORDER BY vl.geom <-> pl.geom
       LIMIT 1
     ) nv ON true
     WHERE ${filters.join(" AND ")}
     ORDER BY pl.ts DESC
     LIMIT $${params.length}`,
    params
  );

  return rows;
};

const publicReportUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: publicReportMaxAttachmentMb * 1024 * 1024,
    files: publicReportMaxAttachments
  },
  fileFilter: (_req, file, cb) => {
    const isImage = (file.mimetype && file.mimetype.startsWith("image/")) ||
      file.mimetype === "application/octet-stream" ||
      publicReportMimeTypes.has(file.mimetype) ||
      /\.(jpe?g|png|webp|heic|heif)$/i.test(file.originalname || "");
    if (!isImage) {
      recordInvalidPublicReportImageRejection("unsupported_mime");
      cb(new Error("Unsupported public report attachment type"));
      return;
    }
    cb(null, true);
  }
});

const uploadPublicReportAttachments = (req, res, next) => {
  publicReportUpload.array("attachments", publicReportMaxAttachments)(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? `Attachment maksimum ${publicReportMaxAttachmentMb} MB per file`
      : error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE"
        ? `Attachment maksimum ${publicReportMaxAttachments} file`
        : error.message || "Attachment tidak valid";
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
  });
};

const emergencyProofUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: publicReportMaxAttachmentMb * 1024 * 1024,
    files: 1
  },
  fileFilter: (_req, file, cb) => {
    if (!publicReportMimeTypes.has(file.mimetype)) {
      cb(new Error("Unsupported emergency proof type"));
      return;
    }
    cb(null, true);
  }
});

const uploadEmergencyProof = (req, res, next) => {
  emergencyProofUpload.single("proof")(req, res, (error) => {
    if (!error) return next();
    const message = error.code === "LIMIT_FILE_SIZE"
      ? `Bukti maksimum ${publicReportMaxAttachmentMb} MB`
      : error.message || "Bukti tidak valid";
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message } });
  });
};

const normalizePlateNo = (value) => String(value || "").replace(/\s+/g, " ").trim().toUpperCase();
const parseRequiredNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseOptionalNumber = (value) => {
  if (value === undefined || value === null || value === "") return null;
  return parseRequiredNumber(value);
};

const resolveEmergencyVehicle = async (body = {}) => {
  if (body.vehicle_id) {
    const { rows } = await query(
      `SELECT vehicle_id, plate_no, route_id
       FROM vehicles
       WHERE vehicle_id = $1
       LIMIT 1`,
      [body.vehicle_id]
    );
    return rows[0] || null;
  }

  if (body.plate_no) {
    const { rows } = await query(
      `SELECT vehicle_id, plate_no, route_id
       FROM vehicles
       WHERE upper(plate_no) = upper($1)
       ORDER BY created_at DESC
       LIMIT 1`,
      [normalizePlateNo(body.plate_no)]
    );
    return rows[0] || null;
  }

  if (body.device_id || body.imei_or_serial) {
    const deviceUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(body.device_id || ""))
      ? body.device_id
      : null;
    const { rows } = await query(
      `SELECT v.vehicle_id, v.plate_no, v.route_id
       FROM assignments a
       JOIN vehicles v ON v.vehicle_id = a.vehicle_id
       JOIN devices d ON d.device_id = a.device_id
       WHERE a.is_active = true
         AND ($1::uuid IS NULL OR d.device_id = $1)
         AND ($2::text IS NULL OR d.imei_or_serial = $2)
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [deviceUuid, body.imei_or_serial || null]
    );
    return rows[0] || null;
  }

  return null;
};

const findDuplicateEmergency = async ({ reporterUserId = null, reporterSessionId = null, vehicleId = null, source = null }) => {
  const predicates = [];
  const params = [Math.max(1, Math.floor(emergencyDuplicateWindowMinutes))];

  if (reporterUserId) {
    params.push(reporterUserId);
    predicates.push(`reporter_user_id = $${params.length}`);
  }
  if (reporterSessionId) {
    params.push(reporterSessionId);
    predicates.push(`reporter_session_id = $${params.length}`);
  }
  if (vehicleId && source === "DRIVER_DEVICE") {
    params.push(vehicleId);
    predicates.push(`vehicle_id = $${params.length}`);
  }

  if (!predicates.length) return null;

  const { rows } = await query(
    `SELECT incident_id, type, severity, status, escalation_state, created_at
     FROM incidents
     WHERE type = 'EMERGENCY'
       AND status IN ('OPEN', 'IN_PROGRESS')
       AND created_at >= now() - ($1::int * interval '1 minute')
       AND (${predicates.join(" OR ")})
     ORDER BY created_at DESC
     LIMIT 1`,
    params
  );

  return rows[0] || null;
};

const verifyPassengerSosSession = async ({ userId, sessionId }) => {
  if (!sessionId) return true;
  const { rows } = await query(
    `SELECT token_id
     FROM passenger_tracking_tokens
     WHERE user_id = $1
       AND session_id = $2
       AND revoked_at IS NULL
       AND expires_at > now()
     LIMIT 1`,
    [userId, sessionId]
  );
  return rows.length > 0;
};

const insertEmergencyIncident = async ({ req, body, source, user = null }) => {
  const now = new Date();
  const built = buildEmergencyIncident({
    source,
    user,
    body,
    now,
    ackSlaSeconds: emergencyAckSlaSeconds,
    assignmentSlaSeconds: emergencyAssignmentSlaSeconds
  });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const incidentResult = await client.query(
      `INSERT INTO incidents (
         vehicle_id,
         type,
         severity,
         status,
         description,
         location_desc,
         lat,
         lon,
         reporter_user_id,
         reporter_session_id,
         source,
         emergency_category,
         trust_level,
         escalation_state,
         ack_due_at,
         assignment_due_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
       RETURNING incident_id, created_at`,
      [
        built.incident.vehicle_id,
        built.incident.type,
        built.incident.severity,
        built.incident.status,
        built.incident.description,
        built.incident.location_desc,
        built.incident.lat,
        built.incident.lon,
        built.incident.reporter_user_id,
        built.incident.reporter_session_id,
        built.incident.source,
        built.incident.emergency_category,
        built.incident.trust_level,
        built.incident.escalation_state,
        built.incident.ack_due_at,
        built.incident.assignment_due_at
      ]
    );
    const incidentId = incidentResult.rows[0].incident_id;

    await client.query(
      `INSERT INTO incident_actions (incident_id, action, actor_id, notes, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        incidentId,
        built.action.action,
        user?.user_id || null,
        built.action.notes,
        JSON.stringify(built.action.metadata)
      ]
    );

    await client.query(
      `INSERT INTO notifications (incident_id, channel, status, payload)
       VALUES ($1, 'IN_APP', 'PENDING', $2)`,
      [
        incidentId,
        JSON.stringify({
          type: "EMERGENCY",
          severity: "CRITICAL",
          message: built.incident.description,
          source
        })
      ]
    );

    await client.query("COMMIT");

    return {
      incident_id: incidentId,
      created_at: incidentResult.rows[0].created_at,
      duplicate: false,
      ...built.incident
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const loadVehicleMatchSnapshot = async (client, plateNo, lat, lon) => {
  const result = await client.query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        vl.lat AS vehicle_last_lat,
        vl.lon AS vehicle_last_lon,
        vl.ts AS vehicle_last_seen_at,
        CASE
          WHEN vl.lat IS NOT NULL AND vl.lon IS NOT NULL
          THEN ST_DistanceSphere(ST_MakePoint($3, $2), ST_MakePoint(vl.lon, vl.lat))
          ELSE NULL
        END AS distance_to_vehicle_m,
        COUNT(*) OVER ()::int AS match_count
     FROM vehicles v
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     WHERE upper(v.plate_no) = upper($1)
     ORDER BY v.created_at DESC
     LIMIT 2`,
    [plateNo, lat, lon]
  );

  if (!result.rows.length) {
    return { plate_match_status: "UNMATCHED_PLATE", vehicle: null };
  }

  const row = result.rows[0];
  return {
    plate_match_status: row.match_count > 1 ? "MULTIPLE_MATCH_CANDIDATES" : "MATCHED_VEHICLE",
    vehicle: row.match_count > 1 ? null : row
  };
};

const mapPublicReportRow = (row) => ({
  public_report_id: row.public_report_id,
  reporter_user_id: row.reporter_user_id,
  reporter_name: row.reporter_name,
  vehicle_id: row.vehicle_id,
  incident_id: row.incident_id,
  plate_no: row.plate_no,
  category: row.category,
  status: row.status,
  plate_match_status: row.plate_match_status,
  description: row.description,
  lat: row.lat,
  lon: row.lon,
  accuracy_m: row.accuracy_m,
  reported_at: row.reported_at,
  vehicle_last_lat: row.vehicle_last_lat,
  vehicle_last_lon: row.vehicle_last_lon,
  vehicle_last_seen_at: row.vehicle_last_seen_at,
  distance_to_vehicle_m: row.distance_to_vehicle_m,
  created_at: row.created_at,
  updated_at: row.updated_at,
  reviewed_by: row.reviewed_by,
  reviewed_at: row.reviewed_at,
  review_notes: row.review_notes,
  route_id: row.route_id,
  route_name: row.route_name,
  latest_speed_kmh: row.latest_speed_kmh,
  active_anomaly: row.active_anomaly,
  active_alert: row.active_alert,
  attachment_count: Number(row.attachment_count || 0),
  latest_review: row.latest_review || null
});

const escapeCsv = (value) => {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
};

const buildRitCsv = (rows) => {
  const header = ["report_date", "plate_no", "route_id", "total_rit"];
  const body = rows.map((row) => [formatReportDate(row.report_date), row.plate_no, row.route_id, row.total_rit].map(escapeCsv).join(","));
  return [header.join(","), ...body].join("\n");
};

const escapePdfText = (value) => String(value ?? "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const formatReportDate = (value) => {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

const buildSimplePdf = ({ title, rows }) => {
  const lines = [
    title,
    "Tanggal | Armada | Trayek | Total Rit",
    ...rows.map((row) => `${formatReportDate(row.report_date)} | ${row.plate_no || "-"} | ${row.route_id || "-"} | ${row.total_rit}`)
  ];
  const content = [
    "BT",
    "/F1 14 Tf",
    "50 790 Td",
    `(${escapePdfText(lines[0])}) Tj`,
    "/F1 10 Tf",
    ...lines.slice(1).flatMap((line) => ["0 -18 Td", `(${escapePdfText(line).slice(0, 110)}) Tj`]),
    "ET"
  ].join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
};

const loadRitReportRows = async ({ reportDate, rangeDays }) => {
  const params = [];
  let where = "";
  if (reportDate) {
    params.push(reportDate);
    where = "WHERE report_date = $1";
  } else if (rangeDays) {
    params.push(rangeDays);
    where = "WHERE report_date >= CURRENT_DATE - ($1::int - 1)";
  }

  const { rows } = await query(
    `SELECT
        r.report_date,
        r.total_rit,
        v.vehicle_id,
        v.plate_no,
        v.route_id
     FROM report_rit_daily r
     LEFT JOIN vehicles v ON v.vehicle_id = r.vehicle_id
     ${where}
     ORDER BY r.report_date DESC, v.plate_no`,
    params
  );

  return rows;
};

const formatSigned = (value, suffix = "", decimals = 1) => {
  const numeric = Number(value || 0);
  const sign = numeric >= 0 ? "+" : "";
  return `${sign}${numeric.toFixed(decimals)}${suffix}`;
};

const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds || 0)));
  const minutes = Math.floor(total / 60);
  const remaining = total % 60;
  if (minutes === 0) return `${remaining}s`;
  return `${minutes}m ${remaining}s`;
};

const locationLabel = ({ locationDesc, lat, lon }) => {
  if (locationDesc) return locationDesc;
  if (lat !== null && lat !== undefined && lon !== null && lon !== undefined) {
    return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
  }
  return "Lokasi belum tersedia";
};

const checkHttpService = async ({ service, url }) => {
  if (!url) {
    return {
      service,
      status: "UNKNOWN",
      checked_at: new Date().toISOString(),
      message: "Health URL belum dikonfigurasi"
    };
  }

  if (url.startsWith("tcp://")) {
    const started = Date.now();
    const target = new URL(url);
    const port = Number(target.port);
    const host = target.hostname;

    return new Promise((resolve) => {
      const socket = net.createConnection({ host, port });
      const finish = (status, message) => {
        socket.destroy();
        resolve({
          service,
          status,
          checked_at: new Date().toISOString(),
          response_ms: Date.now() - started,
          message
        });
      };

      socket.setTimeout(serviceHealthTimeoutMs);
      socket.once("connect", () => finish("OK", `TCP ${host}:${port} reachable`));
      socket.once("timeout", () => finish("ERROR", "TCP health check timeout"));
      socket.once("error", () => finish("ERROR", `TCP ${host}:${port} unreachable`));
    });
  }

  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), serviceHealthTimeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return {
      service,
      status: response.ok ? "OK" : "DEGRADED",
      checked_at: new Date().toISOString(),
      response_ms: Date.now() - started,
      message: `HTTP ${response.status}`
    };
  } catch (error) {
    return {
      service,
      status: "ERROR",
      checked_at: new Date().toISOString(),
      response_ms: Date.now() - started,
      message: error?.name === "AbortError" ? "Health check timeout" : "Health check gagal"
    };
  } finally {
    clearTimeout(timeout);
  }
};

const riskLevelRank = (level) => {
  const ranks = { LOW: 1, MEDIUM: 2, HIGH: 3, CRITICAL: 4 };
  return ranks[level] || 0;
};

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "api-gateway" });
});

app.get("/ready", asyncHandler(async (_req, res) => {
  const readiness = await checkReadiness();
  res.status(readiness.ok ? 200 : 503).json(readiness);
}));

// Citizen-facing hot path: cache the identical payload in Redis for a few seconds
// so thousands of polling clients don't each hit Postgres. TTL kept short so the
// public map stays near-realtime.
const PUBLIC_VEHICLES_CACHE_KEY_PREFIX = "cache:public-vehicles:v2";
const PUBLIC_VEHICLES_CACHE_TTL_SEC = Number(process.env.PUBLIC_VEHICLES_CACHE_TTL_SEC || 3);
const PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC = Number(process.env.PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC || 5);
const PUBLIC_VEHICLES_DEFAULT_LIMIT = Number(process.env.PUBLIC_VEHICLES_DEFAULT_LIMIT || 500);
const PUBLIC_VEHICLES_MAX_LIMIT = Number(process.env.PUBLIC_VEHICLES_MAX_LIMIT || 2000);

const parseBboxParam = parseRealtimeBbox;

const getPublicVehicleScope = (queryParams = {}) => {
  const parsedBbox = parseBboxParam(queryParams.bbox);
  if (parsedBbox.error) return { error: parsedBbox.error };
  return {
    routeId: queryParams.route_id ? String(queryParams.route_id).trim() : null,
    bbox: parsedBbox.bbox,
    limit: parseBoundedInt(queryParams.limit, PUBLIC_VEHICLES_DEFAULT_LIMIT, { max: PUBLIC_VEHICLES_MAX_LIMIT })
  };
};

const publicVehiclesCacheKey = ({ routeId, bbox, limit }) =>
  `${PUBLIC_VEHICLES_CACHE_KEY_PREFIX}:${JSON.stringify({ routeId: routeId || null, bbox: bbox || null, limit })}`;

const setPublicVehiclesCacheHeaders = (res) => {
  res.setHeader(
    "Cache-Control",
    `public, max-age=${PUBLIC_VEHICLES_CACHE_TTL_SEC}, s-maxage=${PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC}`
  );
  res.setHeader("Surrogate-Control", `max-age=${PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC}`);
};

app.get("/public/vehicles", rateLimitPublicTracking, asyncHandler(async (req, res) => {
  const scope = getPublicVehicleScope(req.query);
  if (scope.error) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: scope.error } });
  }

  setPublicVehiclesCacheHeaders(res);

  const cacheKey = publicVehiclesCacheKey(scope);
  const cached = await cacheGetJson(cacheKey);
  if (cached) {
    res.setHeader("X-Cache", "HIT");
    return res.json({ vehicles: cached, items: cached, limit: scope.limit });
  }

  const filters = [];
  const params = [];
  if (scope.routeId) {
    params.push(scope.routeId);
    filters.push(`v.route_id = $${params.length}`);
  }
  if (scope.bbox) {
    params.push(scope.bbox.minLon, scope.bbox.minLat, scope.bbox.maxLon, scope.bbox.maxLat);
    const minLonParam = params.length - 3;
    filters.push(`ST_SetSRID(ST_MakePoint(COALESCE(mp.snapped_lon, vl.lon), COALESCE(mp.snapped_lat, vl.lat)), 4326) && ST_MakeEnvelope($${minLonParam}, $${minLonParam + 1}, $${minLonParam + 2}, $${minLonParam + 3}, 4326)`);
  }
  params.push(scope.limit);
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        r.name AS route_name,
        COALESCE(mp.snapped_lat, vl.lat) AS latest_lat,
        COALESCE(mp.snapped_lon, vl.lon) AS latest_lon,
        COALESCE(vl.status, v.status) AS status,
        vl.ts AS last_seen_at,
        mp.match_status,
        mp.confidence::float AS match_confidence,
        mp.snap_distance_m::float AS snap_distance_m
     FROM vehicles v
     LEFT JOIN routes r ON r.route_id = v.route_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     LEFT JOIN telemetry_matched_positions mp
       ON mp.vehicle_id = vl.vehicle_id
      AND mp.ts = vl.ts
      AND mp.match_status = 'MATCHED'
     ${whereClause}
     ORDER BY v.plate_no
     LIMIT $${params.length}`,
    params
  );

  await cacheSetJson(cacheKey, rows, PUBLIC_VEHICLES_CACHE_TTL_SEC);
  res.setHeader("X-Cache", "MISS");
  res.json({ vehicles: rows, items: rows, limit: scope.limit });
}));

app.get("/public/vehicles/:id", rateLimitPublicTracking, asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        r.name AS route_name,
        COALESCE(mp.snapped_lat, vl.lat) AS latest_lat,
        COALESCE(mp.snapped_lon, vl.lon) AS latest_lon,
        COALESCE(vl.status, v.status) AS status,
        vl.ts AS last_seen_at,
        mp.match_status,
        mp.confidence::float AS match_confidence,
        mp.snap_distance_m::float AS snap_distance_m
     FROM vehicles v
     LEFT JOIN routes r ON r.route_id = v.route_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     LEFT JOIN telemetry_matched_positions mp
       ON mp.vehicle_id = vl.vehicle_id
      AND mp.ts = vl.ts
      AND mp.match_status = 'MATCHED'
     WHERE v.vehicle_id = $1`,
    [req.params.id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Vehicle not found" } });
  }

  res.json({ vehicle: rows[0] });
}));

// --- MED-01: Login rate limiting to prevent brute-force ---
app.post("/auth/login", loginRateLimit, validate(loginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password required" } });
  }

  const { rows } = await query(
    `SELECT user_id, email, full_name, roles
     FROM users
     WHERE email = $1
       AND password_hash = crypt($2, password_hash)
       AND is_active = true
       AND ('OPERATOR' = ANY(roles) OR 'ANALISA' = ANY(roles) OR 'PETUGAS_LAPANGAN' = ANY(roles))`,
    [email, password]
  );

  if (!rows.length) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid credentials" } });
  }

  await setAuthCookies(res, rows[0]);
  return res.json({ user: rows[0] });
}));

app.post("/auth/mobile/register", loginRateLimit, validate(mobileRegisterSchema), asyncHandler(async (req, res) => {
  const { full_name: fullName, email, password } = req.body;
  const existing = await query("SELECT user_id FROM users WHERE email = $1", [email]);
  if (existing.rows.length) {
    return res.status(409).json({ error: { code: "EMAIL_EXISTS", message: "Email sudah terdaftar" } });
  }
  const { rows } = await query(
    `INSERT INTO users (email, full_name, password_hash, roles, email_verified_at)
     VALUES ($1, $2, crypt($3, gen_salt('bf')), ARRAY['PUBLIC_USER'], NULL)
     RETURNING user_id, email, full_name, roles`,
    [email, fullName, password]
  );
  const token = await issueAccountToken({
    table: "email_verification_tokens",
    userId: rows[0].user_id,
    ttlMinutes: mobileVerificationTtlMinutes
  });
  await enqueueAccountEmail({ recipient: email, template: "VERIFY_EMAIL", token });
  await auditUserEvent(req, rows[0].user_id, "PUBLIC_USER_REGISTER");
  return res.status(201).json({ ok: true, verification_required: true });
}));

app.post("/auth/mobile/verify-email", loginRateLimit, validate(mobileTokenSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE email_verification_tokens evt
     SET used_at = now()
     FROM users u
     WHERE evt.token_hash = $1
       AND evt.user_id = u.user_id
       AND evt.used_at IS NULL
       AND evt.expires_at > now()
     RETURNING u.user_id`,
    [hashToken(req.body.token)]
  );
  if (!rows.length) return res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Token verifikasi tidak valid atau kedaluwarsa" } });
  await query("UPDATE users SET email_verified_at = now() WHERE user_id = $1", [rows[0].user_id]);
  await auditUserEvent(req, rows[0].user_id, "PUBLIC_USER_VERIFY_EMAIL");
  return res.json({ ok: true });
}));

app.post("/auth/mobile/resend-verification", loginRateLimit, validate(z.object({ email: z.string().email() })), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT user_id, email FROM users
     WHERE email = $1 AND is_active = true AND email_verified_at IS NULL`,
    [req.body.email.toLowerCase()]
  );
  if (rows.length) {
    const token = await issueAccountToken({ table: "email_verification_tokens", userId: rows[0].user_id, ttlMinutes: mobileVerificationTtlMinutes });
    await enqueueAccountEmail({ recipient: rows[0].email, template: "VERIFY_EMAIL", token });
  }
  return res.json({ ok: true });
}));

app.post("/auth/mobile/forgot-password", loginRateLimit, validate(z.object({ email: z.string().email() })), asyncHandler(async (req, res) => {
  const { rows } = await query("SELECT user_id, email FROM users WHERE email = $1 AND is_active = true", [req.body.email.toLowerCase()]);
  if (rows.length) {
    const token = await issueAccountToken({ table: "password_reset_tokens", userId: rows[0].user_id, ttlMinutes: mobileResetTtlMinutes });
    await enqueueAccountEmail({ recipient: rows[0].email, template: "RESET_PASSWORD", token });
  }
  return res.json({ ok: true });
}));

app.post("/auth/mobile/reset-password", loginRateLimit, validate(z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(200),
  password_confirmation: z.string()
}).refine((value) => value.password === value.password_confirmation, { path: ["password_confirmation"], message: "Konfirmasi password tidak sama" })), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `UPDATE password_reset_tokens prt
     SET used_at = now()
     FROM users u
     WHERE prt.token_hash = $1
       AND prt.user_id = u.user_id
       AND prt.used_at IS NULL
       AND prt.expires_at > now()
     RETURNING u.user_id`,
    [hashToken(req.body.token)]
  );
  if (!rows.length) return res.status(400).json({ error: { code: "INVALID_TOKEN", message: "Token reset tidak valid atau kedaluwarsa" } });
  await query("UPDATE users SET password_hash = crypt($2, gen_salt('bf')) WHERE user_id = $1", [rows[0].user_id, req.body.password]);
  await query("UPDATE mobile_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [rows[0].user_id]);
  await auditUserEvent(req, rows[0].user_id, "PUBLIC_USER_RESET_PASSWORD");
  return res.json({ ok: true });
}));

app.post("/auth/mobile/login", loginRateLimit, validate(mobileLoginSchema), asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Email and password required" } });
  }

  const { rows } = await query(
    `SELECT user_id, email, full_name, roles, email_verified_at
     FROM users
     WHERE email = $1
       AND password_hash = crypt($2, password_hash)
       AND is_active = true
       AND roles @> ARRAY['PUBLIC_USER']::text[]`,
    [email, password]
  );

  if (!rows.length) {
    return res.status(401).json({ error: { code: "INVALID_CREDENTIALS", message: "Invalid public user credentials" } });
  }
  if (!rows[0].email_verified_at) {
    return res.status(403).json({ error: { code: "EMAIL_NOT_VERIFIED", message: "Verifikasi email terlebih dahulu" } });
  }
  return res.json(await mobileSessionPayload(rows[0]));
}));

app.post("/auth/mobile/refresh", validate(mobileRefreshSchema), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT mrt.token_id, mrt.user_id, u.email, u.full_name, u.roles
     FROM mobile_refresh_tokens mrt
     JOIN users u ON u.user_id = mrt.user_id
     WHERE mrt.token_hash = $1 AND mrt.revoked_at IS NULL AND mrt.expires_at > now()
       AND u.is_active = true AND u.email_verified_at IS NOT NULL`,
    [hashToken(req.body.refresh_token)]
  );
  if (!rows.length) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh token tidak valid" } });
  const refresh = await issueMobileRefreshToken(rows[0].user_id);
  await query("UPDATE mobile_refresh_tokens SET revoked_at = now(), replaced_by = $2 WHERE token_id = $1", [rows[0].token_id, refresh.tokenId]);
  return res.json(await mobileSessionPayload(rows[0], refresh));
}));

app.post("/auth/mobile/logout", auth, asyncHandler(async (req, res) => {
  const refreshToken = req.body?.refresh_token;
  if (refreshToken) await query("UPDATE mobile_refresh_tokens SET revoked_at = now() WHERE token_hash = $1", [hashToken(String(refreshToken))]);
  await query("UPDATE passenger_tracking_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.user.user_id]);
  await auditLog(req, { action: "PUBLIC_USER_LOGOUT", entityType: "user", entityId: req.user.user_id });
  return res.json({ ok: true });
}));

app.post("/me/passenger-tracking/consent", auth, requireRole(["PUBLIC_USER"]), validate(trackingConsentSchema), asyncHandler(async (req, res) => {
  await query(
    `INSERT INTO passenger_tracking_consents (user_id, policy_version, platform, app_version)
     VALUES ($1, $2, $3, $4)`,
    [req.user.user_id, req.body.policy_version, req.body.platform || null, req.body.app_version || null]
  );
  const tracking = await issuePassengerTrackingToken({ userId: req.user.user_id, userAgent: req.headers["user-agent"] });
  return res.json({
    ok: true,
    passenger_tracking_token: tracking.token,
    passenger_tracking_session_id: tracking.sessionId,
    passenger_tracking_expires_at: tracking.expiresAt
  });
}));

app.get("/me/passenger-tracking/status", auth, requireRole(["PUBLIC_USER"]), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT ptt.session_id, ptt.expires_at, ptt.last_used_at, pl.ts AS last_sync_at
     FROM passenger_tracking_tokens ptt
     LEFT JOIN passenger_latest pl ON pl.user_id = ptt.user_id AND pl.session_id = ptt.session_id
     WHERE ptt.user_id = $1 AND ptt.revoked_at IS NULL AND ptt.expires_at > now()
     ORDER BY ptt.issued_at DESC LIMIT 1`,
    [req.user.user_id]
  );
  return res.json({ active: rows.length > 0, ...(rows[0] || {}) });
}));

app.delete("/me/passenger-tracking/session", auth, requireRole(["PUBLIC_USER"]), asyncHandler(async (req, res) => {
  await query("UPDATE passenger_tracking_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [req.user.user_id]);
  return res.json({ ok: true });
}));

app.get("/me/public-reports", auth, requireRole(["PUBLIC_USER"]), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT public_report_id, plate_no, category, status, plate_match_status, description, reported_at, created_at, updated_at
     FROM public_reports WHERE reporter_user_id = $1 ORDER BY created_at DESC LIMIT 100`,
    [req.user.user_id]
  );
  return res.json({ items: rows });
}));

app.get("/me/public-reports/:id", auth, requireRole(["PUBLIC_USER"]), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT public_report_id, plate_no, category, status, plate_match_status, description, reported_at, created_at, updated_at
     FROM public_reports WHERE reporter_user_id = $1 AND public_report_id = $2`,
    [req.user.user_id, req.params.id]
  );
  if (!rows.length) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Laporan tidak ditemukan" } });
  return res.json({ report: rows[0] });
}));

app.delete("/me/account", auth, requireRole(["PUBLIC_USER"]), asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  await query("DELETE FROM passenger_positions WHERE user_id = $1", [userId]);
  await query("UPDATE passenger_tracking_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  await query("UPDATE mobile_refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [userId]);
  await query(
    `UPDATE users SET email = concat('deleted+', user_id, '@anon.invalid'), full_name = 'Warga Terhapus',
       password_hash = crypt(gen_random_uuid()::text, gen_salt('bf')), roles = ARRAY[]::text[],
       is_active = false, deleted_at = now()
     WHERE user_id = $1`,
    [userId]
  );
  await auditLog(req, { action: "PUBLIC_USER_ANONYMIZE_ACCOUNT", entityType: "user", entityId: userId });
  return res.json({ ok: true });
}));

app.get("/me", auth, (req, res) => {
  res.json(req.user);
});

app.get("/passengers/active", auth, requireRole(["OPERATOR", "ANALISA"]), asyncHandler(async (req, res) => {
  const activeWithinMinutes = Math.min(Math.max(Number(req.query.active_within_minutes || 15), 1), 1440);
  const routeId = req.query.route_id ? String(req.query.route_id) : null;
  const parsedBbox = parseBboxParam(req.query.bbox);
  if (parsedBbox.error) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: parsedBbox.error } });
  }

  const policy = getPassengerLocationAccessPolicy(req.user, { route_id: routeId, bbox: parsedBbox.bbox });
  if (!policy.allowed) {
    await auditLog(req, {
      action: "PASSENGER_POSITIONS_VIEW_DENIED",
      entityType: "PASSENGER_POSITION",
      metadata: { active_within_minutes: activeWithinMinutes, count: 0, ...policy }
    });
    return res.json({ items: [], passengers: [], privacy: policy });
  }

  const rawPassengers = await fetchLatestPassengers({ activeWithinMinutes, routeId, bbox: parsedBbox.bbox });
  const passengers = rawPassengers.map((passenger) => serializePassengerForPrincipal(passenger, req.user));
  await auditLog(req, {
    action: "PASSENGER_POSITIONS_VIEW",
    entityType: "PASSENGER_POSITION",
    metadata: { active_within_minutes: activeWithinMinutes, count: passengers.length, ...policy }
  });
  res.json({ items: passengers, passengers, privacy: policy });
}));

app.post("/me/sos", auth, requireRole(["PUBLIC_USER"]), rateLimitEmergencySos, validate(sosEmergencySchema), asyncHandler(async (req, res) => {
  const sessionValid = await verifyPassengerSosSession({
    userId: req.user.user_id,
    sessionId: req.body.session_id || null
  });
  if (!sessionValid) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "session_id SOS tidak valid" } });
  }

  const vehicle = await resolveEmergencyVehicle(req.body);
  const emergencyBody = {
    ...req.body,
    vehicle_id: vehicle?.vehicle_id || req.body.vehicle_id || null
  };

  const duplicate = await findDuplicateEmergency({
    reporterUserId: req.user.user_id,
    reporterSessionId: emergencyBody.session_id || null,
    vehicleId: emergencyBody.vehicle_id,
    source: "PASSENGER_APP"
  });
  if (duplicate) {
    await auditLog(req, {
      action: "EMERGENCY_SOS_DUPLICATE",
      entityType: "incident",
      entityId: duplicate.incident_id,
      metadata: { source: "PASSENGER_APP" }
    });
    return res.json({ ...duplicate, duplicate: true });
  }

  const incident = await insertEmergencyIncident({
    req,
    source: "PASSENGER_APP",
    user: req.user,
    body: emergencyBody
  });

  await auditLog(req, {
    action: "EMERGENCY_SOS_CREATED",
    entityType: "incident",
    entityId: incident.incident_id,
    metadata: {
      source: "PASSENGER_APP",
      category: incident.emergency_category,
      trust_level: incident.trust_level,
      vehicle_id: incident.vehicle_id
    }
  });

  res.status(201).json({
    incident_id: incident.incident_id,
    duplicate: false,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    trust_level: incident.trust_level,
    escalation_state: incident.escalation_state,
    ack_due_at: incident.ack_due_at,
    assignment_due_at: incident.assignment_due_at,
    vehicle_id: incident.vehicle_id
  });
}));

app.get("/emergencies", auth, requireRole(["OPERATOR", "ANALISA", "PETUGAS_LAPANGAN"]), asyncHandler(async (req, res) => {
  const filters = ["i.type = 'EMERGENCY'"];
  const params = [];
  if (req.query.status) {
    params.push(req.query.status);
    filters.push(`i.status = $${params.length}`);
  } else {
    filters.push("i.status IN ('OPEN', 'IN_PROGRESS')");
  }
  if (hasRole(req, "PETUGAS_LAPANGAN") && !hasRole(req, "OPERATOR") && !hasRole(req, "ANALISA")) {
    params.push(req.user.user_id);
    filters.push(`i.assigned_to = $${params.length}`);
  }

  const requestedLimit = Number(req.query.limit || 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 200) : 100;
  params.push(limit);

  const { rows } = await query(
    `SELECT
        i.incident_id,
        i.type,
        i.severity,
        i.status,
        i.description,
        i.location_desc,
        i.lat,
        i.lon,
        i.created_at,
        i.assigned_to,
        i.acknowledged_at,
        i.resolved_at,
        i.reporter_user_id,
        i.reporter_session_id,
        i.source,
        i.emergency_category,
        i.trust_level,
        i.escalation_state,
        i.ack_due_at,
        i.assignment_due_at,
        i.escalation_target,
        ua.full_name AS assigned_name,
        v.plate_no,
        v.route_id,
        nearest.vehicle_id AS nearest_vehicle_id,
        nearest.plate_no AS nearest_vehicle_plate,
        nearest.route_id AS nearest_vehicle_route_id,
        nearest.distance_m AS nearest_vehicle_distance_m
     FROM incidents i
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     LEFT JOIN users ua ON ua.user_id = i.assigned_to
     LEFT JOIN LATERAL (
       SELECT
         v2.vehicle_id,
         v2.plate_no,
         v2.route_id,
         ST_DistanceSphere(ST_MakePoint(i.lon, i.lat), ST_MakePoint(vl.lon, vl.lat))::float AS distance_m
       FROM vehicle_latest vl
       JOIN vehicles v2 ON v2.vehicle_id = vl.vehicle_id
       WHERE i.lat IS NOT NULL
         AND i.lon IS NOT NULL
         AND vl.lat IS NOT NULL
         AND vl.lon IS NOT NULL
       ORDER BY ST_MakePoint(i.lon, i.lat) <-> ST_MakePoint(vl.lon, vl.lat)
       LIMIT 1
     ) nearest ON true
     WHERE ${filters.join(" AND ")}
     ORDER BY
       CASE i.status WHEN 'OPEN' THEN 0 WHEN 'IN_PROGRESS' THEN 1 ELSE 2 END,
       i.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  const now = new Date();
  const items = rows.map((row) => {
    const escalation = deriveEmergencyEscalation({
      status: row.status,
      createdAt: row.created_at,
      acknowledgedAt: row.acknowledged_at,
      assignedTo: row.assigned_to,
      resolvedAt: row.resolved_at,
      now,
      ackSlaSeconds: emergencyAckSlaSeconds,
      assignmentSlaSeconds: emergencyAssignmentSlaSeconds
    });
    return {
      ...row,
      id: row.incident_id,
      location: locationLabel({ locationDesc: row.location_desc, lat: row.lat, lon: row.lon }),
      escalation_state: escalation.state,
      escalation_target: row.escalation_target || escalation.target,
      escalation_breached_seconds: escalation.breached_seconds,
      nearest_vehicle: row.nearest_vehicle_id ? {
        vehicle_id: row.nearest_vehicle_id,
        plate_no: row.nearest_vehicle_plate,
        route_id: row.nearest_vehicle_route_id,
        distance_m: row.nearest_vehicle_distance_m
      } : null,
      sla: {
        ack_due_at: row.ack_due_at,
        assignment_due_at: row.assignment_due_at,
        ack_sla_seconds: emergencyAckSlaSeconds,
        assignment_sla_seconds: emergencyAssignmentSlaSeconds
      }
    };
  });

  await auditLog(req, { action: "READ_EMERGENCY_BOARD", entityType: "incident", metadata: { count: items.length } });
  res.json({ items, sla: { ack_seconds: emergencyAckSlaSeconds, assignment_seconds: emergencyAssignmentSlaSeconds } });
}));

app.post("/auth/refresh", asyncHandler(async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const csrfHeader = req.headers["x-csrf-token"];
  if (!cookies.sentra_csrf || !csrfHeader || cookies.sentra_csrf !== csrfHeader) {
    return res.status(403).json({ error: { code: "CSRF_ERROR", message: "Invalid CSRF token" } });
  }
  const refreshToken = cookies.sentra_refresh;
  if (!refreshToken) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing refresh token" } });
  }

  const tokenHash = hashToken(refreshToken);
  const { rows } = await query(
    `SELECT token_id, user_id, expires_at, revoked_at
     FROM refresh_tokens
     WHERE token_hash = $1
       AND revoked_at IS NULL`,
    [tokenHash]
  );

  if (!rows.length) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid refresh token" } });
  }

  const record = rows[0];
  if (new Date(record.expires_at).getTime() <= Date.now()) {
    await query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_id = $1", [record.token_id]);
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Refresh token expired" } });
  }

  const userResult = await query(
    `SELECT user_id, email, full_name, roles
     FROM users
     WHERE user_id = $1
       AND is_active = true`,
    [record.user_id]
  );

  if (!userResult.rows.length) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "User inactive" } });
  }

  const user = userResult.rows[0];
  const refresh = await issueRefreshToken(user.user_id);
  await query(
    `UPDATE refresh_tokens
     SET revoked_at = now(), replaced_by = $1
     WHERE token_id = $2`,
    [refresh.tokenId, record.token_id]
  );

  const csrfToken = crypto.randomBytes(24).toString("base64url");
  setCookie(res, "sentra_access", signToken(user), {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/"
  });
  setCookie(res, "sentra_refresh", refresh.token, {
    httpOnly: true,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/"
  });
  setCookie(res, "sentra_csrf", csrfToken, {
    httpOnly: false,
    secure: cookieSecure,
    sameSite: cookieSameSite,
    path: "/"
  });

  return res.json({ ok: true });
}));

app.post("/auth/logout", auth, asyncHandler(async (req, res) => {
  const cookies = parseCookies(req.headers.cookie || "");
  const refreshToken = cookies.sentra_refresh;
  if (refreshToken) {
    await query("UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL", [
      hashToken(refreshToken)
    ]);
  }
  clearCookie(res, "sentra_access");
  clearCookie(res, "sentra_refresh");
  clearCookie(res, "sentra_csrf");
  res.json({ ok: true });
}));

app.post(
  ["/public/reports", "/public/qr-report"],
  (req, res, next) => {
    if (req.path === "/public/qr-report") {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        req.user = null;
        return next();
      }
    }
    return auth(req, res, () => {
      return requireRole(["PUBLIC_USER"])(req, res, next);
    });
  },
  rateLimitPublicReports,
  uploadPublicReportAttachments,
  validate(publicReportSchema),
  asyncHandler(async (req, res) => {
    if (!isObjectStorageConfigured()) {
      return res.status(503).json({ error: { code: "STORAGE_UNAVAILABLE", message: "Object storage is not configured" } });
    }

    const plateNo = normalizePlateNo(req.body?.plate_no);
    const category = String(req.body?.category || "").toUpperCase();
    const description = String(req.body?.description || "").trim();
    const lat = parseRequiredNumber(req.body?.lat);
    const lon = parseRequiredNumber(req.body?.lon);
    const accuracyM = parseOptionalNumber(req.body?.accuracy_m);
    const reportedAt = parseDateParam(req.body?.reported_at);
    const files = Array.isArray(req.files) ? req.files : [];

    if (!plateNo || !category || !description || lat === null || lon === null || !reportedAt) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "plate_no, category, description, lat, lon, reported_at required" } });
    }
    if (!publicReportCategories.has(category)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Kategori laporan tidak dikenal" } });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Lokasi laporan tidak valid" } });
    }
    if (!files.length) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Minimal satu foto bukti wajib" } });
    }

    const validatedFiles = [];
    for (const file of files) {
      try {
        const validation = await validatePublicReportEvidenceImage(file, {
          maxOutputBytes: publicReportMaxAttachmentMb * 1024 * 1024
        });
        validatedFiles.push({ file, validation });
      } catch (error) {
        console.error("[public-report] Image validation failed:", error?.message || error, {
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.buffer?.length
        });
        recordInvalidPublicReportImageRejection("image_validation_failed");
        return res.status(400).json({
          error: {
            code: "VALIDATION_ERROR",
            message: error instanceof Error ? error.message : "Attachment gambar tidak valid"
          }
        });
      }
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const match = await loadVehicleMatchSnapshot(client, plateNo, lat, lon);
      const vehicle = match.vehicle;
      let reporterUserId = req.user?.user_id;
      if (!reporterUserId) {
        const defaultUserRes = await client.query(
          "SELECT user_id FROM users WHERE 'PUBLIC_USER' = ANY(roles) ORDER BY created_at ASC LIMIT 1"
        );
        reporterUserId = defaultUserRes.rows[0]?.user_id;
      }

      const reportResult = await client.query(
        `INSERT INTO public_reports (
           reporter_user_id,
           vehicle_id,
           plate_no,
           category,
           status,
           plate_match_status,
           description,
           lat,
           lon,
           accuracy_m,
           reported_at,
           vehicle_last_lat,
           vehicle_last_lon,
           vehicle_last_seen_at,
           distance_to_vehicle_m
         )
         VALUES ($1, $2, $3, $4, 'PENDING_REVIEW', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         RETURNING public_report_id, status, plate_match_status`,
        [
          reporterUserId,
          vehicle?.vehicle_id || null,
          plateNo,
          category,
          match.plate_match_status,
          description,
          lat,
          lon,
          accuracyM,
          reportedAt,
          vehicle?.vehicle_last_lat || null,
          vehicle?.vehicle_last_lon || null,
          vehicle?.vehicle_last_seen_at || null,
          vehicle?.distance_to_vehicle_m || null
        ]
      );

      const publicReportId = reportResult.rows[0].public_report_id;
      const now = new Date(reportedAt);
      const bucketName = getPublicReportBucket();
      const attachments = [];

      for (const { file, validation } of validatedFiles) {
        const attachmentId = crypto.randomUUID();
        const checksum = crypto.createHash("sha256").update(validation.buffer).digest("hex");
        const ext = publicReportExtByMime[validation.contentType] || validation.extension;
        const key = `public-reports/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${publicReportId}/${attachmentId}.${ext}`;

        await putBufferObject({
          bucketName,
          key,
          buffer: validation.buffer,
          contentType: validation.contentType,
          metadata: {
            "public-report-id": publicReportId,
            "attachment-id": attachmentId,
            "image-width": String(validation.width),
            "image-height": String(validation.height),
            "original-file-size": String(validation.originalSize)
          }
        });

        const attachmentResult = await client.query(
          `INSERT INTO public_report_attachments (
             attachment_id,
             public_report_id,
             bucket,
             object_key,
             content_type,
             file_size_bytes,
             checksum_sha256,
             original_filename
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING attachment_id, public_report_id, bucket, object_key, content_type, file_size_bytes, checksum_sha256, original_filename, uploaded_at`,
          [
            attachmentId,
            publicReportId,
            bucketName,
            key,
            validation.contentType,
            validation.size,
            checksum,
            file.originalname || null
          ]
        );
        attachments.push(attachmentResult.rows[0]);
      }

      await client.query("COMMIT");

      let evidenceProcessing = { queued: 0 };
      try {
        evidenceProcessing = await enqueuePublicReportEvidenceProcessing(attachments);
      } catch (error) {
        await recordPublicReportEvidenceEnqueueFailure();
        console.error(JSON.stringify({
          ts: new Date().toISOString(),
          event: "public_report_evidence_enqueue_failed",
          public_report_id: publicReportId,
          attachment_count: attachments.length,
          error: error instanceof Error ? error.message : String(error)
        }));
        evidenceProcessing = { queued: 0, failed: attachments.length };
      }

      res.status(201).json({
        public_report_id: publicReportId,
        status: reportResult.rows[0].status,
        plate_match_status: reportResult.rows[0].plate_match_status,
        attachments,
        evidence_processing: evidenceProcessing
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  })
);

app.get("/operator/public-reports", auth, requireRole(["OPERATOR", "ANALISA"]), asyncHandler(async (req, res) => {
  const status = String(req.query.status || "").toUpperCase();
  const limit = Math.min(Number(req.query.limit || 50), 100);
  const values = [];
  let statusFilter = "";

  if (status) {
    if (!publicReportStatuses.has(status)) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Status laporan tidak valid" } });
    }
    values.push(status);
    statusFilter = `WHERE pr.status = $${values.length}`;
  }
  values.push(limit);

  const { rows } = await query(
    `SELECT
        pr.*,
        u.full_name AS reporter_name,
        r.name AS route_name,
        vl.speed_kmh::float AS latest_speed_kmh,
        (
          SELECT a.rule
          FROM anomalies a
          WHERE a.vehicle_id = pr.vehicle_id
            AND a.status = 'OPEN'
          ORDER BY a.last_seen_at DESC
          LIMIT 1
        ) AS active_anomaly,
        (
          SELECT al.rule
          FROM alerts al
          WHERE al.vehicle_id = pr.vehicle_id
            AND al.status IN ('OPEN', 'ESCALATED')
          ORDER BY al.last_seen_at DESC
          LIMIT 1
        ) AS active_alert,
        prr.latest_review,
        COUNT(pra.attachment_id)::int AS attachment_count
     FROM public_reports pr
     LEFT JOIN users u ON u.user_id = pr.reporter_user_id
     LEFT JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
     LEFT JOIN routes r ON r.route_id = v.route_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = pr.vehicle_id
     LEFT JOIN public_report_attachments pra ON pra.public_report_id = pr.public_report_id
     LEFT JOIN LATERAL (
       SELECT jsonb_build_object(
         'review_id', review_id,
         'verdict', verdict,
         'confidence_score', confidence_score::float,
         'reason_summary', reason_summary,
         'evidence_snapshot', evidence_snapshot,
         'ai_summary', ai_summary,
         'matched_anomaly_id', matched_anomaly_id,
         'matched_alert_id', matched_alert_id,
         'matched_incident_id', matched_incident_id,
         'auto_escalated', auto_escalated,
         'created_at', created_at
       ) AS latest_review
       FROM public_report_reviews
       WHERE public_report_id = pr.public_report_id
       ORDER BY created_at DESC
       LIMIT 1
     ) prr ON true
     ${statusFilter}
     GROUP BY pr.public_report_id, u.full_name, r.name, vl.speed_kmh, prr.latest_review
     ORDER BY pr.created_at DESC
     LIMIT $${values.length}`,
    values
  );

  await auditLog(req, { action: "READ_PUBLIC_REPORTS", entityType: "public_report", metadata: { status: status || null } });
  res.json({ items: rows.map(mapPublicReportRow) });
}));

app.post("/operator/public-reports/reviews/run", auth, requireRole(["OPERATOR", "ANALISA"]), asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.body?.limit || req.query.limit || 25);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100) : 25;
  const result = await enqueuePublicReportReviewBatch({ limit });
  await auditLog(req, { action: "PUBLIC_REPORT_REVIEW_ENQUEUE", entityType: "public_report", metadata: result });
  if (result.disabled) {
    return res.status(503).json({
      ok: false,
      error: { code: "WORKER_QUEUE_DISABLED", message: "Public report review queue is disabled or unavailable." },
      ...result
    });
  }
  res.json({ ok: true, ...result });
}));

app.get("/operator/public-reports/:id", auth, requireRole(["OPERATOR", "ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const reportResult = await query(
    `SELECT
        pr.*,
        u.full_name AS reporter_name,
        r.name AS route_name,
        vl.speed_kmh::float AS latest_speed_kmh,
        (
          SELECT a.rule
          FROM anomalies a
          WHERE a.vehicle_id = pr.vehicle_id
            AND a.status = 'OPEN'
          ORDER BY a.last_seen_at DESC
          LIMIT 1
        ) AS active_anomaly,
        (
          SELECT al.rule
          FROM alerts al
          WHERE al.vehicle_id = pr.vehicle_id
            AND al.status IN ('OPEN', 'ESCALATED')
          ORDER BY al.last_seen_at DESC
          LIMIT 1
        ) AS active_alert,
        prr.latest_review,
        COUNT(pra.attachment_id)::int AS attachment_count
     FROM public_reports pr
     LEFT JOIN users u ON u.user_id = pr.reporter_user_id
     LEFT JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
     LEFT JOIN routes r ON r.route_id = v.route_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = pr.vehicle_id
     LEFT JOIN public_report_attachments pra ON pra.public_report_id = pr.public_report_id
     LEFT JOIN LATERAL (
       SELECT jsonb_build_object(
         'review_id', review_id,
         'verdict', verdict,
         'confidence_score', confidence_score::float,
         'reason_summary', reason_summary,
         'evidence_snapshot', evidence_snapshot,
         'ai_summary', ai_summary,
         'matched_anomaly_id', matched_anomaly_id,
         'matched_alert_id', matched_alert_id,
         'matched_incident_id', matched_incident_id,
         'auto_escalated', auto_escalated,
         'created_at', created_at
       ) AS latest_review
       FROM public_report_reviews
       WHERE public_report_id = pr.public_report_id
       ORDER BY created_at DESC
       LIMIT 1
     ) prr ON true
     WHERE pr.public_report_id = $1
     GROUP BY pr.public_report_id, u.full_name, r.name, vl.speed_kmh, prr.latest_review`,
    [id]
  );

  if (!reportResult.rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Public report not found" } });
  }

  const [attachmentsResult, actionsResult] = await Promise.all([
    query(
      `SELECT
          attachment_id,
          content_type,
          file_size_bytes,
          checksum_sha256,
          original_filename,
          uploaded_at
       FROM public_report_attachments
       WHERE public_report_id = $1
       ORDER BY uploaded_at`,
      [id]
    ),
    query(
      `SELECT
          pra.action_id,
          pra.action,
          pra.notes,
          pra.created_at,
          u.full_name AS actor_name
       FROM public_report_actions pra
       LEFT JOIN users u ON u.user_id = pra.actor_id
       WHERE pra.public_report_id = $1
       ORDER BY pra.created_at DESC`,
      [id]
    )
  ]);

  await auditLog(req, { action: "READ_PUBLIC_REPORT_DETAIL", entityType: "public_report", entityId: id });
  res.json({
    report: mapPublicReportRow(reportResult.rows[0]),
    attachments: attachmentsResult.rows.map((attachment) => ({
      ...attachment,
      download_url: `/operator/public-reports/${id}/attachments/${attachment.attachment_id}`
    })),
    actions: actionsResult.rows
  });
}));

app.get("/operator/public-reports/:id/attachments/:attachmentId", auth, requireRole(["OPERATOR", "ANALISA"]), asyncHandler(async (req, res) => {
  const { id, attachmentId } = req.params;
  const { rows } = await query(
    `SELECT bucket, object_key, content_type, file_size_bytes, original_filename
     FROM public_report_attachments
     WHERE public_report_id = $1
       AND attachment_id = $2`,
    [id, attachmentId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Attachment not found" } });
  }

  const attachment = rows[0];
  const object = await getObjectBuffer({ bucketName: attachment.bucket, key: attachment.object_key });
  res.setHeader("Content-Type", attachment.content_type || object.contentType || "application/octet-stream");
  res.setHeader("Content-Length", attachment.file_size_bytes || object.contentLength || object.buffer.length);
  res.setHeader("Cache-Control", "private, max-age=300");
  // --- MED-02: Sanitize filename to prevent header injection ---
  const safeFilename = String(attachment.original_filename || attachmentId).replace(/["\r\n\\]/g, "_").slice(0, 255);
  res.setHeader("Content-Disposition", `inline; filename="${safeFilename}"`);
  res.send(object.buffer);
}));

app.post("/operator/public-reports/:id/actions", auth, requireRole(["OPERATOR", "ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const actionUpper = String(req.body?.action || "").toUpperCase();
  const notes = req.body?.notes ? String(req.body.notes).trim() : null;

  if (!publicReportActions.has(actionUpper)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Unsupported public report action" } });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const reportResult = await client.query(
      `SELECT public_report_id, vehicle_id, incident_id, category, status, description, plate_no, lat, lon
       FROM public_reports
       WHERE public_report_id = $1
       FOR UPDATE`,
      [id]
    );

    if (!reportResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Public report not found" } });
    }

    const report = reportResult.rows[0];
    let nextStatus = report.status;
    let incidentId = report.incident_id;

    if (actionUpper === "ACKNOWLEDGE") nextStatus = "ACKNOWLEDGED";
    if (actionUpper === "REJECT") nextStatus = "REJECTED";
    if (actionUpper === "RESOLVE") nextStatus = "RESOLVED";
    if (actionUpper === "ESCALATE_TO_INCIDENT") {
      nextStatus = "ESCALATED_TO_INCIDENT";
      if (!incidentId) {
        const incidentResult = await client.query(
          `INSERT INTO incidents (vehicle_id, type, severity, status, description, location_desc, lat, lon)
           VALUES ($1, $2, $3, 'OPEN', $4, $5, $6, $7)
           RETURNING incident_id`,
          [
            report.vehicle_id,
            report.category,
            report.category === "SECURITY" ? "HIGH" : "MEDIUM",
            `Public report ${report.plate_no}: ${report.description}`,
            "Laporan masyarakat",
            report.lat,
            report.lon
          ]
        );
        incidentId = incidentResult.rows[0].incident_id;
        await client.query(
          `INSERT INTO incident_actions (incident_id, action, actor_id, notes)
           VALUES ($1, 'ASSIGN', $2, $3)`,
          [incidentId, req.user.user_id, notes || "Escalated from public report"]
        );
      }
    }

    await client.query(
      `UPDATE public_reports
       SET status = $1,
           incident_id = $2,
           reviewed_by = $3,
           reviewed_at = now(),
           review_notes = COALESCE($4, review_notes),
           updated_at = now()
       WHERE public_report_id = $5`,
      [nextStatus, incidentId, req.user.user_id, notes, id]
    );

    await client.query(
      `INSERT INTO public_report_actions (public_report_id, actor_id, action, notes)
       VALUES ($1, $2, $3, $4)`,
      [id, req.user.user_id, actionUpper, notes]
    );

    await client.query("COMMIT");
    await auditLog(req, { action: `PUBLIC_REPORT_${actionUpper}`, entityType: "public_report", entityId: id, metadata: { incident_id: incidentId } });
    res.json({ ok: true, status: nextStatus, incident_id: incidentId });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.get("/users", auth, requireRole(["ANALISA"]), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT user_id, email, full_name, roles, is_active, created_at
     FROM users
     ORDER BY created_at DESC`
  );
  await auditLog(_req, { action: "READ_USERS", entityType: "user" });
  res.json({ items: rows });
}));

app.get("/incident-assignees", auth, requireOperatorDashboardRole, asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT user_id, full_name
     FROM users
     WHERE is_active = true
       AND ('OPERATOR' = ANY(roles) OR 'ANALISA' = ANY(roles) OR 'PETUGAS_LAPANGAN' = ANY(roles))
     ORDER BY full_name`
  );
  res.json({ items: rows });
}));

app.post("/users", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { email, password, full_name, roles } = req.body || {};
  if (!email || !password || !full_name) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email, password, full_name required" } });
  }

  const { rows } = await query(
    `INSERT INTO users (email, full_name, password_hash, roles)
     VALUES ($1, $2, crypt($3, gen_salt('bf')), $4)
     RETURNING user_id`,
    [email, full_name, password, roles && roles.length ? roles : ["OPERATOR"]]
  );
  await auditLog(req, { action: "CREATE_USER", entityType: "user", entityId: rows[0].user_id });
  res.json({ user_id: rows[0].user_id });
}));

app.get("/owners", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const canViewSensitiveOwnerData = hasRole(req, "ANALISA");
  const { params, whereClause, paginationClause, hasPagination, page, limit } = createOwnerListScope(req.query, {
    canViewSensitiveOwnerData
  });
  const { rows } = await query(
    `SELECT
        o.owner_id,
        o.owner_type,
        o.name,
        o.phone_primary,
        o.status,
        COUNT(v.vehicle_id)::int AS total_fleet,
        COUNT(v.vehicle_id) FILTER (WHERE v.status IN ('IN_SERVICE', 'IDLE', 'OFF_ROUTE', 'SOS'))::int AS active_fleet,
        ROUND(AVG(rs.current_score)::numeric, 1)::float AS avg_risk_score,
        COUNT(v.vehicle_id) FILTER (WHERE rs.risk_level = 'HIGH')::int AS high_risk_vehicle_count,
        COUNT(v.vehicle_id) FILTER (WHERE rs.risk_level = 'CRITICAL')::int AS critical_risk_vehicle_count,
        COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '7 days')::int AS incident_count_7d,
        COUNT(*) OVER()::int AS total_count
     FROM owners o
     LEFT JOIN vehicles v ON v.owner_id = o.owner_id
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
     ${whereClause}
     GROUP BY o.owner_id
     ORDER BY
       COUNT(v.vehicle_id) FILTER (WHERE rs.risk_level IN ('HIGH', 'CRITICAL')) DESC,
       AVG(rs.current_score) DESC NULLS LAST,
       o.created_at DESC
     ${paginationClause}`,
    params
  );
  const { total, items: rawItems } = stripTotalCount(rows);
  const items = rawItems.map((row) => ({
    ...row,
    phone_primary: hasRole(req, "ANALISA") ? row.phone_primary : null
  }));
  res.json({ items, total, ...(hasPagination ? { page, limit } : {}) });
}));

app.get("/owners/:id", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const ownerResult = await query(
    `SELECT owner_id, owner_type, name, phone_primary, email, base_name, base_lat, base_lon, status, created_at
     FROM owners
     WHERE owner_id = $1`,
    [id]
  );

  if (!ownerResult.rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Owner not found" } });
  }

  const vehiclesResult = await query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        v.vehicle_code,
        v.status,
        rs.current_score AS risk_score,
        rs.risk_level,
        (
          SELECT COUNT(*)::int
          FROM incidents i
          WHERE i.vehicle_id = v.vehicle_id
            AND i.created_at >= now() - interval '7 days'
        ) AS incident_count_7d
     FROM vehicles v
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     WHERE v.owner_id = $1
     ORDER BY rs.current_score DESC NULLS LAST, plate_no`,
    [id]
  );

  const riskSummaryResult = await query(
    `SELECT
        COUNT(v.vehicle_id)::int AS total_vehicles,
        ROUND(AVG(rs.current_score)::numeric, 1)::float AS avg_risk_score,
        COUNT(v.vehicle_id) FILTER (WHERE rs.risk_level = 'HIGH')::int AS high_risk_vehicle_count,
        COUNT(v.vehicle_id) FILTER (WHERE rs.risk_level = 'CRITICAL')::int AS critical_risk_vehicle_count,
        COUNT(DISTINCT i.incident_id) FILTER (WHERE i.status IN ('OPEN', 'IN_PROGRESS'))::int AS active_incident_count,
        COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '7 days')::int AS incident_count_7d
     FROM vehicles v
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
     WHERE v.owner_id = $1`,
    [id]
  );

  const [incidentResult, sanctionResult] = await Promise.all([
    hasRole(req, "ANALISA")
      ? query(
          `SELECT
              i.incident_id,
              i.vehicle_id,
              v.plate_no,
              i.type,
              i.severity,
              i.status,
              i.description,
              i.location_desc,
              i.created_at,
              i.resolved_at
           FROM incidents i
           JOIN vehicles v ON v.vehicle_id = i.vehicle_id
           WHERE v.owner_id = $1
             AND i.created_at >= now() - interval '7 days'
           ORDER BY i.created_at DESC
           LIMIT 25`,
          [id]
        )
      : Promise.resolve({ rows: [] }),
    query(
      `SELECT sanction_id, type, level, status, reason, effective_from, effective_until, decided_at
       FROM sanctions
       WHERE owner_id = $1 AND status = 'ACTIVE'
       ORDER BY decided_at DESC`,
      [id]
    )
  ]);

  const owner = hasRole(req, "ANALISA")
    ? ownerResult.rows[0]
    : {
        owner_id: ownerResult.rows[0].owner_id,
        owner_type: ownerResult.rows[0].owner_type,
        name: ownerResult.rows[0].name,
        status: ownerResult.rows[0].status,
        created_at: ownerResult.rows[0].created_at,
        phone_primary: null,
        email: null,
        base_name: null,
        base_lat: null,
        base_lon: null
      };

  if (hasRole(req, "ANALISA")) {
    await auditLog(req, { action: "READ_OWNER_DETAIL", entityType: "owner", entityId: id });
  }
  return res.json({
    owner,
    vehicles: vehiclesResult.rows,
    risk_context: riskSummaryResult.rows[0] || null,
    incidents_7d: incidentResult.rows,
    active_sanctions: sanctionResult.rows,
    active_sanction_count: sanctionResult.rows.length
  });
}));

app.post("/owners", auth, requireRole(["ANALISA"]), validate(ownerSchema), asyncHandler(async (req, res) => {
  const { owner_type, name, phone_primary, email, base, base_name, base_lat, base_lon } = req.body || {};

  const baseName = base?.name ?? base_name ?? null;
  const baseLat = base?.lat ?? base_lat ?? null;
  const baseLon = base?.lon ?? base_lon ?? null;

  const { rows } = await query(
    `INSERT INTO owners (owner_type, name, phone_primary, email, base_name, base_lat, base_lon)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING owner_id`,
    [owner_type, name, phone_primary || null, email || null, baseName, baseLat, baseLon]
  );

  await auditLog(req, { action: "CREATE_OWNER", entityType: "owner", entityId: rows[0].owner_id });
  res.json({ owner_id: rows[0].owner_id });
}));

app.patch("/owners/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { owner_type, name, phone_primary, email, base_name, base_lat, base_lon, status } = req.body || {};

  const { rows } = await query(
    `UPDATE owners
     SET owner_type = COALESCE($1, owner_type),
         name = COALESCE($2, name),
         phone_primary = COALESCE($3, phone_primary),
         email = COALESCE($4, email),
         base_name = COALESCE($5, base_name),
         base_lat = COALESCE($6, base_lat),
         base_lon = COALESCE($7, base_lon),
         status = COALESCE($8, status)
     WHERE owner_id = $9
     RETURNING owner_id`,
    [owner_type, name, phone_primary, email, base_name, base_lat, base_lon, status, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Owner not found" } });
  }

  await auditLog(req, { action: "UPDATE_OWNER", entityType: "owner", entityId: id });
  res.json({ owner_id: rows[0].owner_id });
}));

app.get("/vehicles", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { params, whereClause, paginationClause, hasPagination, page, limit } = createVehicleListScope(req.query);
  const { rows } = await query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        v.vehicle_code,
        v.status,
        v.brand,
        v.model,
        v.year,
        v.color,
        v.capacity,
        o.name AS owner_name,
        vl.ts AS last_ping,
        COALESCE(mp.snapped_lat, vl.lat) AS lat,
        COALESCE(mp.snapped_lon, vl.lon) AS lon,
        COALESCE(vl.speed_kmh, 0)::float AS speed,
        COALESCE(mp.matched_heading, vl.heading)::float AS heading,
        mp.match_status,
        mp.confidence::float AS match_confidence,
        mp.snap_distance_m::float AS snap_distance_m,
        rs.current_score AS risk_score,
        rs.risk_level,
        (
          SELECT a.rule
          FROM alerts a
          WHERE a.vehicle_id = v.vehicle_id
            AND a.status IN ('OPEN', 'ESCALATED')
          ORDER BY a.last_seen_at DESC
          LIMIT 1
        ) AS alert_status,
        COUNT(*) OVER()::int AS total_count
     FROM vehicles v
     LEFT JOIN owners o ON o.owner_id = v.owner_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     LEFT JOIN telemetry_matched_positions mp
       ON mp.vehicle_id = vl.vehicle_id
      AND mp.ts = vl.ts
      AND mp.match_status = 'MATCHED'
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     ${whereClause}
     ORDER BY v.plate_no
     ${paginationClause}`,
    params
  );

  const { total, items } = stripTotalCount(rows);
  res.json({ items, total, ...(hasPagination ? { page, limit } : {}) });
}));

app.post("/vehicles", auth, requireRole(["ANALISA"]), validate(vehicleSchema), asyncHandler(async (req, res) => {
  const { owner_id, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity } = req.body || {};

  const { rows } = await query(
    `INSERT INTO vehicles (owner_id, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING vehicle_id`,
    [owner_id, plate_no, route_id, vehicle_code || null, status || "OUT_OF_SERVICE", brand || null, model || null, year || null, color || null, capacity || null]
  );
  await auditLog(req, { action: "CREATE_VEHICLE", entityType: "vehicle", entityId: rows[0].vehicle_id });
  res.json({ vehicle_id: rows[0].vehicle_id });
}));

app.patch("/vehicles/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { owner_id, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity } = req.body || {};

  const { rows } = await query(
    `UPDATE vehicles
     SET owner_id = COALESCE($1, owner_id),
         plate_no = COALESCE($2, plate_no),
         route_id = COALESCE($3, route_id),
         vehicle_code = COALESCE($4, vehicle_code),
         status = COALESCE($5, status),
         brand = COALESCE($6, brand),
         model = COALESCE($7, model),
         year = COALESCE($8, year),
         color = COALESCE($9, color),
         capacity = COALESCE($10, capacity)
     WHERE vehicle_id = $11
     RETURNING vehicle_id`,
    [owner_id, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Vehicle not found" } });
  }
  await auditLog(req, { action: "UPDATE_VEHICLE", entityType: "vehicle", entityId: id });
  res.json({ vehicle_id: rows[0].vehicle_id });
}));

app.get("/incidents", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const filters = [];
  const params = [];

  if (req.query.status) {
    params.push(req.query.status);
    filters.push(`i.status = $${params.length}`);
  }
  if (req.query.severity) {
    params.push(req.query.severity);
    filters.push(`i.severity = $${params.length}`);
  }
  if (req.query.type) {
    params.push(req.query.type);
    filters.push(`i.type = $${params.length}`);
  }
  if (req.query.vehicle_id) {
    params.push(req.query.vehicle_id);
    filters.push(`i.vehicle_id = $${params.length}`);
  }
  if (req.query.owner_id) {
    params.push(req.query.owner_id);
    filters.push(`v.owner_id = $${params.length}`);
  }
  if (req.query.search) {
    const searchTerm = `%${req.query.search.toLowerCase()}%`;
    params.push(searchTerm);
    filters.push(`(
      LOWER(i.incident_id::text) LIKE $${params.length}
      OR LOWER(v.plate_no) LIKE $${params.length}
      OR LOWER(COALESCE(v.route_id, '')) LIKE $${params.length}
      OR LOWER(i.type) LIKE $${params.length}
      OR LOWER(COALESCE(i.description, '')) LIKE $${params.length}
    )`);
  }

  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const requestedLimit = Number(req.query.limit || 100);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 200) : 100;
  params.push(limit);

  const { rows } = await query(
    `SELECT
        i.incident_id,
        i.type,
        i.severity,
        i.status,
        i.description,
        i.location_desc,
        i.lat,
        i.lon,
        i.created_at,
        i.assigned_to,
        i.acknowledged_at,
        i.resolved_at,
        i.vehicle_id,
        ua.full_name AS assigned_name,
        v.plate_no,
        v.route_id
     FROM incidents i
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     LEFT JOIN users ua ON ua.user_id = i.assigned_to
     ${whereClause}
     ORDER BY i.created_at DESC
     LIMIT $${params.length}`,
    params
  );

  const items = rows.map((row) => ({
    id: row.incident_id,
    type: row.type,
    severity: row.severity,
    status: row.status,
    description: row.description,
    location: locationLabel({ locationDesc: row.location_desc, lat: row.lat, lon: row.lon }),
    lat: row.lat,
    lon: row.lon,
    timestamp: row.created_at,
    assigned_to: row.assigned_to,
    assigned_name: row.assigned_name,
    vehicle_id: row.vehicle_id,
    acknowledged_at: row.acknowledged_at,
    resolved_at: row.resolved_at,
    vehicle_plate: row.plate_no,
    route_id: row.route_id
  }));

  res.json({ items });
}));

app.get("/incidents/sla", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const reportDate = req.query.date || null;
  const params = [];
  let where = "";
  if (reportDate) {
    params.push(reportDate);
    where = "WHERE (i.created_at AT TIME ZONE 'Asia/Jakarta')::date = $1";
  }

  const { rows } = await query(
    `SELECT
        i.incident_id,
        i.type,
        i.severity,
        i.status,
        i.created_at,
        i.acknowledged_at,
        i.resolved_at,
        v.plate_no,
        v.route_id
     FROM incidents i
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     ${where}
     ORDER BY i.created_at DESC`,
    params
  );

  const items = rows.map((row) => {
    const createdAt = new Date(row.created_at).getTime();
    const ackAt = row.acknowledged_at ? new Date(row.acknowledged_at).getTime() : null;
    const resolvedAt = row.resolved_at ? new Date(row.resolved_at).getTime() : null;
    const ackMinutes = ackAt ? Math.round((ackAt - createdAt) / 60000) : null;
    const resolveMinutes = resolvedAt ? Math.round((resolvedAt - createdAt) / 60000) : null;
    return {
      incident_id: row.incident_id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      created_at: row.created_at,
      acknowledged_at: row.acknowledged_at,
      resolved_at: row.resolved_at,
      plate_no: row.plate_no,
      route_id: row.route_id,
      ack_minutes: ackMinutes,
      resolve_minutes: resolveMinutes,
      ack_breached: ackMinutes !== null ? ackMinutes > slaAckMinutes : false,
      resolve_breached: resolveMinutes !== null ? resolveMinutes > slaResolveMinutes : false
    };
  });

  const summary = {
    total: items.length,
    ack_breached: items.filter((item) => item.ack_breached).length,
    resolve_breached: items.filter((item) => item.resolve_breached).length,
    missing_ack: items.filter((item) => item.ack_minutes === null).length,
    missing_resolve: items.filter((item) => item.resolve_minutes === null).length
  };

  await auditLog(req, { action: "READ_INCIDENT_SLA", entityType: "incident", metadata: { date: reportDate } });
  res.json({ items, summary, sla: { ack_minutes: slaAckMinutes, resolve_minutes: slaResolveMinutes } });
}));

app.get("/incidents/:id", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const incidentResult = await query(
    `SELECT
        i.incident_id,
        i.type,
        i.severity,
        i.status,
        i.description,
        i.location_desc,
        i.lat,
        i.lon,
        i.created_at,
        i.assigned_to,
        i.acknowledged_at,
        i.resolved_at,
        v.plate_no,
        v.route_id,
        ua.full_name AS assigned_name
     FROM incidents i
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     LEFT JOIN users ua ON ua.user_id = i.assigned_to
     WHERE i.incident_id = $1`,
    [id]
  );

  if (!incidentResult.rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Incident not found" } });
  }

  const actionsResult = await query(
    `SELECT
        ia.action_id,
        ia.action,
        ia.notes,
        ia.created_at,
        u.full_name AS actor_name
     FROM incident_actions ia
     LEFT JOIN users u ON u.user_id = ia.actor_id
     WHERE ia.incident_id = $1
     ORDER BY ia.created_at DESC`,
    [id]
  );

  await auditLog(req, { action: "READ_INCIDENT_DETAIL", entityType: "incident", entityId: id });
  res.json({ incident: incidentResult.rows[0], actions: actionsResult.rows });
}));

app.post("/incidents/:id/proofs", auth, requireRole(["OPERATOR", "ANALISA", "PETUGAS_LAPANGAN"]), uploadEmergencyProof, asyncHandler(async (req, res) => {
  if (!isObjectStorageConfigured()) {
    return res.status(503).json({ error: { code: "STORAGE_UNAVAILABLE", message: "Object storage is not configured" } });
  }

  const { id } = req.params;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "proof file required" } });
  }

  const incidentResult = await query(
    `SELECT incident_id, status, assigned_to
     FROM incidents
     WHERE incident_id = $1`,
    [id]
  );
  if (!incidentResult.rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Incident not found" } });
  }

  const incident = incidentResult.rows[0];
  const fieldOnly = hasRole(req, "PETUGAS_LAPANGAN") && !hasRole(req, "OPERATOR") && !hasRole(req, "ANALISA");
  if (fieldOnly && String(incident.assigned_to || "") !== String(req.user.user_id)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Field officer can upload proof only for assigned incidents" } });
  }
  if (["RESOLVED", "FALSE_ALARM", "CLOSED"].includes(incident.status)) {
    return res.status(409).json({ error: { code: "INCIDENT_CLOSED", message: "Incident is already closed" } });
  }

  const validation = await validatePublicReportEvidenceImage(file);
  const proofId = crypto.randomUUID();
  const bucketName = getPublicReportBucket();
  const ext = publicReportExtByMime[validation.contentType] || validation.extension;
  const key = `emergency-proofs/${new Date().toISOString().slice(0, 10)}/${id}/${proofId}.${ext}`;

  await putBufferObject({
    bucketName,
    key,
    buffer: validation.buffer,
    contentType: validation.contentType,
    metadata: {
      "incident-id": id,
      "proof-id": proofId,
      "uploaded-by": req.user.user_id,
      "image-width": String(validation.width),
      "image-height": String(validation.height),
      "original-file-size": String(validation.originalSize)
    }
  });

  const metadata = {
    proof_id: proofId,
    bucket: bucketName,
    object_key: key,
    content_type: validation.contentType,
    file_size_bytes: validation.size,
    original_filename: file.originalname || null
  };

  await query(
    `INSERT INTO incident_actions (incident_id, action, actor_id, notes, metadata)
     VALUES ($1, 'PROOF_UPLOAD', $2, $3, $4)`,
    [id, req.user.user_id, req.body?.notes || "Bukti lapangan diunggah.", JSON.stringify(metadata)]
  );
  await auditLog(req, { action: "INCIDENT_PROOF_UPLOAD", entityType: "incident", entityId: id, metadata });

  res.status(201).json({ ok: true, proof: metadata });
}));

// --- HIGH-03: Add requireRole to prevent IDOR — only internal responders can modify incidents ---
app.post("/incidents/:id/actions", auth, requireRole(["OPERATOR", "ANALISA", "PETUGAS_LAPANGAN"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, notes, assigned_to, navigation_context, proof_url, proof_urls, resolution_notes, escalation_target } = req.body || {};
  if (!action) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "action required" } });
  }

  const actionUpper = String(action).toUpperCase();
  const allowedActions = new Set(["ACKNOWLEDGE", "ASSIGN", "RESOLVE", "FALSE_ALARM", "PROOF_UPLOAD", "ESCALATE"]);
  if (!allowedActions.has(actionUpper)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Unsupported incident action" } });
  }
  if (actionUpper === "ASSIGN" && !assigned_to) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "assigned_to required for ASSIGN" } });
  }

  if (assigned_to) {
    const assigneeResult = await query("SELECT user_id FROM users WHERE user_id = $1 AND is_active = true", [assigned_to]);
    if (!assigneeResult.rows.length) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assignee not found or inactive" } });
    }
  }

  let statusUpdate = null;
  let ackAt = null;
  let resolveAt = null;

  if (actionUpper === "ACKNOWLEDGE") {
    statusUpdate = "IN_PROGRESS";
    ackAt = new Date();
  }
  if (actionUpper === "ASSIGN") {
    statusUpdate = "IN_PROGRESS";
    ackAt = new Date();
  }
  if (actionUpper === "RESOLVE") {
    statusUpdate = "RESOLVED";
    resolveAt = new Date();
  }
  if (actionUpper === "FALSE_ALARM") {
    statusUpdate = "FALSE_ALARM";
    resolveAt = new Date();
  }
  if (actionUpper === "ESCALATE") {
    statusUpdate = "IN_PROGRESS";
    ackAt = new Date();
  }

  const proofUrls = Array.isArray(proof_urls)
    ? proof_urls.map((item) => String(item)).filter(Boolean)
    : proof_url
      ? [String(proof_url)]
      : [];
  const actionMetadata = {
    assigned_to: assigned_to || null,
    navigation_context: navigation_context || null,
    proof_urls: proofUrls,
    resolution_notes: resolution_notes || null,
    escalation_target: escalation_target || null
  };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const incidentResult = await client.query(
      `SELECT incident_id, status, assigned_to
       FROM incidents
       WHERE incident_id = $1
       FOR UPDATE`,
      [id]
    );

    if (!incidentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Incident not found" } });
    }

    const currentStatus = incidentResult.rows[0].status;
    if (["RESOLVED", "FALSE_ALARM"].includes(currentStatus)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ error: { code: "INCIDENT_CLOSED", message: "Incident is already closed" } });
    }

    const fieldOnly = hasRole(req, "PETUGAS_LAPANGAN") && !hasRole(req, "OPERATOR") && !hasRole(req, "ANALISA");
    if (fieldOnly && String(incidentResult.rows[0].assigned_to || "") !== String(req.user.user_id)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Field officer can update only assigned incidents" } });
    }
    if (fieldOnly && !["PROOF_UPLOAD", "RESOLVE"].includes(actionUpper)) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Field officer action not allowed" } });
    }

    await client.query(
      `INSERT INTO incident_actions (incident_id, action, actor_id, notes, metadata)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, actionUpper, req.user.user_id, notes || resolution_notes || null, JSON.stringify(actionMetadata)]
    );

    await client.query(
      `UPDATE incidents
       SET status = COALESCE($1, status),
           assigned_to = COALESCE($2, assigned_to),
           acknowledged_at = COALESCE(acknowledged_at, $3),
           resolved_at = COALESCE($4, resolved_at),
           escalation_state = CASE WHEN $5::text IS NULL THEN escalation_state ELSE $5 END,
           escalation_target = COALESCE($6, escalation_target),
           escalation_last_at = CASE WHEN $5::text IS NULL THEN escalation_last_at ELSE now() END
       WHERE incident_id = $7`,
      [
        statusUpdate,
        assigned_to || null,
        ackAt,
        resolveAt,
        actionUpper === "ESCALATE" ? "MANUAL_ESCALATED" : null,
        escalation_target || null,
        id
      ]
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  await auditLog(req, { action: `INCIDENT_${actionUpper}`, entityType: "incident", entityId: id, metadata: actionMetadata });
  res.json({ ok: true });
}));

const mapNotificationRow = (row) => ({
  notification_id: row.notification_id,
  incident_id: row.incident_id,
  channel: row.channel,
  status: row.status,
  payload: row.payload || {},
  created_at: row.created_at,
  read_at: row.read_at,
  read_by: row.read_by,
  type: row.type,
  severity: row.severity,
  incident_status: row.incident_status,
  vehicle_plate: row.plate_no,
  route_id: row.route_id,
  location: row.location_desc,
  message: row.payload?.message || row.description || row.type || "Notifikasi operasional"
});

const fetchNotifications = async ({ limit = 20, unreadOnly = false, since = null } = {}) => {
  const params = [];
  const conditions = [];
  if (unreadOnly) conditions.push("n.read_at IS NULL");
  if (since) {
    params.push(since);
    conditions.push(`n.created_at > $${params.length}`);
  }
  params.push(limit);
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const { rows } = await query(
    `SELECT
        n.notification_id,
        n.incident_id,
        n.channel,
        n.status,
        n.payload,
        n.created_at,
        n.read_at,
        n.read_by,
        i.type,
        i.severity,
        i.status AS incident_status,
        i.description,
        i.location_desc,
        v.plate_no,
        v.route_id
     FROM notifications n
     LEFT JOIN incidents i ON i.incident_id = n.incident_id
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     ${where}
     ORDER BY n.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return rows.map(mapNotificationRow);
};

const fetchUnreadNotificationCount = async () => {
  const { rows } = await query("SELECT COUNT(*)::int AS total FROM notifications WHERE read_at IS NULL");
  return rows[0]?.total || 0;
};

app.get("/notifications", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const requestedLimit = Number(req.query.limit || 20);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.floor(requestedLimit), 1), 50) : 20;
  const unreadOnly = req.query.unread === "true";
  const items = await fetchNotifications({ limit, unreadOnly });
  const unread = await fetchUnreadNotificationCount();
  res.json({ items, unread });
}));

app.post("/notifications/read", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean).map(String) : [];
  if (ids.length > 0) {
    await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now()),
           read_by = COALESCE(read_by, $1)
       WHERE notification_id = ANY($2::uuid[])`,
      [req.user.user_id, ids]
    );
  } else {
    await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, now()),
           read_by = COALESCE(read_by, $1)
       WHERE read_at IS NULL`,
      [req.user.user_id]
    );
  }
  await auditLog(req, { action: "NOTIFICATIONS_MARK_READ", entityType: "notification", metadata: { count: ids.length || "all" } });
  res.json({ ok: true, unread: await fetchUnreadNotificationCount() });
}));

app.get("/drivers", auth, requireRole(["ANALISA"]), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT driver_id, name, phone, sim_no, sim_expiry, status, created_at
     FROM drivers
     ORDER BY created_at DESC`
  );
  res.json({ items: rows });
}));

app.post("/drivers", auth, requireRole(["ANALISA"]), validate(driverSchema), asyncHandler(async (req, res) => {
  const { name, phone, sim_no, sim_expiry, sim_valid_until, status } = req.body || {};
  const simExpiry = sim_expiry || sim_valid_until || null;

  const { rows } = await query(
    `INSERT INTO drivers (name, phone, sim_no, sim_expiry, status)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING driver_id`,
    [name, phone || null, sim_no || null, simExpiry, status || "ACTIVE"]
  );

  res.json({ driver_id: rows[0].driver_id });
}));

app.patch("/drivers/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, sim_no, sim_expiry, status } = req.body || {};

  const { rows } = await query(
    `UPDATE drivers
     SET name = COALESCE($1, name),
         phone = COALESCE($2, phone),
         sim_no = COALESCE($3, sim_no),
         sim_expiry = COALESCE($4, sim_expiry),
         status = COALESCE($5, status)
     WHERE driver_id = $6
     RETURNING driver_id`,
    [name, phone, sim_no, sim_expiry, status, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Driver not found" } });
  }

  res.json({ driver_id: rows[0].driver_id });
}));

app.delete("/drivers/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Soft delete - set status to INACTIVE instead of hard delete
  const { rows } = await query(
    `UPDATE drivers SET status = 'INACTIVE' WHERE driver_id = $1 RETURNING driver_id`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Driver not found" } });
  }

  await auditLog(req, { action: "DELETE_DRIVER", entityType: "driver", entityId: id });
  res.json({ deleted: true, driver_id: rows[0].driver_id });
}));

app.get("/devices", auth, requireRole(["ANALISA"]), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT device_id, device_type, imei_or_serial, provider, status, created_at
     FROM devices
     ORDER BY created_at DESC`
  );
  res.json({ items: rows });
}));

app.get("/devices/health", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
        d.device_id,
        d.device_type,
        d.imei_or_serial,
        d.provider,
        d.status,
        a.vehicle_id,
        v.plate_no,
        v.route_id,
        vl.ts AS last_ping,
        COALESCE(movement.impossible_movement_count_24h, 0)::int AS impossible_movement_count_24h,
        COALESCE(power_signal.power_disconnect_count_24h, 0)::int AS power_disconnect_count_24h,
        power_signal.last_power_disconnect_at,
        (
          SELECT COUNT(*)::int
          FROM assignments history
          WHERE history.device_id = d.device_id
            AND history.created_at >= now() - interval '30 days'
        ) AS reassignment_count_30d
     FROM devices d
     LEFT JOIN assignments a ON a.device_id = d.device_id AND a.is_active = true
     LEFT JOIN vehicles v ON v.vehicle_id = a.vehicle_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     LEFT JOIN LATERAL (
       SELECT COUNT(*)::int AS impossible_movement_count_24h
       FROM (
         SELECT
           ts,
           lat,
           lon,
           LAG(ts) OVER (ORDER BY ts) AS prev_ts,
           LAG(lat) OVER (ORDER BY ts) AS prev_lat,
           LAG(lon) OVER (ORDER BY ts) AS prev_lon
         FROM vehicle_positions
         WHERE vehicle_id = v.vehicle_id
           AND ts >= now() - interval '24 hours'
       ) jumps
       WHERE prev_ts IS NOT NULL
         AND EXTRACT(EPOCH FROM (ts - prev_ts)) > 0
         AND (
           ST_Distance(
             ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography,
             ST_SetSRID(ST_MakePoint(prev_lon, prev_lat), 4326)::geography
           ) / NULLIF(EXTRACT(EPOCH FROM (ts - prev_ts)), 0)
         ) * 3.6 > $1::double precision
     ) movement ON true
     LEFT JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE power_connected = false)::int AS power_disconnect_count_24h,
         MAX(ts) FILTER (WHERE power_connected = false) AS last_power_disconnect_at
       FROM vehicle_positions
       WHERE vehicle_id = v.vehicle_id
         AND ts >= now() - interval '24 hours'
     ) power_signal ON true
     ORDER BY d.created_at DESC`,
    [deviceTamperImpossibleSpeedKmh]
  );

  const repeatedIdentityMismatchCounts = await Promise.all(rows.map(async (row) => {
    const metricKey = telemetryIdentityMetricKey(row.imei_or_serial);
    if (!metricKey) return 0;
    return Number(await getRollingMetricCount(metricKey, { windowMs: DEVICE_TAMPER_METRIC_WINDOW_MS }) || 0);
  }));

  const now = Date.now();
  const items = rows.map((row, index) => {
    const lastPing = row.last_ping ? new Date(row.last_ping).getTime() : null;
    const minutesSince = lastPing ? Math.round((now - lastPing) / 60000) : null;
    const online = minutesSince !== null && minutesSince <= deviceOfflineMinutes;
    const stale = Boolean(row.vehicle_id && !online);
    const noTelemetry = Boolean(row.vehicle_id && !row.last_ping);
    const frequentlyReassigned = Number(row.reassignment_count_30d || 0) >= 3;
    const lastPowerDisconnect = row.last_power_disconnect_at
      ? new Date(row.last_power_disconnect_at).getTime()
      : null;
    const powerDisconnectThenLostSignal = Boolean(
      row.vehicle_id
      && stale
      && lastPing
      && lastPowerDisconnect
      && Math.abs(lastPing - lastPowerDisconnect) <= 1000
    );
    const impossibleMovementCount = Number(row.impossible_movement_count_24h || 0);
    const repeatedIdentityMismatchCount = repeatedIdentityMismatchCounts[index] || 0;
    const tamperCandidate = buildDeviceTamperCandidate({
      powerDisconnectThenLostSignal,
      impossibleMovementCount,
      repeatedIdentityMismatchCount,
      repeatedIdentityMismatchThreshold: deviceTamperIdentityMismatchThreshold,
      noTelemetry,
      frequentlyReassigned
    });

    return {
      device_id: row.device_id,
      device_type: row.device_type,
      imei_or_serial: row.imei_or_serial,
      provider: row.provider,
      status: row.status,
      vehicle_id: row.vehicle_id,
      plate_no: row.plate_no,
      route_id: row.route_id,
      last_ping: row.last_ping,
      minutes_since: minutesSince,
      health: online ? "ONLINE" : "OFFLINE",
      reassignment_count_30d: row.reassignment_count_30d,
      no_telemetry: noTelemetry,
      frequently_reassigned: frequentlyReassigned,
      impossible_movement_count_24h: impossibleMovementCount,
      power_disconnect_count_24h: Number(row.power_disconnect_count_24h || 0),
      last_power_disconnect_at: row.last_power_disconnect_at,
      power_disconnect_then_lost_signal: powerDisconnectThenLostSignal,
      repeated_identity_mismatch_count_24h: repeatedIdentityMismatchCount,
      anomaly_candidate: tamperCandidate
    };
  });

  const offlineTrendResult = await query(
    `SELECT
        bucket,
        COUNT(*)::int AS telemetry_count,
        COUNT(DISTINCT vehicle_id)::int AS active_vehicle_count
     FROM (
       SELECT date_trunc('hour', ts) AS bucket, vehicle_id
       FROM vehicle_positions
       WHERE ts >= now() - interval '24 hours'
     ) recent
     GROUP BY bucket
     ORDER BY bucket`
  );

  const summary = {
    total_devices: items.length,
    online_devices: items.filter((item) => item.health === "ONLINE").length,
    offline_devices: items.filter((item) => item.health === "OFFLINE").length,
    no_telemetry_devices: items.filter((item) => item.no_telemetry).length,
    frequently_reassigned_devices: items.filter((item) => item.frequently_reassigned).length,
    impossible_movement_devices: items.filter((item) => item.impossible_movement_count_24h > 0).length,
    power_disconnect_lost_signal_devices: items.filter((item) => item.power_disconnect_then_lost_signal).length,
    repeated_identity_mismatch_devices: items.filter((item) => item.repeated_identity_mismatch_count_24h >= deviceTamperIdentityMismatchThreshold).length,
    device_tamper_candidates: items.filter((item) => item.anomaly_candidate).length,
    device_tamper_identity_mismatch_threshold: deviceTamperIdentityMismatchThreshold,
    device_tamper_impossible_speed_kmh: deviceTamperImpossibleSpeedKmh,
    offline_threshold_min: deviceOfflineMinutes,
    offline_trend: offlineTrendResult.rows
  };

  await auditLog(req, { action: "READ_DEVICE_HEALTH", entityType: "device" });
  res.json({ items, summary, offline_threshold_min: deviceOfflineMinutes });
}));

app.post("/devices", auth, requireRole(["ANALISA"]), validate(deviceSchema), asyncHandler(async (req, res) => {
  const { device_type, imei_or_serial, provider, status } = req.body || {};

  const { rows } = await query(
    `INSERT INTO devices (device_type, imei_or_serial, provider, status)
     VALUES ($1, $2, $3, $4)
     RETURNING device_id`,
    [device_type, imei_or_serial, provider || null, status || "ACTIVE"]
  );

  await auditLog(req, { action: "CREATE_DEVICE", entityType: "device", entityId: rows[0].device_id });
  res.json({ device_id: rows[0].device_id });
}));

app.patch("/devices/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { device_type, imei_or_serial, provider, status } = req.body || {};

  const { rows } = await query(
    `UPDATE devices
     SET device_type = COALESCE($1, device_type),
         imei_or_serial = COALESCE($2, imei_or_serial),
         provider = COALESCE($3, provider),
         status = COALESCE($4, status)
     WHERE device_id = $5
     RETURNING device_id`,
    [device_type, imei_or_serial, provider, status, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Device not found" } });
  }

  await auditLog(req, { action: "UPDATE_DEVICE", entityType: "device", entityId: id });
  res.json({ device_id: rows[0].device_id });
}));

app.delete("/devices/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Soft delete - set status to DEACTIVATED instead of hard delete
  const { rows } = await query(
    `UPDATE devices SET status = 'DEACTIVATED' WHERE device_id = $1 RETURNING device_id`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Device not found" } });
  }

  await auditLog(req, { action: "DELETE_DEVICE", entityType: "device", entityId: id });
  res.json({ deleted: true, device_id: rows[0].device_id });
}));

app.get("/assignments", auth, requireRole(["ANALISA"]), asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT
        a.assignment_id,
        a.shift_name,
        a.shift_start,
        a.shift_end,
        a.days_of_week,
        a.is_active,
        v.vehicle_id,
        v.plate_no,
        d.driver_id,
        d.name AS driver_name,
        dev.device_id,
        dev.imei_or_serial
     FROM assignments a
     LEFT JOIN vehicles v ON v.vehicle_id = a.vehicle_id
     LEFT JOIN drivers d ON d.driver_id = a.driver_id
     LEFT JOIN devices dev ON dev.device_id = a.device_id
     ORDER BY a.created_at DESC`
  );
  res.json({ items: rows });
}));

app.post("/assignments", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { vehicle_id, driver_id, device_id, shift_name, shift_start, shift_end, days_of_week, is_active } = req.body || {};
  if (!vehicle_id) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "vehicle_id required" } });
  }

  const active = is_active !== undefined ? Boolean(is_active) : true;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const vehicleResult = await client.query("SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1", [vehicle_id]);
    if (!vehicleResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Vehicle not found" } });
    }

    if (driver_id) {
      const driverResult = await client.query("SELECT driver_id FROM drivers WHERE driver_id = $1 AND status = 'ACTIVE'", [driver_id]);
      if (!driverResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Driver not found or inactive" } });
      }
    }

    if (device_id) {
      const deviceResult = await client.query("SELECT device_id FROM devices WHERE device_id = $1 AND status <> 'DEACTIVATED'", [device_id]);
      if (!deviceResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Device not found or deactivated" } });
      }

      const activeDeviceResult = await client.query(
        `SELECT assignment_id
         FROM assignments
         WHERE device_id = $1
           AND is_active = true
           AND vehicle_id <> $2
         LIMIT 1`,
        [device_id, vehicle_id]
      );
      if (activeDeviceResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: { code: "DEVICE_ASSIGNED", message: "Device is already assigned to another vehicle" } });
      }
    }

    if (active) {
      const previous = await client.query(
        `UPDATE assignments
         SET is_active = false
         WHERE vehicle_id = $1
           AND is_active = true
         RETURNING device_id`,
        [vehicle_id]
      );
      const previousDeviceIds = previous.rows.map((row) => row.device_id).filter(Boolean);
      if (previousDeviceIds.length) {
        await client.query(
          `UPDATE devices
           SET status = 'AVAILABLE'
           WHERE device_id = ANY($1::uuid[])`,
          [previousDeviceIds]
        );
      }
    }

    const { rows } = await client.query(
      `INSERT INTO assignments (vehicle_id, driver_id, device_id, shift_name, shift_start, shift_end, days_of_week, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING assignment_id`,
      [
        vehicle_id,
        driver_id || null,
        device_id || null,
        shift_name || null,
        shift_start || null,
        shift_end || null,
        days_of_week || null,
        active
      ]
    );

    if (device_id) {
      await client.query("UPDATE devices SET status = $1 WHERE device_id = $2", [active ? "ASSIGNED" : "AVAILABLE", device_id]);
    }

    await client.query("COMMIT");
    await auditLog(req, { action: "CREATE_ASSIGNMENT", entityType: "assignment", entityId: rows[0].assignment_id });
    res.json({ assignment_id: rows[0].assignment_id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.patch("/assignments/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { vehicle_id, driver_id, device_id, shift_name, shift_start, shift_end, days_of_week, is_active } = req.body || {};

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const currentResult = await client.query(
      `SELECT assignment_id, vehicle_id, device_id, is_active
       FROM assignments
       WHERE assignment_id = $1
       FOR UPDATE`,
      [id]
    );
    if (!currentResult.rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Assignment not found" } });
    }

    const current = currentResult.rows[0];
    const nextVehicleId = vehicle_id || current.vehicle_id;
    const nextDeviceId = device_id === undefined ? current.device_id : device_id || null;
    const nextActive = is_active === undefined ? current.is_active : Boolean(is_active);

    if (nextDeviceId) {
      const activeDeviceResult = await client.query(
        `SELECT assignment_id
         FROM assignments
         WHERE device_id = $1
           AND is_active = true
           AND assignment_id <> $2
         LIMIT 1`,
        [nextDeviceId, id]
      );
      if (activeDeviceResult.rows.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({ error: { code: "DEVICE_ASSIGNED", message: "Device is already assigned to another active assignment" } });
      }
    }

    if (nextActive) {
      const previous = await client.query(
        `UPDATE assignments
         SET is_active = false
         WHERE vehicle_id = $1
           AND is_active = true
           AND assignment_id <> $2
         RETURNING device_id`,
        [nextVehicleId, id]
      );
      const previousDeviceIds = previous.rows.map((row) => row.device_id).filter(Boolean);
      if (previousDeviceIds.length) {
        await client.query(
          `UPDATE devices
           SET status = 'AVAILABLE'
           WHERE device_id = ANY($1::uuid[])`,
          [previousDeviceIds]
        );
      }
    }

    const { rows } = await client.query(
      `UPDATE assignments
       SET vehicle_id = COALESCE($1, vehicle_id),
           driver_id = COALESCE($2, driver_id),
           device_id = COALESCE($3, device_id),
           shift_name = COALESCE($4, shift_name),
           shift_start = COALESCE($5, shift_start),
           shift_end = COALESCE($6, shift_end),
           days_of_week = COALESCE($7, days_of_week),
           is_active = COALESCE($8, is_active)
       WHERE assignment_id = $9
       RETURNING assignment_id, device_id, is_active`,
      [vehicle_id, driver_id, device_id, shift_name, shift_start, shift_end, days_of_week, is_active, id]
    );

    if (current.device_id && current.device_id !== rows[0].device_id) {
      await client.query("UPDATE devices SET status = 'AVAILABLE' WHERE device_id = $1", [current.device_id]);
    }
    if (rows[0].device_id) {
      await client.query("UPDATE devices SET status = $1 WHERE device_id = $2", [rows[0].is_active ? "ASSIGNED" : "AVAILABLE", rows[0].device_id]);
    }

    await client.query("COMMIT");
    await auditLog(req, { action: "UPDATE_ASSIGNMENT", entityType: "assignment", entityId: id });
    res.json({ assignment_id: rows[0].assignment_id });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}));

app.get("/geofences", auth, requireOperatorDashboardRole, asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT geofence_id, name, type, route_id, ST_AsGeoJSON(geom) AS geom
     FROM geofences
     ORDER BY created_at DESC`
  );

  res.json({
    items: rows.map((row) => ({
      geofence_id: row.geofence_id,
      name: row.name,
      type: row.type,
      route_id: row.route_id,
      geom: row.geom ? JSON.parse(row.geom) : null
    }))
  });
}));

app.post("/geofences", auth, requireRole(["ANALISA"]), validate(geofenceSchema), asyncHandler(async (req, res) => {
  const { name, type, route_id, coordinates } = req.body || {};

  const { rows } = await query(
    `INSERT INTO geofences (name, type, route_id, geom)
     VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4))
     RETURNING geofence_id`,
    [name, type, route_id || null, JSON.stringify({ type: "Polygon", coordinates })]
  );

  await auditLog(req, { action: "CREATE_GEOFENCE", entityType: "geofence", entityId: rows[0].geofence_id });
  res.json({ geofence_id: rows[0].geofence_id });
}));

app.patch("/geofences/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, type, route_id, coordinates } = req.body || {};
  const { rows } = await query(
    `UPDATE geofences
     SET name = COALESCE($1, name),
         type = COALESCE($2, type),
         route_id = COALESCE($3, route_id),
         geom = CASE WHEN $4 IS NULL THEN geom ELSE ST_GeomFromGeoJSON($4) END
     WHERE geofence_id = $5
     RETURNING geofence_id`,
    [name || null, type || null, route_id || null, coordinates ? JSON.stringify({ type: "Polygon", coordinates }) : null, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Geofence not found" } });
  }

  await auditLog(req, { action: "UPDATE_GEOFENCE", entityType: "geofence", entityId: id });
  res.json({ geofence_id: rows[0].geofence_id });
}));

app.delete("/geofences/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `DELETE FROM geofences
     WHERE geofence_id = $1
     RETURNING geofence_id`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Geofence not found" } });
  }

  await auditLog(req, { action: "DELETE_GEOFENCE", entityType: "geofence", entityId: id });
  res.json({ ok: true });
}));

app.get("/reports/rit", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const reportDate = req.query.date || null;
  const rangeDays = req.query.days ? Number(req.query.days) : null;
  const rows = await loadRitReportRows({ reportDate, rangeDays });

  await auditLog(req, { action: "READ_REPORT_RIT", entityType: "report_rit", metadata: { date: reportDate, days: rangeDays } });
  res.json({ items: rows });
}));

app.get("/reports/rit/export", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const reportDate = req.query.date || null;
  const rangeDays = req.query.days ? Number(req.query.days) : null;
  const format = String(req.query.format || "csv").toLowerCase();
  const rows = await loadRitReportRows({ reportDate, rangeDays });
  const rawSuffix = reportDate || (rangeDays ? `${rangeDays}d` : "latest");
  const suffix = String(rawSuffix).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 50);

  await auditLog(req, {
    action: "EXPORT_REPORT_RIT",
    entityType: "report_rit",
    metadata: { date: reportDate, days: rangeDays, format, row_count: rows.length }
  });

  if (format === "pdf") {
    const pdf = buildSimplePdf({ title: `Laporan Rit - ${suffix}`, rows });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="rit-report-${suffix}.pdf"`);
    return res.send(pdf);
  }

  if (format !== "csv") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "format must be csv or pdf" } });
  }

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rit-report-${suffix}.csv"`);
  return res.send(buildRitCsv(rows));
}));

app.get("/routes", auth, requireOperatorDashboardRole, asyncHandler(async (_req, res) => {
  const routesResult = await query(
    `SELECT
        route_id,
        name,
        color,
        buffer_radius_m,
        ST_AsGeoJSON(outbound_geom) AS outbound,
        ST_AsGeoJSON(inbound_geom) AS inbound,
        ST_AsGeoJSON(
          ST_Buffer(
            ST_Union(outbound_geom, inbound_geom)::geography,
            buffer_radius_m
          )::geometry
        ) AS corridor
     FROM routes
     ORDER BY route_id`
  );
  const stopsResult = await query(
    `SELECT
        route_id,
        name,
        seq,
        ST_Y(geom) AS lat,
        ST_X(geom) AS lng
     FROM route_stops
     ORDER BY route_id, seq`
  );

  const stopsByRoute = stopsResult.rows.reduce((acc, stop) => {
    if (!acc[stop.route_id]) acc[stop.route_id] = [];
    acc[stop.route_id].push({
      name: stop.name,
      lat: Number(stop.lat),
      lng: Number(stop.lng),
      seq: stop.seq
    });
    return acc;
  }, {});

  const items = routesResult.rows.map((route) => ({
    route_id: route.route_id,
    name: route.name,
    color: route.color,
    buffer_radius_m: route.buffer_radius_m,
    outbound: route.outbound ? JSON.parse(route.outbound) : null,
    inbound: route.inbound ? JSON.parse(route.inbound) : null,
    corridor: route.corridor ? JSON.parse(route.corridor) : null,
    stops: stopsByRoute[route.route_id] || []
  }));

  res.json({ items });
}));

app.post("/routes", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { route_id, name, color, buffer_radius_m, outbound, inbound } = req.body || {};
  if (!route_id || !name) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "route_id, name required" } });
  }

  const bufferM = buffer_radius_m ? Number(buffer_radius_m) : 50;
  const outboundJson = outbound ? JSON.stringify(outbound) : null;
  const inboundJson = inbound ? JSON.stringify(inbound) : null;

  const { rows } = await query(
    `INSERT INTO routes (route_id, name, color, buffer_radius_m, outbound_geom, inbound_geom)
     VALUES ($1, $2, $3::text, $4::integer, 
       CASE WHEN $5::text IS NULL THEN NULL ELSE ST_GeomFromGeoJSON($5::text) END,
       CASE WHEN $6::text IS NULL THEN NULL ELSE ST_GeomFromGeoJSON($6::text) END)
     RETURNING route_id`,
    [route_id, name, color || null, bufferM, outboundJson, inboundJson]
  );

  await auditLog(req, { action: "CREATE_ROUTE", entityType: "route", entityId: rows[0].route_id });
  res.json({ route_id: rows[0].route_id });
}));

app.post("/routes/:id/corridor", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { buffer_radius_m } = req.body || {};
  const { rows } = await query(
    `UPDATE routes
     SET buffer_radius_m = COALESCE($1, buffer_radius_m)
     WHERE route_id = $2
     RETURNING route_id, buffer_radius_m`,
    [buffer_radius_m || null, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  }

  await auditLog(req, { action: "UPDATE_ROUTE_CORRIDOR", entityType: "route", entityId: id });
  res.json({ route_id: rows[0].route_id, buffer_radius_m: rows[0].buffer_radius_m });
}));

app.post("/map-matching/spike", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { route_id, lat, lon, off_route_threshold_m } = req.body || {};
  const numericLat = Number(lat);
  const numericLon = Number(lon);
  const thresholdM = Number(off_route_threshold_m || 50);

  if (!route_id || !Number.isFinite(numericLat) || !Number.isFinite(numericLon)) {
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "route_id, lat, dan lon wajib diisi untuk spike map matching."
      }
    });
  }

  const { rows } = await query(
    `WITH input AS (
       SELECT ST_SetSRID(ST_MakePoint($3, $2), 4326) AS point
     ),
     route AS (
       SELECT
         route_id,
         name,
         buffer_radius_m,
         CASE
           WHEN outbound_geom IS NOT NULL AND inbound_geom IS NOT NULL THEN ST_LineMerge(ST_Union(outbound_geom, inbound_geom))
           ELSE COALESCE(outbound_geom, inbound_geom)
         END AS route_geom
       FROM routes
       WHERE route_id = $1
     ),
     snapped AS (
       SELECT
         route.route_id,
         route.name,
         route.buffer_radius_m,
         input.point,
         route.route_geom,
         ST_ClosestPoint(route.route_geom, input.point) AS snapped_point
       FROM route
       CROSS JOIN input
       WHERE route.route_geom IS NOT NULL
     )
     SELECT
       route_id,
       name,
       buffer_radius_m,
       ST_Y(snapped_point) AS snapped_lat,
       ST_X(snapped_point) AS snapped_lon,
       ST_Distance(point::geography, snapped_point::geography)::float AS distance_m,
       ST_DWithin(point::geography, route_geom::geography, $4::double precision) AS within_threshold
     FROM snapped`,
    [route_id, numericLat, numericLon, thresholdM]
  );

  if (!rows.length) {
    return res.status(404).json({
      error: {
        code: "ROUTE_GEOMETRY_NOT_FOUND",
        message: "Route tidak ditemukan atau belum memiliki geometry untuk spike map matching."
      }
    });
  }

  const metricsResult = await query(
    `WITH route AS (
       SELECT
         route_id,
         CASE
           WHEN outbound_geom IS NOT NULL AND inbound_geom IS NOT NULL THEN ST_LineMerge(ST_Union(outbound_geom, inbound_geom))
           ELSE COALESCE(outbound_geom, inbound_geom)
         END AS route_geom
       FROM routes
       WHERE route_id = $1
     ),
     sampled_points AS (
       SELECT
         vp.vehicle_id,
         vp.ts,
         vp.geom,
         ST_Distance(vp.geom::geography, route.route_geom::geography)::float AS distance_m
       FROM vehicle_positions vp
       JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
       CROSS JOIN route
       WHERE v.route_id = $1
         AND vp.ts >= now() - interval '24 hours'
         AND route.route_geom IS NOT NULL
       ORDER BY vp.ts DESC
       LIMIT 500
     )
     SELECT
       COUNT(*)::int AS sampled_points,
       COUNT(*) FILTER (WHERE distance_m > $2::double precision)::int AS off_route_points_before_snap,
       0::int AS off_route_points_after_snap,
       ROUND(AVG(distance_m)::numeric, 2)::float AS avg_distance_m,
       ROUND(PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY distance_m)::numeric, 2)::float AS p95_distance_m,
       (
         SELECT COUNT(*)::int
         FROM anomalies a
         WHERE a.route_id = $1
           AND a.rule = 'OFF_ROUTE'
           AND a.started_at >= now() - interval '24 hours'
       ) AS off_route_anomalies_24h,
       (
         SELECT COUNT(*)::int
         FROM report_rit_daily rrd
         JOIN vehicles rv ON rv.vehicle_id = rrd.vehicle_id
         WHERE rv.route_id = $1
           AND rrd.report_date >= CURRENT_DATE - 7
       ) AS rit_report_rows_7d
     FROM sampled_points`,
    [route_id, thresholdM]
  );

  const result = rows[0];
  const metrics = metricsResult.rows[0] || {
    sampled_points: 0,
    off_route_points_before_snap: 0,
    off_route_points_after_snap: 0,
    avg_distance_m: null,
    p95_distance_m: null,
    off_route_anomalies_24h: 0,
    rit_report_rows_7d: 0
  };
  await auditLog(req, {
    action: "RUN_MAP_MATCHING_SPIKE",
    entityType: "route",
    entityId: route_id,
    metadata: { lat: numericLat, lon: numericLon, distance_m: result.distance_m }
  });
  res.json({
    route_id: result.route_id,
    route_name: result.name,
    input: { lat: numericLat, lon: numericLon },
    snapped: { lat: result.snapped_lat, lon: result.snapped_lon },
    distance_m: result.distance_m,
    off_route_threshold_m: thresholdM,
    within_threshold: result.within_threshold,
    recommendation: result.within_threshold
      ? "Point masih berada dalam threshold route; map matching berpotensi mengurangi false positive OFF_ROUTE."
      : "Point tetap di luar threshold setelah snap; cek route geometry atau evidence telemetry sebelum full integration.",
    impact_sample: {
      window: "24h telemetry sample, 7d rit report context",
      sampled_points: metrics.sampled_points,
      off_route_points_before_snap: metrics.off_route_points_before_snap,
      off_route_points_after_snap: metrics.off_route_points_after_snap,
      avg_distance_m: metrics.avg_distance_m,
      p95_distance_m: metrics.p95_distance_m,
      off_route_anomalies_24h: metrics.off_route_anomalies_24h,
      rit_report_rows_7d: metrics.rit_report_rows_7d
    },
    integration_status: {
      local_geometry_snap: "implemented_spike",
      osrm_local: "planned"
    }
  });
}));

app.patch("/routes/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, color, buffer_radius_m, outbound, inbound } = req.body || {};

  const bufferM = buffer_radius_m ? Number(buffer_radius_m) : null;
  const outboundJson = outbound ? JSON.stringify(outbound) : null;
  const inboundJson = inbound ? JSON.stringify(inbound) : null;

  const { rows } = await query(
    `UPDATE routes
     SET name = COALESCE($1::text, name),
         color = COALESCE($2::text, color),
         buffer_radius_m = COALESCE($3::integer, buffer_radius_m),
         outbound_geom = CASE WHEN $4::text IS NULL THEN outbound_geom ELSE ST_GeomFromGeoJSON($4::text) END,
         inbound_geom = CASE WHEN $5::text IS NULL THEN inbound_geom ELSE ST_GeomFromGeoJSON($5::text) END
     WHERE route_id = $6
     RETURNING route_id`,
    [name || null, color || null, bufferM, outboundJson, inboundJson, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  }

  await auditLog(req, { action: "UPDATE_ROUTE", entityType: "route", entityId: id });
  res.json({ route_id: rows[0].route_id });
}));

app.delete("/routes/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;

  const routeUsage = await query(
    `SELECT r.route_id, COUNT(v.vehicle_id)::int AS vehicle_count
     FROM routes r
     LEFT JOIN vehicles v ON v.route_id = r.route_id
     WHERE r.route_id = $1
     GROUP BY r.route_id`,
    [id]
  );

  if (!routeUsage.rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
  }

  if (routeUsage.rows[0].vehicle_count > 0) {
    return res.status(409).json({ error: { code: "ROUTE_HAS_VEHICLES", message: "Route masih dipakai kendaraan dan tidak bisa dihapus." } });
  }

  await query(`DELETE FROM route_stops WHERE route_id = $1`, [id]);

  const { rows } = await query(
    `DELETE FROM routes WHERE route_id = $1 RETURNING route_id`,
    [id]
  );

  await auditLog(req, { action: "DELETE_ROUTE", entityType: "route", entityId: id });
  res.json({ deleted: true, route_id: rows[0].route_id });
}));

app.get("/stops", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const routeId = req.query.route_id || null;
  const params = [];
  let where = "";
  if (routeId) {
    params.push(routeId);
    where = "WHERE route_id = $1";
  }

  const { rows } = await query(
    `SELECT stop_id, route_id, name, seq, ST_Y(geom) AS lat, ST_X(geom) AS lng
     FROM route_stops
     ${where}
     ORDER BY route_id, seq`,
    params
  );

  res.json({ items: rows });
}));

app.post("/stops", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { route_id, name, seq, lat, lng } = req.body || {};
  if (!route_id || !name || lat === undefined || lng === undefined) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "route_id, name, lat, lng required" } });
  }

  const { rows } = await query(
    `INSERT INTO route_stops (route_id, name, seq, geom)
     VALUES ($1, $2, $3, ST_SetSRID(ST_MakePoint($4, $5), 4326))
     RETURNING stop_id`,
    [route_id, name, seq || 0, lng, lat]
  );

  await auditLog(req, { action: "CREATE_STOP", entityType: "route_stop", entityId: rows[0].stop_id });
  res.json({ stop_id: rows[0].stop_id });
}));

app.patch("/stops/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, seq, lat, lng } = req.body || {};
  const { rows } = await query(
    `UPDATE route_stops
     SET name = COALESCE($1, name),
         seq = COALESCE($2, seq),
         geom = CASE WHEN $3 IS NULL OR $4 IS NULL THEN geom ELSE ST_SetSRID(ST_MakePoint($4, $3), 4326) END
     WHERE stop_id = $5
     RETURNING stop_id`,
    [name || null, seq ?? null, lat ?? null, lng ?? null, id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Stop not found" } });
  }

  await auditLog(req, { action: "UPDATE_STOP", entityType: "route_stop", entityId: id });
  res.json({ stop_id: rows[0].stop_id });
}));

app.delete("/stops/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `DELETE FROM route_stops
     WHERE stop_id = $1
     RETURNING stop_id`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Stop not found" } });
  }

  await auditLog(req, { action: "DELETE_STOP", entityType: "route_stop", entityId: id });
  res.json({ ok: true });
}));

app.get("/vehicles/:id", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        v.vehicle_code,
        v.status,
        v.brand,
        v.model,
        v.year,
        v.color,
        v.capacity,
        o.owner_id,
        o.name AS owner_name,
        o.owner_type,
        o.phone_primary,
        vl.ts AS last_ping,
        vl.lat,
        vl.lon,
        vl.speed_kmh::float AS speed,
        vl.heading,
        rs.current_score AS risk_score,
        rs.risk_level
     FROM vehicles v
     LEFT JOIN owners o ON o.owner_id = v.owner_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     WHERE v.vehicle_id = $1`,
    [id]
  );

  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Vehicle not found" } });
  }

  const [documentsResult, assignmentResult, sanctionCountResult] = await Promise.all([
    query(
      `SELECT document_id, doc_type, file_url, expiry_date
       FROM vehicle_documents
       WHERE vehicle_id = $1
       ORDER BY expiry_date NULLS LAST`,
      [id]
    ),
    query(
      `SELECT
          a.assignment_id,
          a.shift_name,
          a.shift_start,
          a.shift_end,
          a.days_of_week,
          d.driver_id,
          d.name AS driver_name,
          d.phone AS driver_phone,
          dev.device_id,
          dev.imei_or_serial,
          dev.device_type,
          dev.status AS device_status
       FROM assignments a
       LEFT JOIN drivers d ON d.driver_id = a.driver_id
       LEFT JOIN devices dev ON dev.device_id = a.device_id
       WHERE a.vehicle_id = $1
         AND a.is_active = true
       ORDER BY a.created_at DESC
       LIMIT 1`,
      [id]
    ),
    query(
      `SELECT COUNT(*)::int AS cnt FROM sanctions WHERE vehicle_id = $1 AND status = 'ACTIVE'`,
      [id]
    )
  ]);

  const vehicle = hasRole(req, "ANALISA")
    ? { ...rows[0], active_sanction_count: sanctionCountResult.rows[0]?.cnt || 0 }
    : {
        ...rows[0],
        phone_primary: null,
        active_sanction_count: sanctionCountResult.rows[0]?.cnt || 0
      };
  const assignment = assignmentResult.rows[0] || null;
  const visibleAssignment = !assignment || hasRole(req, "ANALISA")
    ? assignment
    : {
        ...assignment,
        driver_phone: null,
        imei_or_serial: null
      };

  await auditLog(req, {
    action: hasRole(req, "ANALISA") ? "READ_VEHICLE_DETAIL_SENSITIVE" : "READ_VEHICLE_DETAIL",
    entityType: "vehicle",
    entityId: id
  });
  res.json({
    vehicle,
    documents: hasRole(req, "ANALISA") ? documentsResult.rows : [],
    assignment: visibleAssignment
  });
}));

app.post("/vehicles/:id/documents", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { doc_type, file_url, expiry_date } = req.body || {};
  if (!doc_type) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "doc_type required" } });
  }

  const { rows } = await query(
    `INSERT INTO vehicle_documents (vehicle_id, doc_type, file_url, expiry_date)
     VALUES ($1, $2, $3, $4)
     RETURNING document_id`,
    [id, doc_type, file_url || null, expiry_date || null]
  );

  await auditLog(req, { action: "CREATE_VEHICLE_DOCUMENT", entityType: "vehicle", entityId: id, metadata: { document_id: rows[0].document_id } });
  res.json({ document_id: rows[0].document_id });
}));

app.get("/vehicles/:id/playback", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const window = getPlaybackWindow(req.query);
  if (window.error) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: window.error } });
  }

  const limit = getPlaybackLimit(req.query);
  const playback = await loadVehiclePlayback({
    vehicleId: id,
    start: window.start,
    end: window.end,
    limit
  });

  res.json(playback);
}));

app.post("/vehicles/:id/playback/records", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isObjectStorageConfigured()) {
    return res.status(503).json({
      error: {
        code: "OBJECT_STORAGE_NOT_CONFIGURED",
        message: "MinIO/S3 storage belum dikonfigurasi untuk menyimpan record playback."
      }
    });
  }

  const window = getPlaybackWindow(req.body || {});
  if (window.error) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: window.error } });
  }

  const limit = getPlaybackLimit(req.body || {});
  const playback = await loadVehiclePlayback({
    vehicleId: id,
    start: window.start,
    end: window.end,
    limit
  });

  const objectKey = [
    "vehicles",
    id,
    "playback",
    window.start.toISOString().slice(0, 10),
    `${window.start.toISOString().replace(/[:.]/g, "-")}_${window.end.toISOString().replace(/[:.]/g, "-")}_${crypto.randomUUID()}.json`
  ].join("/");

  const storedObject = await putJsonObject(objectKey, {
    generated_at: new Date().toISOString(),
    generated_by: req.user?.user_id || null,
    playback
  });

  const { rows } = await query(
    `INSERT INTO playback_records (
        vehicle_id,
        start_ts,
        end_ts,
        point_count,
        event_count,
        storage_bucket,
        storage_key,
        object_url,
        byte_size,
        created_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING
        record_id,
        vehicle_id,
        start_ts AS start,
        end_ts AS end,
        point_count,
        event_count,
        storage_bucket,
        storage_key,
        object_url,
        byte_size,
        created_at`,
    [
      id,
      window.start,
      window.end,
      playback.positions.length,
      playback.events.length,
      storedObject.bucket,
      storedObject.key,
      storedObject.object_url,
      storedObject.byte_size,
      req.user?.user_id || null
    ]
  );

  await auditLog(req, {
    action: "CREATE_PLAYBACK_RECORD",
    entityType: "vehicle",
    entityId: id,
    metadata: {
      record_id: rows[0].record_id,
      start: window.start.toISOString(),
      end: window.end.toISOString(),
      point_count: playback.positions.length,
      storage_key: storedObject.key
    }
  });

  res.status(201).json({ record: rows[0] });
}));

app.get("/vehicles/:id/playback/records", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit || 10), 50);
  const { rows } = await query(
    `SELECT
        record_id,
        vehicle_id,
        start_ts AS start,
        end_ts AS end,
        point_count,
        event_count,
        storage_bucket,
        storage_key,
        object_url,
        byte_size,
        created_at
     FROM playback_records
     WHERE vehicle_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [id, limit]
  );

  res.json({ vehicle_id: id, items: rows, limit });
}));

// GET incidents for a vehicle
app.get("/vehicles/:id/incidents", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const limit = Math.min(Number(req.query.limit || 20), 100);
  const offset = Number(req.query.offset || 0);

  const { rows } = await query(
    `SELECT
        i.incident_id,
        i.type,
        i.severity,
        i.status,
        i.description,
        i.location_desc,
        i.lat,
        i.lon,
        i.created_at,
        i.resolved_at
     FROM incidents i
     WHERE i.vehicle_id = $1
     ORDER BY i.created_at DESC
     LIMIT $2 OFFSET $3`,
    [id, limit, offset]
  );

  const countResult = await query(
    "SELECT COUNT(*)::int AS total FROM incidents WHERE vehicle_id = $1",
    [id]
  );

  res.json({
    vehicle_id: id,
    items: rows,
    total: countResult.rows[0]?.total || 0,
    limit,
    offset
  });
}));

app.get("/dashboard/summary", auth, requireOperatorDashboardRole, asyncHandler(async (_req, res) => {
  const vehiclesResult = await query(
    `SELECT
        COUNT(*)::int AS total_vehicles,
        COUNT(*) FILTER (WHERE status IN ('IN_SERVICE', 'IDLE', 'OFF_ROUTE', 'SOS'))::int AS active_vehicles
     FROM vehicles`
  );
  const onlineResult = await query(
    `SELECT COUNT(*)::int AS online_vehicles
     FROM vehicle_latest
     WHERE ts > now() - interval '10 minutes'`
  );
  const incidentsResult = await query(
    `SELECT incident_id, type, severity, i.status AS incident_status, description, location_desc, i.created_at AS incident_created_at, v.plate_no, v.route_id
     FROM incidents i
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     ORDER BY i.created_at DESC
     LIMIT 5`
  );

  res.json({
    vehicles: vehiclesResult.rows[0],
    online: onlineResult.rows[0]?.online_vehicles || 0,
    incidents: incidentsResult.rows.map((row) => ({
      id: row.incident_id,
      type: row.type,
      severity: row.severity,
      status: row.incident_status,
      description: row.description,
      location: row.location_desc,
      timestamp: row.incident_created_at,
      vehicle_plate: row.plate_no,
      route_id: row.route_id
    }))
  });
}));

app.get("/telemetry/quality", auth, requireOperatorDashboardRole, asyncHandler(async (req, res) => {
  const report = await getTelemetryQualityReport({
    query,
    getRollingMetricCount,
    params: req.query,
    defaults: {
      hours: 1,
      targetIntervalSec: Number(process.env.TELEMETRY_TARGET_INTERVAL_SEC || 5),
      staleMinutes: deviceOfflineMinutes,
      driftThresholdMeters: Number(process.env.TELEMETRY_QUALITY_DRIFT_THRESHOLD_M || 80),
      slaTargetPct: Number(process.env.TELEMETRY_QUALITY_SLA_TARGET_PCT || 99.5),
      limit: 200
    }
  });

  await auditLog(req, {
    action: "READ_TELEMETRY_QUALITY",
    entityType: "telemetry_quality",
    metadata: {
      hours: report.window.hours,
      route_id: req.query.route_id || null
    }
  });
  res.json(report);
}));

app.get("/telemetry/quality/export", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const report = await getTelemetryQualityReport({
    query,
    getRollingMetricCount,
    params: {
      ...req.query,
      hours: req.query.hours || "720",
      limit: req.query.limit || "1000"
    },
    defaults: {
      hours: 720,
      targetIntervalSec: Number(process.env.TELEMETRY_TARGET_INTERVAL_SEC || 5),
      staleMinutes: deviceOfflineMinutes,
      driftThresholdMeters: Number(process.env.TELEMETRY_QUALITY_DRIFT_THRESHOLD_M || 80),
      slaTargetPct: Number(process.env.TELEMETRY_QUALITY_SLA_TARGET_PCT || 99.5),
      limit: 1000
    }
  });

  const generatedDate = new Date().toISOString().slice(0, 10);
  await auditLog(req, {
    action: "EXPORT_TELEMETRY_QUALITY",
    entityType: "telemetry_quality",
    metadata: {
      hours: report.window.hours,
      route_id: req.query.route_id || null,
      format: "csv"
    }
  });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="telemetry-quality-${generatedDate}.csv"`);
  res.send(renderTelemetryQualityCsv(report));
}));

app.get("/observability/summary", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const checkedAt = new Date().toISOString();
  const [
    dbHealth,
    redisHealth,
    rulesHealth,
    notificationHealth,
    telemetryResult,
    activeCountsResult,
    latestReportResult,
    notificationErrorResult,
    invalidImageRejectionsCount,
    evidenceProcessingSummary
  ] = await Promise.all([
    query("SELECT now() AS server_time").then((result) => ({
      service: "db",
      status: "OK",
      checked_at: checkedAt,
      message: `Postgres reachable at ${result.rows[0]?.server_time?.toISOString?.() || checkedAt}`
    })),
    checkHttpService({ service: "redis", url: redisHealthUrl }),
    checkHttpService({ service: "rules_engine", url: rulesEngineHealthUrl }),
    checkHttpService({ service: "notification_service", url: notificationServiceHealthUrl }),
    query(
      `SELECT
          date_trunc('minute', ts) AS minute,
          COUNT(*)::int AS telemetry_count
       FROM vehicle_positions
       WHERE ts >= now() - interval '15 minutes'
       GROUP BY minute
       ORDER BY minute DESC`
    ),
    query(
      `SELECT
          (SELECT COUNT(*)::int FROM anomalies WHERE status = 'OPEN') AS active_anomalies,
          (SELECT COUNT(*)::int FROM alerts WHERE status IN ('OPEN', 'ESCALATED')) AS active_alerts,
          (SELECT COUNT(*)::int FROM incidents WHERE status IN ('OPEN', 'IN_PROGRESS')) AS active_incidents`
    ),
    query(
      `SELECT
          (SELECT MAX(report_date) FROM report_kpi_daily) AS last_kpi_report,
          (SELECT MAX(report_date) FROM report_rit_daily) AS last_rit_report`
    ),
    query(
      `SELECT COUNT(*)::int AS failed_notifications
       FROM notifications
       WHERE status IN ('FAILED', 'ERROR')
         AND created_at >= now() - interval '24 hours'`
    ),
    getRollingMetricCount(PUBLIC_REPORT_INVALID_IMAGE_REJECTIONS_METRIC, {
      windowMs: PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_MS
    }),
    getPublicReportEvidenceProcessingSummary()
  ]);

  const telemetryPerMinute = telemetryResult.rows.map((row) => ({
    minute: row.minute,
    count: row.telemetry_count
  }));
  const latestTelemetryCount = telemetryPerMinute[0]?.count || 0;
  const reportRow = latestReportResult.rows[0] || {};
  const lastSuccessfulReportDaily = reportRow.last_rit_report || reportRow.last_kpi_report || null;
  const failedNotifications = notificationErrorResult.rows[0]?.failed_notifications || 0;
  const invalidImageRejections = Number(invalidImageRejectionsCount || 0);
  const invalidImageRejectionStatus = invalidImageRejections >= publicReportInvalidImageErrorThreshold
    ? "ERROR"
    : invalidImageRejections >= publicReportInvalidImageWarningThreshold
      ? "DEGRADED"
      : "OK";

  const jobErrors = [
    {
      job: "daily_report",
      status: lastSuccessfulReportDaily ? "OK" : "UNKNOWN",
      message: lastSuccessfulReportDaily
        ? `Last daily report ${formatReportDate(lastSuccessfulReportDaily)}`
        : "Belum ada report harian sukses"
    },
    {
      job: "telemetry_ingestion",
      status: latestTelemetryCount > 0 ? "OK" : "DEGRADED",
      message: latestTelemetryCount > 0 ? `${latestTelemetryCount} telemetry/minute terbaru` : "Tidak ada telemetry pada menit terbaru"
    },
    {
      job: "notification_job",
      status: failedNotifications > 0 ? "ERROR" : "OK",
      message: failedNotifications > 0 ? `${failedNotifications} notification error dalam 24 jam` : "Tidak ada notification error 24 jam"
    },
    {
      job: "public_report_upload_validation",
      status: invalidImageRejectionStatus,
      message: invalidImageRejectionStatus === "OK"
        ? `Invalid image rejection ${invalidImageRejections} dalam ${PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_HOURS} jam terakhir, di bawah threshold warning ${publicReportInvalidImageWarningThreshold}`
        : `${invalidImageRejections} invalid image upload ditolak dalam ${PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_HOURS} jam terakhir; warning >= ${publicReportInvalidImageWarningThreshold}, error >= ${publicReportInvalidImageErrorThreshold}`
    },
    {
      job: "public_report_evidence_processing",
      status: evidenceProcessingSummary.status,
      message: `${evidenceProcessingSummary.completed_24h} completed, ${evidenceProcessingSummary.failed_24h} failed, ${evidenceProcessingSummary.enqueue_failures_24h} enqueue failures dalam 24 jam`
    }
  ];

  await auditLog(req, { action: "READ_OBSERVABILITY_SUMMARY", entityType: "observability" });
  res.json({
    checked_at: checkedAt,
    services: [
      { service: "api_gateway", status: "OK", checked_at: checkedAt, message: "API gateway request handled" },
      dbHealth,
      redisHealth,
      rulesHealth,
      notificationHealth
    ],
    telemetry_per_minute: telemetryPerMinute,
    last_successful_report_daily: lastSuccessfulReportDaily,
    active_counts: activeCountsResult.rows[0] || {
      active_anomalies: 0,
      active_alerts: 0,
      active_incidents: 0
    },
    upload_metrics: {
      public_report_invalid_image_rejections: invalidImageRejections,
      public_report_invalid_image_rejection_window_hours: PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_HOURS,
      public_report_invalid_image_rejection_warning_threshold: publicReportInvalidImageWarningThreshold,
      public_report_invalid_image_rejection_error_threshold: publicReportInvalidImageErrorThreshold,
      public_report_invalid_image_rejection_status: invalidImageRejectionStatus
    },
    evidence_processing: evidenceProcessingSummary,
    job_errors: jobErrors
  });
}));

app.get("/intelligence/fleet", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const [vehiclesResult, routesResult, recurringResult] = await Promise.all([
    query(
      `SELECT
          v.vehicle_id,
          v.plate_no,
          v.route_id,
          o.name AS owner_name,
          rs.current_score AS risk_score,
          rs.risk_level,
          COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '7 days')::int AS incident_count_7d,
          COUNT(DISTINCT a.anomaly_id) FILTER (WHERE a.started_at >= now() - interval '7 days')::int AS anomaly_count_7d
       FROM vehicles v
       LEFT JOIN owners o ON o.owner_id = v.owner_id
       LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
       LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
       LEFT JOIN anomalies a ON a.vehicle_id = v.vehicle_id
       GROUP BY v.vehicle_id, o.name, rs.current_score, rs.risk_level
       HAVING COALESCE(rs.current_score, 0) > 0
          OR COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '7 days') > 0
          OR COUNT(DISTINCT a.anomaly_id) FILTER (WHERE a.started_at >= now() - interval '7 days') > 0
       ORDER BY rs.current_score DESC NULLS LAST, incident_count_7d DESC, anomaly_count_7d DESC
       LIMIT 10`
    ),
    query(
      `SELECT
          v.route_id,
          r.name AS route_name,
          COUNT(DISTINCT a.anomaly_id) FILTER (WHERE a.started_at >= now() - interval '7 days')::int AS anomaly_count_7d,
          COUNT(DISTINCT al.alert_id) FILTER (WHERE al.opened_at >= now() - interval '7 days')::int AS alert_count_7d,
          COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '7 days')::int AS incident_count_7d,
          ROUND(AVG(rs.current_score)::numeric, 1)::float AS avg_risk_score
       FROM vehicles v
       LEFT JOIN routes r ON r.route_id = v.route_id
       LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
       LEFT JOIN anomalies a ON a.vehicle_id = v.vehicle_id
       LEFT JOIN alerts al ON al.vehicle_id = v.vehicle_id
       LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
       GROUP BY v.route_id, r.name
       HAVING COUNT(DISTINCT a.anomaly_id) FILTER (WHERE a.started_at >= now() - interval '7 days') > 0
          OR COUNT(DISTINCT al.alert_id) FILTER (WHERE al.opened_at >= now() - interval '7 days') > 0
          OR COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '7 days') > 0
          OR AVG(rs.current_score) IS NOT NULL
       ORDER BY incident_count_7d DESC, alert_count_7d DESC, anomaly_count_7d DESC, avg_risk_score DESC NULLS LAST
       LIMIT 10`
    ),
    query(
      `SELECT
          a.vehicle_id,
          v.plate_no,
          a.route_id,
          a.rule,
          COUNT(*)::int AS occurrence_count,
          MAX(a.last_seen_at) AS last_seen_at
       FROM anomalies a
       JOIN vehicles v ON v.vehicle_id = a.vehicle_id
       WHERE a.started_at >= now() - interval '7 days'
       GROUP BY a.vehicle_id, v.plate_no, a.route_id, a.rule
       HAVING COUNT(*) >= 2
       ORDER BY occurrence_count DESC, last_seen_at DESC
       LIMIT 10`
    )
  ]);

  await auditLog(req, { action: "READ_FLEET_INTELLIGENCE", entityType: "fleet_intelligence" });
  res.json({
    generated_at: new Date().toISOString(),
    top_high_risk_vehicles: vehiclesResult.rows.map((row) => ({
      ...row,
      drill_down: {
        vehicle_detail: `/dashboard/vehicles/${row.vehicle_id}`,
        playback: `/dashboard/vehicles/${row.vehicle_id}?tab=playback`,
        incidents: `/dashboard/incidents?vehicle_id=${row.vehicle_id}`
      }
    })),
    top_problematic_routes: routesResult.rows,
    recurring_anomalies: recurringResult.rows.map((row) => ({
      ...row,
      drill_down: {
        vehicle_detail: `/dashboard/vehicles/${row.vehicle_id}`,
        playback: `/dashboard/vehicles/${row.vehicle_id}?tab=playback`
      }
    }))
  });
}));

app.get("/activities", auth, requireOperatorDashboardRole, asyncHandler(async (_req, res) => {
  const { rows } = await query(
    `SELECT
        ia.action_id,
        ia.action,
        ia.notes,
        ia.created_at,
        i.type AS incident_type,
        v.plate_no,
        u.full_name AS actor_name
     FROM incident_actions ia
     LEFT JOIN incidents i ON i.incident_id = ia.incident_id
     LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
     LEFT JOIN users u ON u.user_id = ia.actor_id
     ORDER BY ia.created_at DESC
     LIMIT 10`
  );

  res.json({
    items: rows.map((row) => ({
      id: row.action_id,
      action: row.action,
      notes: row.notes,
      created_at: row.created_at,
      incident_type: row.incident_type,
      plate_no: row.plate_no,
      actor_name: row.actor_name
    }))
  });
}));

app.get("/audit-logs", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 200);
  const cursor = req.query.cursor || null;
  const action = req.query.action || null;
  const entityType = req.query.entity_type || null;
  const actorId = req.query.actor_id || null;

  const params = [];
  const filters = [];
  if (cursor) {
    params.push(cursor);
    filters.push(`created_at < $${params.length}`);
  }
  if (action) {
    params.push(action);
    filters.push(`action = $${params.length}`);
  }
  if (entityType) {
    params.push(entityType);
    filters.push(`entity_type = $${params.length}`);
  }
  if (actorId) {
    params.push(actorId);
    filters.push(`actor_id = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  params.push(limit);

  const { rows } = await query(
    `SELECT
        audit_id,
        action,
        entity_type,
        entity_id,
        metadata,
        ip,
        user_agent,
        created_at,
        actor_id
     FROM audit_logs
     ${where}
     ORDER BY created_at DESC
     LIMIT $${params.length}`,
    params
  );

  await auditLog(req, { action: "READ_AUDIT_LOGS", entityType: "audit_log" });
  res.json({ items: rows, next_cursor: rows.length ? rows[rows.length - 1].created_at : null });
}));

// --- Phase 15: Sanctions, Collective Anomalies, Network Graph, Compliance ---

app.get("/sanctions", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const params = [];
  const filters = [];
  if (req.query.status) { params.push(req.query.status); filters.push(`s.status = $${params.length}`); }
  if (req.query.type) { params.push(req.query.type); filters.push(`s.type = $${params.length}`); }
  if (req.query.owner_id) { params.push(req.query.owner_id); filters.push(`s.owner_id = $${params.length}`); }
  if (req.query.vehicle_id) { params.push(req.query.vehicle_id); filters.push(`s.vehicle_id = $${params.length}`); }
  if (req.query.incident_id) { params.push(req.query.incident_id); filters.push(`s.incident_id = $${params.length}`); }
  if (req.query.from) { params.push(req.query.from); filters.push(`s.decided_at >= $${params.length}::timestamptz`); }
  if (req.query.to) { params.push(req.query.to); filters.push(`s.decided_at <= $${params.length}::timestamptz`); }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT
        s.sanction_id, s.vehicle_id, s.owner_id, s.type, s.level, s.reason,
        s.evidence, s.incident_id, s.collective_anomaly_id,
        s.decided_at, s.effective_from, s.effective_until, s.status, s.notes, s.created_at,
        v.plate_no, o.name AS owner_name, u.full_name AS decided_by_name
     FROM sanctions s
     LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
     LEFT JOIN owners o ON o.owner_id = s.owner_id
     LEFT JOIN users u ON u.user_id = s.decided_by
     ${where}
     ORDER BY s.decided_at DESC
     LIMIT 100`,
    params
  );

  await auditLog(req, { action: "READ_SANCTIONS", entityType: "sanction" });
  res.json({ items: rows });
}));

app.get("/sanctions/export", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const format = String(req.query.format || "csv").toLowerCase();
  const { rows } = await query(
    `SELECT
        s.sanction_id, s.type, s.level, s.reason, s.status,
        s.decided_at, s.effective_from, s.effective_until, s.notes,
        v.plate_no, o.name AS owner_name, u.full_name AS decided_by_name
     FROM sanctions s
     LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
     LEFT JOIN owners o ON o.owner_id = s.owner_id
     LEFT JOIN users u ON u.user_id = s.decided_by
     ORDER BY s.decided_at DESC`
  );

  if (format === "pdf") {
    const pdf = buildSimplePdf({
      title: "Laporan Sanksi",
      rows: rows.map((r) => ({
        report_date: r.decided_at ? new Date(r.decided_at).toISOString().slice(0, 10) : "-",
        plate_no: r.plate_no || "-",
        route_id: r.type,
        total_rit: `${r.level} | ${r.status}`
      }))
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="sanctions-report.pdf"`);
    return res.send(pdf);
  }

  if (format !== "csv") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "format must be csv or pdf" } });
  }

  const header = "Sanction ID,Plate No,Owner,Type,Level,Status,Reason,Decided At,Effective From,Effective Until,Decided By,Notes";
  const csvRows = rows.map((r) =>
    [r.sanction_id, r.plate_no || "", r.owner_name || "", r.type, r.level, r.status, `"${(r.reason || "").replace(/"/g, '""')}"`, r.decided_at ? new Date(r.decided_at).toISOString().slice(0, 10) : "", r.effective_from || "", r.effective_until || "", r.decided_by_name || "", `"${(r.notes || "").replace(/"/g, '""')}"`].join(",")
  );

  await auditLog(req, { action: "EXPORT_SANCTIONS", entityType: "sanction" });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="sanctions-report.csv"`);
  res.send([header, ...csvRows].join("\n"));
}));

app.get("/sanctions/:id", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `SELECT
        s.*, v.plate_no, o.name AS owner_name, u.full_name AS decided_by_name
     FROM sanctions s
     LEFT JOIN vehicles v ON v.vehicle_id = s.vehicle_id
     LEFT JOIN owners o ON o.owner_id = s.owner_id
     LEFT JOIN users u ON u.user_id = s.decided_by
     WHERE s.sanction_id = $1`,
    [id]
  );
  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Sanction not found" } });
  }

  const actionsResult = await query(
    `SELECT sa.action_id, sa.action, sa.notes, sa.created_at, u.full_name AS actor_name
     FROM sanction_actions sa
     LEFT JOIN users u ON u.user_id = sa.actor_id
     WHERE sa.sanction_id = $1
     ORDER BY sa.created_at DESC`,
    [id]
  );

  await auditLog(req, { action: "READ_SANCTION_DETAIL", entityType: "sanction", entityId: id });
  res.json({ sanction: rows[0], actions: actionsResult.rows });
}));

app.post("/sanctions", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { vehicle_id, owner_id, type, level, reason, evidence, incident_id, collective_anomaly_id, effective_from, effective_until, notes } = req.body || {};

  if (!vehicle_id && !owner_id) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "vehicle_id or owner_id required" } });
  }
  if (!type || !["WARNING", "COACHING", "ADMINISTRATIVE", "SUSPENSION", "REVOCATION"].includes(type)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid sanction type" } });
  }
  if (!level || !["LOW", "MEDIUM", "HIGH", "CRITICAL"].includes(level)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid sanction level" } });
  }
  if (!reason || !reason.trim()) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Reason is required" } });
  }

  if (vehicle_id) {
    const { rows: vRows } = await query("SELECT vehicle_id FROM vehicles WHERE vehicle_id = $1", [vehicle_id]);
    if (!vRows.length) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Vehicle not found" } });
  }
  if (owner_id) {
    const { rows: oRows } = await query("SELECT owner_id FROM owners WHERE owner_id = $1", [owner_id]);
    if (!oRows.length) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Owner not found" } });
  }

  const { rows } = await query(
    `INSERT INTO sanctions (vehicle_id, owner_id, type, level, reason, evidence, incident_id, collective_anomaly_id, decided_by, effective_from, effective_until, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING sanction_id`,
    [vehicle_id || null, owner_id || null, type, level, reason.trim(), JSON.stringify(evidence || {}), incident_id || null, collective_anomaly_id || null, req.user.user_id, effective_from || new Date().toISOString().slice(0, 10), effective_until || null, notes || null]
  );

  const sanctionId = rows[0].sanction_id;
  await query(
    `INSERT INTO sanction_actions (sanction_id, action, actor_id, notes) VALUES ($1, 'CREATE', $2, $3)`,
    [sanctionId, req.user.user_id, `Sanction ${type} (${level}) created`]
  );

  await query(
    `INSERT INTO notifications (channel, status, payload) VALUES ('BROWSER', 'PENDING', $1)`,
    [JSON.stringify({ type: "SANCTION_CREATED", sanction_id: sanctionId, sanction_type: type, level, vehicle_id, owner_id })]
  );

  await auditLog(req, { action: "CREATE_SANCTION", entityType: "sanction", entityId: sanctionId, metadata: { type, level, vehicle_id, owner_id } });
  res.json({ sanction_id: sanctionId });
}));

app.post("/sanctions/:id/actions", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { action, notes, effective_until } = req.body || {};

  if (!action || !["RENEW", "REVOKE", "NOTE"].includes(action)) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "action must be RENEW, REVOKE, or NOTE" } });
  }

  const { rows: sanctionRows } = await query("SELECT * FROM sanctions WHERE sanction_id = $1", [id]);
  if (!sanctionRows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Sanction not found" } });
  }

  if (action === "REVOKE") {
    await query(
      `UPDATE sanctions SET status = 'REVOKED', updated_at = now() WHERE sanction_id = $1`,
      [id]
    );
  } else if (action === "RENEW") {
    await query(
      `UPDATE sanctions SET status = 'RENEWED', updated_at = now() WHERE sanction_id = $1`,
      [id]
    );
    const old = sanctionRows[0];
    await query(
      `INSERT INTO sanctions (vehicle_id, owner_id, type, level, reason, evidence, incident_id, collective_anomaly_id, decided_by, effective_from, effective_until, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [old.vehicle_id, old.owner_id, old.type, old.level, old.reason, JSON.stringify(old.evidence || {}), old.incident_id, old.collective_anomaly_id, req.user.user_id, new Date().toISOString().slice(0, 10), effective_until || null, notes || old.notes]
    );
  }

  await query(
    `INSERT INTO sanction_actions (sanction_id, action, actor_id, notes) VALUES ($1, $2, $3, $4)`,
    [id, action, req.user.user_id, notes || null]
  );

  await auditLog(req, { action: `SANCTION_${action}`, entityType: "sanction", entityId: id });
  res.json({ ok: true });
}));

app.get("/collective-anomalies", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const params = [];
  const filters = [];
  if (req.query.status) { params.push(req.query.status); filters.push(`status = $${params.length}`); }
  if (req.query.type) { params.push(req.query.type); filters.push(`type = $${params.length}`); }
  if (req.query.from) { params.push(req.query.from); filters.push(`detected_at >= $${params.length}::timestamptz`); }
  if (req.query.to) { params.push(req.query.to); filters.push(`detected_at <= $${params.length}::timestamptz`); }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT
        collective_anomaly_id, type, severity, status, evidence,
        involved_vehicles, involved_owners, route_id, incident_id,
        detected_at, resolved_at, escalation_count, created_at
     FROM collective_anomalies
     ${where}
     ORDER BY detected_at DESC
     LIMIT 100`,
    params
  );

  await auditLog(req, { action: "READ_COLLECTIVE_ANOMALIES", entityType: "collective_anomaly" });
  res.json({ items: rows });
}));

app.post("/collective-anomalies/:id/escalate", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rows } = await query(
    `SELECT * FROM collective_anomalies WHERE collective_anomaly_id = $1 AND status = 'OPEN'`,
    [id]
  );
  if (!rows.length) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Collective anomaly not found or already escalated" } });
  }

  const ca = rows[0];
  const incidentResult = await query(
    `INSERT INTO incidents (type, severity, status, description, lat, lon)
     VALUES ($1, $2, 'OPEN', $3, NULL, NULL)
     RETURNING incident_id`,
    [ca.type, ca.severity, `Collective anomaly: ${ca.type} — ${JSON.stringify(ca.evidence).slice(0, 200)}`]
  );
  const incidentId = incidentResult.rows[0].incident_id;

  await query(
    `UPDATE collective_anomalies SET status = 'ESCALATED', incident_id = $1, updated_at = now() WHERE collective_anomaly_id = $2`,
    [incidentId, id]
  );

  await query(
    `INSERT INTO incident_actions (incident_id, action, actor_id, notes) VALUES ($1, 'ESCALATE_FROM_COLLECTIVE', $2, $3)`,
    [incidentId, req.user.user_id, `Escalated from collective anomaly ${id}`]
  );

  await auditLog(req, { action: "ESCALATE_COLLECTIVE_ANOMALY", entityType: "collective_anomaly", entityId: id, metadata: { incident_id: incidentId } });
  res.json({ incident_id: incidentId });
}));

app.get("/network/graph", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const params = [];
  const ownerFilter = [];
  if (req.query.owner_id) { params.push(req.query.owner_id); ownerFilter.push(`o.owner_id = $${params.length}`); }
  if (req.query.route_id) { params.push(req.query.route_id); ownerFilter.push(`v.route_id = $${params.length}`); }
  const ownerWhere = ownerFilter.length ? `WHERE ${ownerFilter.join(" AND ")}` : "";

  const { rows: vehicleRows } = await query(
    `SELECT
        v.vehicle_id, v.plate_no, v.route_id, v.status AS vehicle_status,
        o.owner_id, o.name AS owner_name, o.owner_type,
        rs.current_score AS risk_score, rs.risk_level,
        a.device_id, d.imei_or_serial, d.status AS device_status
     FROM vehicles v
     LEFT JOIN owners o ON o.owner_id = v.owner_id
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     LEFT JOIN assignments a ON a.vehicle_id = v.vehicle_id AND a.is_active = true
     LEFT JOIN devices d ON d.device_id = a.device_id
     ${ownerWhere}
     ORDER BY o.name, v.plate_no
     LIMIT 200`,
    params
  );

  const nodes = [];
  const edges = [];
  const ownerSet = new Set();
  const deviceSet = new Set();

  for (const row of vehicleRows) {
    nodes.push({ id: `v-${row.vehicle_id}`, type: "vehicle", label: row.plate_no, meta: { vehicle_id: row.vehicle_id, route_id: row.route_id, status: row.vehicle_status, risk_score: row.risk_score, risk_level: row.risk_level } });

    if (row.owner_id && !ownerSet.has(row.owner_id)) {
      ownerSet.add(row.owner_id);
      nodes.push({ id: `o-${row.owner_id}`, type: "owner", label: row.owner_name, meta: { owner_id: row.owner_id, owner_type: row.owner_type } });
    }
    if (row.owner_id) {
      edges.push({ source: `o-${row.owner_id}`, target: `v-${row.vehicle_id}`, type: "owns" });
    }

    if (row.device_id && !deviceSet.has(row.device_id)) {
      deviceSet.add(row.device_id);
      nodes.push({ id: `d-${row.device_id}`, type: "device", label: row.imei_or_serial || row.device_id, meta: { device_id: row.device_id, status: row.device_status } });
    }
    if (row.device_id) {
      edges.push({ source: `v-${row.vehicle_id}`, target: `d-${row.device_id}`, type: "device_installed" });
    }
  }

  const vehicleIds = vehicleRows.map((r) => r.vehicle_id);
  if (vehicleIds.length > 0) {
    const { rows: incidentRows } = await query(
      `SELECT vehicle_id, incident_id, type, severity, status
       FROM incidents
       WHERE vehicle_id = ANY($1) AND status IN ('OPEN', 'IN_PROGRESS')`,
      [vehicleIds]
    );
    for (const inc of incidentRows) {
      nodes.push({ id: `i-${inc.incident_id}`, type: "incident", label: `${inc.type} (${inc.severity})`, meta: { incident_id: inc.incident_id, status: inc.status } });
      edges.push({ source: `v-${inc.vehicle_id}`, target: `i-${inc.incident_id}`, type: "has_incident" });
    }

    const { rows: sanctionRows } = await query(
      `SELECT sanction_id, vehicle_id, owner_id, type, level, status
       FROM sanctions
       WHERE (vehicle_id = ANY($1) OR owner_id = ANY($2)) AND status = 'ACTIVE'`,
      [vehicleIds, [...ownerSet]]
    );
    for (const s of sanctionRows) {
      nodes.push({ id: `s-${s.sanction_id}`, type: "sanction", label: `${s.type} (${s.level})`, meta: { sanction_id: s.sanction_id, status: s.status } });
      if (s.vehicle_id) edges.push({ source: `v-${s.vehicle_id}`, target: `s-${s.sanction_id}`, type: "has_sanction" });
      else if (s.owner_id) edges.push({ source: `o-${s.owner_id}`, target: `s-${s.sanction_id}`, type: "has_sanction" });
    }
  }

  const [topOwners, topRoutes, topDevices] = await Promise.all([
    query(
      `SELECT o.owner_id, o.name,
              COUNT(DISTINCT i.incident_id)::int AS incident_count,
              ROUND(AVG(rs.current_score)::numeric, 1)::float AS avg_risk
       FROM owners o
       JOIN vehicles v ON v.owner_id = o.owner_id
       LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id AND i.created_at >= now() - interval '30 days'
       LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
       GROUP BY o.owner_id
       ORDER BY incident_count DESC, avg_risk DESC NULLS LAST
       LIMIT 10`
    ),
    query(
      `SELECT v.route_id, r.name AS route_name,
              COUNT(DISTINCT a.anomaly_id)::int AS anomaly_count
       FROM vehicles v
       JOIN routes r ON r.route_id = v.route_id
       LEFT JOIN anomalies a ON a.vehicle_id = v.vehicle_id AND a.started_at >= now() - interval '30 days'
       GROUP BY v.route_id, r.name
       ORDER BY anomaly_count DESC
       LIMIT 10`
    ),
    query(
      `SELECT d.device_id, d.imei_or_serial,
              COUNT(DISTINCT a2.assignment_id)::int AS assignment_count
       FROM devices d
       LEFT JOIN assignments a2 ON a2.device_id = d.device_id AND a2.created_at >= now() - interval '30 days'
       GROUP BY d.device_id
       ORDER BY assignment_count DESC
       LIMIT 10`
    )
  ]);

  await auditLog(req, { action: "READ_NETWORK_GRAPH", entityType: "network" });
  res.json({ nodes, edges, rankings: { top_owners: topOwners.rows, top_routes: topRoutes.rows, top_devices: topDevices.rows } });
}));

app.get("/network/graph/export", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { rows } = await query(
    `SELECT
        o.name AS owner_name, v.plate_no, d.imei_or_serial,
        COALESCE(rs.current_score, 0) AS risk_score, rs.risk_level,
        COUNT(DISTINCT an.anomaly_id)::int AS anomaly_count,
        COUNT(DISTINCT i.incident_id)::int AS incident_count,
        COUNT(DISTINCT s.sanction_id)::int AS sanction_count
     FROM vehicles v
     LEFT JOIN owners o ON o.owner_id = v.owner_id
     LEFT JOIN assignments asg ON asg.vehicle_id = v.vehicle_id AND asg.is_active = true
     LEFT JOIN devices d ON d.device_id = asg.device_id
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     LEFT JOIN anomalies an ON an.vehicle_id = v.vehicle_id AND an.started_at >= now() - interval '30 days'
     LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id AND i.created_at >= now() - interval '30 days'
     LEFT JOIN sanctions s ON s.vehicle_id = v.vehicle_id AND s.status = 'ACTIVE'
     GROUP BY o.name, v.plate_no, d.imei_or_serial, rs.current_score, rs.risk_level
     ORDER BY o.name, v.plate_no`
  );

  const header = "Owner,Plate No,Device IMEI,Risk Score,Risk Level,Anomalies (30d),Incidents (30d),Active Sanctions";
  const csvRows = rows.map((r) =>
    [r.owner_name || "", r.plate_no, r.imei_or_serial || "", r.risk_score, r.risk_level || "", r.anomaly_count, r.incident_count, r.sanction_count].join(",")
  );

  await auditLog(req, { action: "EXPORT_NETWORK_GRAPH", entityType: "network" });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="network-graph.csv"`);
  res.send([header, ...csvRows].join("\n"));
}));

app.get("/compliance/fleet", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const sortDir = req.query.sort === "desc" ? "DESC" : "ASC";

  const { rows } = await query(
    `SELECT
        o.owner_id, o.name, o.owner_type, o.status,
        COUNT(DISTINCT v.vehicle_id)::int AS total_vehicles,
        ROUND(AVG(COALESCE(rs.current_score, 0))::numeric, 1)::float AS avg_risk_score,
        COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '30 days')::int AS incident_count_30d,
        COUNT(DISTINCT s.sanction_id) FILTER (WHERE s.status = 'ACTIVE')::int AS active_sanction_count,
        GREATEST(0, ROUND((100 - AVG(COALESCE(rs.current_score, 0)) - COUNT(DISTINCT s.sanction_id) FILTER (WHERE s.status = 'ACTIVE') * 10)::numeric))::float AS compliance_score
     FROM owners o
     LEFT JOIN vehicles v ON v.owner_id = o.owner_id
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
     LEFT JOIN sanctions s ON (s.owner_id = o.owner_id OR s.vehicle_id = v.vehicle_id)
     GROUP BY o.owner_id
     ORDER BY compliance_score ${sortDir}
     LIMIT 100`
  );

  const summary = {
    total_owners: rows.length,
    avg_compliance: rows.length > 0 ? Number((rows.reduce((sum, r) => sum + (r.compliance_score || 0), 0) / rows.length).toFixed(1)) : 0,
    total_active_sanctions: rows.reduce((sum, r) => sum + (r.active_sanction_count || 0), 0),
    total_vehicles: rows.reduce((sum, r) => sum + (r.total_vehicles || 0), 0)
  };

  await auditLog(req, { action: "READ_COMPLIANCE_FLEET", entityType: "compliance" });
  res.json({ items: rows, summary });
}));

app.get("/compliance/fleet/export", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const format = String(req.query.format || "csv").toLowerCase();

  const { rows } = await query(
    `SELECT
        o.owner_id, o.name, o.owner_type,
        COUNT(DISTINCT v.vehicle_id)::int AS total_vehicles,
        ROUND(AVG(COALESCE(rs.current_score, 0))::numeric, 1)::float AS avg_risk_score,
        COUNT(DISTINCT i.incident_id) FILTER (WHERE i.created_at >= now() - interval '30 days')::int AS incident_count_30d,
        COUNT(DISTINCT s.sanction_id) FILTER (WHERE s.status = 'ACTIVE')::int AS active_sanction_count,
        GREATEST(0, ROUND((100 - AVG(COALESCE(rs.current_score, 0)) - COUNT(DISTINCT s.sanction_id) FILTER (WHERE s.status = 'ACTIVE') * 10)::numeric))::float AS compliance_score
     FROM owners o
     LEFT JOIN vehicles v ON v.owner_id = o.owner_id
     LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     LEFT JOIN incidents i ON i.vehicle_id = v.vehicle_id
     LEFT JOIN sanctions s ON (s.owner_id = o.owner_id OR s.vehicle_id = v.vehicle_id)
     GROUP BY o.owner_id
     ORDER BY compliance_score ASC`
  );

  if (format === "pdf") {
    const pdf = buildSimplePdf({
      title: "Laporan Kepatuhan Armada",
      rows: rows.map((r) => ({
        report_date: r.name,
        plate_no: `${r.total_vehicles} kendaraan`,
        route_id: `Risk: ${r.avg_risk_score}`,
        total_rit: `Score: ${r.compliance_score}`
      }))
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="compliance-report.pdf"`);
    return res.send(pdf);
  }

  if (format !== "csv") {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "format must be csv or pdf" } });
  }

  const header = "Owner,Type,Total Vehicles,Avg Risk Score,Incidents (30d),Active Sanctions,Compliance Score";
  const csvRows = rows.map((r) =>
    [r.name, r.owner_type, r.total_vehicles, r.avg_risk_score, r.incident_count_30d, r.active_sanction_count, r.compliance_score].join(",")
  );

  await auditLog(req, { action: "EXPORT_COMPLIANCE_FLEET", entityType: "compliance" });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="compliance-report.csv"`);
  res.send([header, ...csvRows].join("\n"));
}));

// --- End Phase 15 Routes ---

// === Phase 16: Heatmap Operasional Real ===

app.post("/analytics/heatmap/generate", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { type = "ALL", hours = 24 } = req.body;
  const validTypes = ["ALL", "STOP_DENSITY", "NGETEM_ZONE", "OFF_ROUTE_ZONE", "SPEED_ZONE"];
  if (!validTypes.includes(type)) return res.status(400).json({ error: "Invalid type" });
  if (hours < 1 || hours > 720) return res.status(400).json({ error: "hours must be 1-720" });

  if (type === "ALL") {
    await pool.query(`DELETE FROM heatmap_data WHERE created_at < now() - interval '1 hour'`);
  } else {
    await pool.query(`DELETE FROM heatmap_data WHERE type = $1 AND created_at < now() - interval '1 hour'`, [type]);
  }

  const result = await enqueueHeatmapGeneration(type, hours);
  if (result.disabled) {
    return res.status(503).json({
      ok: false,
      error: { code: "WORKER_QUEUE_DISABLED", message: "Heatmap generation queue is disabled or unavailable." },
      ...result,
      type,
      hours
    });
  }
  res.json({ ok: true, ...result, type, hours });
}));

app.get("/analytics/heatmap", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { type, range = "24h", route_id } = req.query;
  const validTypes = ["STOP_DENSITY", "NGETEM_ZONE", "OFF_ROUTE_ZONE", "SPEED_ZONE"];
  if (!type || !validTypes.includes(type)) return res.status(400).json({ error: "type required: STOP_DENSITY|NGETEM_ZONE|OFF_ROUTE_ZONE|SPEED_ZONE" });

  const rangeMap = { "24h": 1, "7d": 7, "30d": 30 };
  const days = rangeMap[range] || 1;

  let sql = `
    SELECT grid_lat, grid_lon, route_id, metric, value, vehicle_count, metadata, created_at
    FROM heatmap_data
    WHERE type = $1
      AND created_at >= now() - make_interval(days => $2)
  `;
  const params = [type, days];

  if (route_id) {
    params.push(route_id);
    sql += ` AND route_id = $${params.length}`;
  }

  sql += ` ORDER BY value DESC LIMIT 5000`;

  const { rows } = await pool.query(sql, params);
  res.json({ type, range, count: rows.length, data: rows });
}));

app.get("/analytics/heatmap/insights", auth, requireRole(["ANALISA"]), asyncHandler(async (req, res) => {
  const { range = "7d" } = req.query;
  const rangeMap = { "24h": 1, "7d": 7, "30d": 30 };
  const days = rangeMap[range] || 7;

  const busiestStops = await pool.query(
    `SELECT route_id, metadata->>'stop_name' as stop_name,
       sum(value)::integer as total_stops, sum(vehicle_count)::integer as total_vehicles
     FROM heatmap_data
     WHERE type = 'STOP_DENSITY' AND created_at >= now() - make_interval(days => $1)
     GROUP BY route_id, metadata->>'stop_name'
     ORDER BY total_stops DESC
     LIMIT 5`,
    [days]
  );

  const ngetemRoutes = await pool.query(
    `SELECT h.route_id, r.name as route_name,
       sum(h.value)::integer as total_ngetem, sum(h.vehicle_count)::integer as total_vehicles
     FROM heatmap_data h
     LEFT JOIN routes r ON r.route_id = h.route_id
     WHERE h.type = 'NGETEM_ZONE' AND h.created_at >= now() - make_interval(days => $1)
     GROUP BY h.route_id, r.name
     ORDER BY total_ngetem DESC
     LIMIT 5`,
    [days]
  );

  const offRouteRoutes = await pool.query(
    `SELECT h.route_id, r.name as route_name,
       sum(h.value)::integer as total_off_route, sum(h.vehicle_count)::integer as total_vehicles
     FROM heatmap_data h
     LEFT JOIN routes r ON r.route_id = h.route_id
     WHERE h.type = 'OFF_ROUTE_ZONE' AND h.created_at >= now() - make_interval(days => $1)
     GROUP BY h.route_id, r.name
     ORDER BY total_off_route DESC
     LIMIT 5`,
    [days]
  );

  const speedRoutes = await pool.query(
    `SELECT h.route_id, r.name as route_name,
       round(avg(h.value)::numeric, 1) as avg_speed,
       max((h.metadata->>'max_speed')::numeric) as max_speed,
       sum(h.vehicle_count)::integer as total_vehicles
     FROM heatmap_data h
     LEFT JOIN routes r ON r.route_id = h.route_id
     WHERE h.type = 'SPEED_ZONE' AND h.created_at >= now() - make_interval(days => $1)
     GROUP BY h.route_id, r.name
     ORDER BY avg_speed DESC
     LIMIT 5`,
    [days]
  );

  res.json({
    range,
    insights: {
      busiest_stops: busiestStops.rows,
      most_ngetem_routes: ngetemRoutes.rows,
      most_off_route_routes: offRouteRoutes.rows,
      highest_speed_routes: speedRoutes.rows,
    },
  });
}));

app.get("/analytics/heatmap/status", auth, requireRole(["ANALISA"]), asyncHandler(async (_req, res) => {
  const latest = await pool.query(
    `SELECT type, max(created_at) as last_generated, count(*)::integer as data_points
     FROM heatmap_data
     GROUP BY type
     ORDER BY type`
  );
  res.json({ types: latest.rows });
}));

// --- End Phase 16 Routes ---

app.get("/reports/kpi", auth, requireRole(["ANALISA"]), asyncHandler(async (_req, res) => {
  const latestResult = await query("SELECT MAX(report_date) AS latest FROM report_kpi_daily");
  const latestDate = latestResult.rows[0]?.latest;

  if (!latestDate) {
    return res.json({ date: null, kpis: [], incidents_by_category: [] });
  }

  const previousResult = await query(
    "SELECT MAX(report_date) AS previous FROM report_kpi_daily WHERE report_date < $1",
    [latestDate]
  );
  const previousDate = previousResult.rows[0]?.previous || latestDate;

  const currentAgg = await query(
    `SELECT
        AVG(on_route_pct) AS on_route_pct,
        AVG(avg_rit) AS avg_rit,
        AVG(avg_idle_sec) AS avg_idle_sec,
        AVG(avg_latency_sec) AS avg_latency_sec,
        AVG(incident_count) AS incident_count
     FROM report_kpi_daily
     WHERE report_date = $1`,
    [latestDate]
  );
  const previousAgg = await query(
    `SELECT
        AVG(on_route_pct) AS on_route_pct,
        AVG(avg_rit) AS avg_rit,
        AVG(avg_idle_sec) AS avg_idle_sec,
        AVG(avg_latency_sec) AS avg_latency_sec,
        AVG(incident_count) AS incident_count
     FROM report_kpi_daily
     WHERE report_date = $1`,
    [previousDate]
  );

  const current = currentAgg.rows[0];
  const previous = previousAgg.rows[0];

  const onRouteDiff = Number(current.on_route_pct || 0) - Number(previous.on_route_pct || 0);
  const ritDiff = Number(current.avg_rit || 0) - Number(previous.avg_rit || 0);
  const idleDiff = Number(current.avg_idle_sec || 0) - Number(previous.avg_idle_sec || 0);
  const latencyDiff = Number(current.avg_latency_sec || 0) - Number(previous.avg_latency_sec || 0);
  const incidentDiff = Number(current.incident_count || 0) - Number(previous.incident_count || 0);

  const kpis = [
    {
      title: "Kepatuhan Trayek (On-Route)",
      value: `${Number(current.on_route_pct || 0).toFixed(1)}%`,
      trend: formatSigned(onRouteDiff, "%"),
      trend_up: onRouteDiff >= 0,
      color: "emerald"
    },
    {
      title: "Rata-rata Rit per Armada/Hari",
      value: Number(current.avg_rit || 0).toFixed(1),
      trend: formatSigned(ritDiff, "", 1),
      trend_up: ritDiff >= 0,
      color: "blue"
    },
    {
      title: "Durasi Ngetem Rata-rata",
      value: formatDuration(current.avg_idle_sec || 0),
      trend: formatSigned(idleDiff, "s", 0),
      trend_up: idleDiff <= 0,
      color: "orange"
    },
    {
      title: "Rata-rata Latensi",
      value: formatDuration(current.avg_latency_sec || 0),
      trend: formatSigned(latencyDiff, "s", 0),
      trend_up: latencyDiff <= 0,
      color: "indigo"
    },
    {
      title: "Jumlah Insiden",
      value: `${Math.round(Number(current.incident_count || 0))}`,
      trend: formatSigned(incidentDiff, "", 0),
      trend_up: incidentDiff <= 0,
      color: "red"
    }
  ];

  const incidentsByCategoryResult = await query(
    `SELECT type, COUNT(*)::int AS total
     FROM incidents
     WHERE created_at::date = $1
     GROUP BY type`,
    [latestDate]
  );

  const totalIncidents = incidentsByCategoryResult.rows.reduce((sum, row) => sum + row.total, 0) || 1;
  const incidentsByCategory = incidentsByCategoryResult.rows.map((row) => ({
    label: row.type,
    val: Math.round((row.total / totalIncidents) * 100)
  }));

  await auditLog(_req, { action: "READ_REPORT_KPI", entityType: "report_kpi", metadata: { date: latestDate } });
  res.json({ date: latestDate, kpis, incidents_by_category: incidentsByCategory });
}));

app.post("/telemetry/driver-panic", rateLimitTelemetry, verifyTelemetryAuth, validate(driverPanicSchema), asyncHandler(async (req, res) => {
  const vehicle = await resolveEmergencyVehicle(req.body);
  if (!vehicle) {
    return res.status(404).json({ error: { code: "VEHICLE_NOT_FOUND", message: "Vehicle/device for panic button not found" } });
  }

  const emergencyBody = {
    ...req.body,
    category: "PANIC_BUTTON",
    message: "Driver/device panic button triggered.",
    vehicle_id: vehicle.vehicle_id
  };

  const duplicate = await findDuplicateEmergency({
    vehicleId: vehicle.vehicle_id,
    source: "DRIVER_DEVICE"
  });
  if (duplicate) {
    return res.json({ ...duplicate, duplicate: true });
  }

  const incident = await insertEmergencyIncident({
    req,
    source: "DRIVER_DEVICE",
    user: null,
    body: emergencyBody
  });

  res.status(201).json({
    incident_id: incident.incident_id,
    duplicate: false,
    type: incident.type,
    severity: incident.severity,
    status: incident.status,
    trust_level: incident.trust_level,
    escalation_state: incident.escalation_state,
    ack_due_at: incident.ack_due_at,
    assignment_due_at: incident.assignment_due_at,
    vehicle_id: incident.vehicle_id
  });
}));

app.post("/telemetry/passenger", rateLimitTelemetry, passengerTrackingAuth, validate(passengerTelemetrySchema), asyncHandler(async (req, res) => {
  const lat = parseRequiredNumber(req.body?.lat);
  const lon = parseRequiredNumber(req.body?.lon);
  const accuracy = parseOptionalNumber(req.body?.accuracy);
  const batteryLevel = parseOptionalNumber(req.body?.battery_level);
  const timestamp = parseDateParam(req.body?.timestamp) || new Date();
  const appState = req.body?.app_state ? String(req.body.app_state).slice(0, 40) : "BACKGROUND";
  const sessionId = req.body?.session_id || req.passengerTracking.session_id;

  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Passenger location invalid" } });
  }
  if (String(sessionId) !== String(req.passengerTracking.session_id)) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid passenger tracking session" } });
  }

  const { rows } = await query(
    `INSERT INTO passenger_positions (
       user_id,
       session_id,
       token_id,
       ts,
       lat,
       lon,
       accuracy,
       battery_level,
       app_state
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING position_id, ts`,
    [
      req.passengerTracking.user_id,
      req.passengerTracking.session_id,
      req.passengerTracking.token_id,
      timestamp,
      lat,
      lon,
      accuracy,
      batteryLevel,
      appState
    ]
  );

  await query("UPDATE passenger_tracking_tokens SET last_used_at = now() WHERE token_id = $1", [
    req.passengerTracking.token_id
  ]);

  res.json({
    ok: true,
    position_id: rows[0]?.position_id,
    ts: rows[0]?.ts,
    session_id: req.passengerTracking.session_id
  });
}));

app.post("/telemetry/vehicle", rateLimitTelemetry, verifyTelemetryAuth, validate(vehicleTelemetrySchema), asyncHandler(async (req, res) => {
  const result = await ingestVehicleTelemetry(req.body);
  if (!result.ok) {
    return res.status(result.status).json({ error: result.error });
  }

  res.json({ ok: true, matched_position: result.matched_position });
}));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: "/realtime" });
const realtimeInstanceId = process.env.INSTANCE_ID || crypto.randomUUID();
const realtimeBroadcastChannel = process.env.REALTIME_BROADCAST_CHANNEL || "realtime:broadcast";
const realtimePubSubEnabled = process.env.REALTIME_PUBSUB_ENABLED !== "false";
const realtimeBroadcastLockKey = process.env.REALTIME_BROADCAST_LOCK_KEY || "realtime:broadcast:leader";
const realtimeBroadcastLockTtlMs = Number(
  process.env.REALTIME_BROADCAST_LOCK_TTL_MS || Math.max(1000, realtimeIntervalMs - 250)
);

const handleRealtimeConnection = createRealtimeConnectionHandler({
  safeCorsOrigins,
  parseCookies,
  verifyToken: (token) => jwt.verify(token, jwtSecret),
  createRealtimeFilters,
  getPassengerLocationAccessPolicy,
  auditLog,
  fetchNotifications,
  fetchUnreadNotificationCount,
  notificationWindowMs: realtimeNotificationWindowMs,
  isClientOpen: (client) => client.readyState === WebSocket.OPEN
});

wss.on("connection", handleRealtimeConnection);

const { broadcastRealtimeTick, handleRealtimePubSubMessage } = createRealtimeBroadcaster({
  instanceId: realtimeInstanceId,
  fetchOpenIncidents,
  fetchUnreadNotificationCount,
  fetchNotifications,
  fetchLatestVehicles,
  fetchLatestPassengers,
  getPassengerLocationAccessPolicy,
  serializePassengerForPrincipal,
  filterRealtimeIncidents,
  createRealtimePayloads,
  realtimeVehicleScopeKey,
  realtimePassengerScopeKey,
  publishRealtimeMessage: realtimePubSubEnabled
    ? (message) => publishToChannel(realtimeBroadcastChannel, message)
    : null,
  isClientOpen: (client) => client.readyState === WebSocket.OPEN
});

if (realtimePubSubEnabled) {
  void subscribeToChannel(realtimeBroadcastChannel, (message) => handleRealtimePubSubMessage(message, wss.clients));
}

const broadcastScheduledRealtimeTick = async () => {
  if (wss.clients.size === 0) return;
  if (!realtimePubSubEnabled) {
    await broadcastRealtimeTick(wss.clients, { publish: false });
    return;
  }

  const lockAcquired = await tryAcquireRedisLock(
    realtimeBroadcastLockKey,
    realtimeInstanceId,
    realtimeBroadcastLockTtlMs
  );
  if (lockAcquired === false) return;

  await broadcastRealtimeTick(wss.clients, { publish: lockAcquired === true });
};

setInterval(() => {
  void broadcastScheduledRealtimeTick();
}, realtimeIntervalMs);

const port = Number(process.env.PORT || 4000);
await verifyRequiredSchema();
// Workers run in a dedicated `worker` process in production (RUN_WORKERS=false here).
// Default (unset) keeps them in-process so a standalone `node src/server.js` still
// processes jobs. See src/worker.js and docs/runbooks/scale-out.md.
if (process.env.RUN_WORKERS !== "false") {
  startPublicReportReviewWorker();
  startPublicReportEvidenceWorker();
  startHeatmapWorker();
}
server.listen(port, () => {
  console.log(`api-gateway listening on http://localhost:${port} instance_id=${realtimeInstanceId}`);
});
