import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, it } from "node:test";

import { publishToChannel, subscribeToChannel, tryAcquireRedisLock } from "../src/redis.js";

class FakeRedisSubscriber extends EventEmitter {
  status = "wait";
  connected = false;
  disconnected = false;
  subscribed = [];
  unsubscribed = [];

  async connect() {
    this.connected = true;
    this.status = "ready";
  }

  async subscribe(channel) {
    this.subscribed.push(channel);
  }

  async unsubscribe(channel) {
    this.unsubscribed.push(channel);
  }

  disconnect() {
    this.disconnected = true;
  }
}

describe("api-gateway redis pub/sub helpers", () => {
  it("publishes structured messages as JSON and returns false on Redis errors", async () => {
    const published = [];
    const redis = {
      async publish(channel, payload) {
        published.push({ channel, payload });
      }
    };

    assert.equal(await publishToChannel("realtime:broadcast", { ok: true }, { redis }), true);
    assert.deepEqual(published, [
      { channel: "realtime:broadcast", payload: "{\"ok\":true}" }
    ]);

    const failingRedis = {
      async publish() {
        throw new Error("redis unavailable");
      }
    };
    assert.equal(await publishToChannel("realtime:broadcast", { ok: true }, { redis: failingRedis }), false);
  });

  it("subscribes on a separate client, parses JSON payloads, and cleans up", async () => {
    const subscriber = new FakeRedisSubscriber();
    const received = [];

    const unsubscribe = await subscribeToChannel("realtime:broadcast", (message, meta) => {
      received.push({ message, meta });
    }, { subscriber });

    subscriber.emit("message", "other:channel", "{\"ignored\":true}");
    subscriber.emit("message", "realtime:broadcast", "{\"type\":\"REALTIME_TICK\",\"instanceId\":\"api-b\"}");
    await new Promise((resolve) => setImmediate(resolve));

    assert.equal(subscriber.connected, true);
    assert.deepEqual(subscriber.subscribed, ["realtime:broadcast"]);
    assert.deepEqual(received, [
      {
        message: { type: "REALTIME_TICK", instanceId: "api-b" },
        meta: {
          channel: "realtime:broadcast",
          raw: "{\"type\":\"REALTIME_TICK\",\"instanceId\":\"api-b\"}"
        }
      }
    ]);

    await unsubscribe();

    assert.deepEqual(subscriber.unsubscribed, ["realtime:broadcast"]);
    assert.equal(subscriber.disconnected, true);
  });

  it("acquires Redis locks with PX/NX and reports Redis outages as null", async () => {
    const commands = [];
    const redis = {
      async set(...args) {
        commands.push(args);
        return "OK";
      }
    };

    assert.equal(await tryAcquireRedisLock("realtime:broadcast:leader", "api-a", 2750, { redis }), true);
    assert.deepEqual(commands, [["realtime:broadcast:leader", "api-a", "PX", 2750, "NX"]]);

    const lockedRedis = {
      async set() {
        return null;
      }
    };
    assert.equal(await tryAcquireRedisLock("realtime:broadcast:leader", "api-b", 2750, { redis: lockedRedis }), false);

    const failingRedis = {
      async set() {
        throw new Error("redis unavailable");
      }
    };
    assert.equal(await tryAcquireRedisLock("realtime:broadcast:leader", "api-c", 2750, { redis: failingRedis }), null);
  });
});
