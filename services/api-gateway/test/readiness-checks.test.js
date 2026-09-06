import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createReadinessChecker } from "../src/readiness-checks.js";

describe("api-gateway readiness checks", () => {
  it("reports ready when Postgres, Redis, and object storage are ready", async () => {
    const checkReadiness = createReadinessChecker({
      query: async (text) => {
        assert.equal(text, "SELECT 1");
        return { rows: [{ ok: 1 }] };
      },
      checkRedisReady: async () => ({ ok: true }),
      checkObjectStorageReady: async () => ({ ok: true })
    });

    assert.deepEqual(await checkReadiness(), {
      ok: true,
      service: "api-gateway",
      checks: {
        postgres: { ok: true },
        redis: { ok: true },
        object_storage: { ok: true }
      }
    });
  });

  it("reports dependency errors without throwing", async () => {
    const checkReadiness = createReadinessChecker({
      query: async () => {
        throw new Error("postgres unavailable");
      },
      checkRedisReady: async () => {
        throw new Error("redis unavailable");
      },
      checkObjectStorageReady: async () => ({ ok: false, message: "bucket unavailable" })
    });

    assert.deepEqual(await checkReadiness(), {
      ok: false,
      service: "api-gateway",
      checks: {
        postgres: { ok: false, message: "postgres unavailable" },
        redis: { ok: false, message: "redis unavailable" },
        object_storage: { ok: false, message: "bucket unavailable" }
      }
    });
  });
});
