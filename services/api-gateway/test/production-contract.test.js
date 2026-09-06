import assert from "node:assert/strict";
import { describe, it } from "node:test";

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4000";
const clientIpNamespace = `${(process.pid & 0xffff).toString(16)}:${(Date.now() & 0xffff).toString(16)}`;
const clientIp = (suffix) => `2001:db8:${clientIpNamespace}::${suffix}`;

const serverUp = await (async () => {
  try {
    const response = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return response.ok;
  } catch {
    return false;
  }
})();

const skip = serverUp ? false : "no api-gateway reachable at SMOKE_BASE_URL";

const assertErrorEnvelope = (payload, expectedCode) => {
  assert.equal(typeof payload, "object");
  assert.equal(typeof payload.error, "object");
  assert.equal(payload.error.code, expectedCode);
  assert.equal(typeof payload.error.message, "string");
  assert.ok(payload.error.message.length > 0);
};

const dashboardCookie = async () => {
  const response = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": clientIp(2)
    },
    body: JSON.stringify({ email: "operator@pemda.go.id", password: "password123" })
  });
  assert.equal(response.status, 200);
  return response.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
};

describe("api-gateway production contract", () => {
  it("returns the stable error envelope for unauthenticated dashboard requests", { skip }, async () => {
    const response = await fetch(`${BASE}/dashboard/summary`);
    const payload = await response.json();

    assert.equal(response.status, 401);
    assertErrorEnvelope(payload, "UNAUTHORIZED");
  });

  it("returns 403 with the stable error envelope when a public user accesses the dashboard", { skip }, async () => {
    const loginResponse = await fetch(`${BASE}/auth/mobile/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": clientIp(3)
      },
      body: JSON.stringify({ email: "warga@sentra.id", password: "password123" })
    });
    const session = await loginResponse.json();
    assert.equal(loginResponse.status, 200);
    assert.equal(typeof session.access_token, "string");

    const response = await fetch(`${BASE}/dashboard/summary`, {
      headers: { authorization: `Bearer ${session.access_token}` }
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assertErrorEnvelope(payload, "FORBIDDEN");
  });

  it("returns the stable paginated list envelope for dashboard vehicles", { skip }, async () => {
    const cookie = await dashboardCookie();
    const response = await fetch(`${BASE}/vehicles?page=1&limit=2`, {
      headers: { cookie }
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.ok(Array.isArray(payload.items));
    assert.equal(typeof payload.total, "number");
    assert.equal(payload.page, 1);
    assert.equal(payload.limit, 2);
  });

  it("returns Retry-After with the stable error envelope when login is rate limited", { skip }, async () => {
    let limitedResponse;

    for (let attempt = 0; attempt < 12; attempt += 1) {
      const response = await fetch(`${BASE}/auth/login`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": clientIp(1)
        },
        body: JSON.stringify({
          email: "production-contract@example.invalid",
          password: "invalid-password"
        })
      });

      if (response.status === 429) {
        limitedResponse = response;
        break;
      }

      assert.equal(response.status, 401);
    }

    assert.ok(limitedResponse, "expected the login rate limiter to return 429");
    const payload = await limitedResponse.json();
    assertErrorEnvelope(payload, "RATE_LIMITED");

    const retryAfter = limitedResponse.headers.get("retry-after");
    assert.ok(retryAfter, "expected Retry-After header");
    assert.ok(Number(retryAfter) >= 1);
  });
});
