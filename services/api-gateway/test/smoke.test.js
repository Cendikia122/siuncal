import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Integration smoke test for the running api-gateway.
// Skips automatically when no server is reachable so `npm test` stays green
// without a live stack. Point SMOKE_BASE_URL at the gateway to run it:
//   SMOKE_BASE_URL=http://localhost:4000 node --test test/smoke.test.js
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4000";
const publicVehiclesCacheTtlSec = process.env.PUBLIC_VEHICLES_CACHE_TTL_SEC || "3";
const publicVehiclesCdnCacheTtlSec = process.env.PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC || "5";

// Probe reachability once at load time so `skip` can be a boolean.
const serverUp = await (async () => {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
})();

const skip = serverUp ? false : "no api-gateway reachable at SMOKE_BASE_URL";

describe("api-gateway smoke (integration)", () => {
  it("health endpoint returns 200", { skip }, async () => {
    const res = await fetch(`${BASE}/health`);
    assert.equal(res.status, 200);
  });

  it("protected dashboard endpoint rejects unauthenticated requests", { skip }, async () => {
    const res = await fetch(`${BASE}/dashboard/summary`);
    assert.equal(res.status, 401);
  });

  it("public vehicles endpoint is reachable without auth", { skip }, async () => {
    const res = await fetch(`${BASE}/public/vehicles`);
    // 200 normally, 429 if the public rate limiter has been hit
    assert.ok([200, 429].includes(res.status), `unexpected status ${res.status}`);
    if (res.status === 200) {
      assert.equal(
        res.headers.get("cache-control"),
        `public, max-age=${publicVehiclesCacheTtlSec}, s-maxage=${publicVehiclesCdnCacheTtlSec}`
      );
      assert.equal(res.headers.get("surrogate-control"), `max-age=${publicVehiclesCdnCacheTtlSec}`);
    }
  });

  it("invalid telemetry token is rejected", { skip }, async () => {
    const res = await fetch(`${BASE}/telemetry/vehicle`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-telemetry-token": "definitely-invalid" },
      body: JSON.stringify({ lat: -6.59, lon: 106.81 }),
    });
    assert.ok([401, 403].includes(res.status), `unexpected status ${res.status}`);
  });
});
