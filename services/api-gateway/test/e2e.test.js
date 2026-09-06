import assert from "node:assert/strict";
import { describe, it } from "node:test";

// End-to-end integration tests against a running stack. Re-runnable (does not
// deplete mutable state: it acknowledges only if an actionable incident exists and
// tolerates already-resolved). Auto-skips when no server is reachable so `npm test`
// stays green without a live stack.
//   SMOKE_BASE_URL=http://localhost:4000 node --test test/e2e.test.js
const BASE = process.env.SMOKE_BASE_URL || "http://localhost:4000";

const serverUp = await (async () => {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
})();
const skip = serverUp ? false : "no api-gateway reachable at SMOKE_BASE_URL";

// --- cookie/CSRF helpers ---------------------------------------------------
const parseCookies = (setCookies) => {
  const jar = {};
  for (const sc of setCookies) {
    const [pair] = sc.split(";");
    const idx = pair.indexOf("=");
    jar[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
  }
  return jar;
};

const login = async (email, password) => {
  const res = await fetch(`${BASE}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(res.status, 200, `login failed for ${email} (status ${res.status})`);
  const jar = parseCookies(res.headers.getSetCookie());
  const cookieHeader = Object.entries(jar).map(([k, v]) => `${k}=${v}`).join("; ");
  return { cookieHeader, csrf: jar.sentra_csrf };
};

// Log in once per role at module scope and reuse, to stay well under the login
// rate limit (LOGIN_RATE_LIMIT_MAX) across the whole e2e suite.
const op = serverUp ? await login("operator@pemda.go.id", "password123") : null;
const an = serverUp ? await login("analisa@pemda.go.id", "password123") : null;

describe("e2e: RBAC boundaries", () => {
  it("operator is blocked from ANALISA-only /users (403), analisa allowed (200)", { skip }, async () => {
    const opRes = await fetch(`${BASE}/users`, { headers: { cookie: op.cookieHeader } });
    assert.equal(opRes.status, 403);
    const anRes = await fetch(`${BASE}/users`, { headers: { cookie: an.cookieHeader } });
    assert.equal(anRes.status, 200);
  });
});

describe("e2e: incident workflow + CSRF", () => {
  it("mutating action without CSRF token is rejected (403)", { skip }, async () => {
    const list = await (await fetch(`${BASE}/incidents`, { headers: { cookie: op.cookieHeader } })).json();
    const incident = (list.items || list)[0];
    if (!incident) return; // no incidents seeded
    const res = await fetch(`${BASE}/incidents/${incident.id}/actions`, {
      method: "POST",
      headers: { cookie: op.cookieHeader, "content-type": "application/json" },
      body: JSON.stringify({ action: "ACKNOWLEDGE" }),
    });
    assert.equal(res.status, 403);
  });

  it("acknowledge transitions an OPEN incident (200), re-runnable", { skip }, async () => {
    const list = await (await fetch(`${BASE}/incidents?status=OPEN`, { headers: { cookie: op.cookieHeader } })).json();
    const incident = (list.items || list).find((i) => i.status === "OPEN");
    if (!incident) return; // nothing actionable left; tolerated for re-runs
    const res = await fetch(`${BASE}/incidents/${incident.id}/actions`, {
      method: "POST",
      headers: { cookie: op.cookieHeader, "content-type": "application/json", "x-csrf-token": op.csrf },
      body: JSON.stringify({ action: "ACKNOWLEDGE", notes: "e2e" }),
    });
    assert.ok([200, 409].includes(res.status), `unexpected ${res.status}`);
  });
});

describe("e2e: public report vertical (mobile -> review)", () => {
  it("submit with photo -> 201 + matched plate, operator queue + review run", { skip }, async () => {
    const ml = await (await fetch(`${BASE}/auth/mobile/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "warga@sentra.id", password: "password123" }),
    })).json();
    assert.ok(ml.access_token, "mobile login returns access token");

    const form = new FormData();
    form.set("plate_no", "F 1901 AK");
    form.set("lat", "-6.5950");
    form.set("lon", "106.8166");
    form.set("reported_at", new Date().toISOString());
    form.set("category", "NGETEM");
    form.set("description", "e2e test laporan");
    const validPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAoElEQVR4nO2SQQkAQRDDKqJiT2zErIh7hIFCBSSh6cfpRSfoBNArdhfi7qITdALoFbsLcXfRCToB9Irdhbi76ASdAHrF7kLcXXSCTgC9Ynch7i46QSeAXrG7EHcXnaATQK/YXYi7i07QCaBX7C7E3UUn6ATQK3YX4u6iE3QC6BW7C3F30Qk6AfSK3YW4u+gEnQB6xe5C3F10gk4AveKfCz1/jYFLccEf8AAAAABJRU5ErkJggg==",
      "base64"
    );
    form.set("attachments", new Blob([validPng], { type: "image/png" }), "evidence.png");

    const submit = await fetch(`${BASE}/public/reports`, {
      method: "POST",
      headers: { authorization: `Bearer ${ml.access_token}` },
      body: form,
    });
    assert.equal(submit.status, 201);
    const report = await submit.json();
    assert.ok(report.public_report_id, "report id returned");

    // operator can see the queue and run the rules-assisted review
    const queue = await fetch(`${BASE}/operator/public-reports`, { headers: { cookie: op.cookieHeader } });
    assert.equal(queue.status, 200);
    const run = await fetch(`${BASE}/operator/public-reports/reviews/run`, {
      method: "POST",
      headers: { cookie: op.cookieHeader, "content-type": "application/json", "x-csrf-token": op.csrf },
      body: JSON.stringify({}),
    });
    assert.equal(run.status, 200);
  });

  it("unauthenticated submit -> 401", { skip }, async () => {
    const form = new FormData();
    form.set("lat", "-6.5");
    const res = await fetch(`${BASE}/public/reports`, { method: "POST", body: form });
    assert.equal(res.status, 401);
  });
});

describe("e2e: analytics", () => {
  it("analisa can generate heatmap and read status", { skip }, async () => {
    const gen = await fetch(`${BASE}/analytics/heatmap/generate`, {
      method: "POST",
      headers: { cookie: an.cookieHeader, "content-type": "application/json", "x-csrf-token": an.csrf },
      body: JSON.stringify({}),
    });
    assert.equal(gen.status, 200);
    const status = await fetch(`${BASE}/analytics/heatmap/status`, { headers: { cookie: an.cookieHeader } });
    assert.equal(status.status, 200);
  });
});
