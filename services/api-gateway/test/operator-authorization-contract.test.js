import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const protectedGetRoutes = [
  "/incident-assignees",
  "/owners",
  "/owners/:id",
  "/vehicles",
  "/incidents",
  "/incidents/:id",
  "/notifications",
  "/geofences",
  "/routes",
  "/stops",
  "/vehicles/:id",
  "/vehicles/:id/playback",
  "/vehicles/:id/playback/records",
  "/vehicles/:id/incidents",
  "/dashboard/summary",
  "/telemetry/quality",
  "/activities",
];

const protectedPostRoutes = [
  "/notifications/read",
  "/vehicles/:id/playback/records",
];

test("operator dashboard role helper allows only OPERATOR and ANALISA", () => {
  assert.match(server, /const requireOperatorDashboardRole = requireRole\(\["OPERATOR", "ANALISA"\]\)/);
});

test("internal operator GET endpoints require dashboard roles", () => {
  for (const route of protectedGetRoutes) {
    assert.match(
      server,
      new RegExp(`app\\.get\\("${escapeRegExp(route)}", auth, requireOperatorDashboardRole,`),
      `${route} must require OPERATOR/ANALISA role`
    );
  }
});

test("internal operator POST endpoints require dashboard roles", () => {
  for (const route of protectedPostRoutes) {
    assert.match(
      server,
      new RegExp(`app\\.post\\("${escapeRegExp(route)}", auth, requireOperatorDashboardRole,`),
      `${route} must require OPERATOR/ANALISA role`
    );
  }
});

test("web login accepts dashboard operators and emergency field officers", () => {
  const loginRoute = server.match(/app\.post\("\/auth\/login"[\s\S]*?\[email, password\]\s*\);/)?.[0] ?? "";

  assert.match(
    loginRoute,
    /AND \('OPERATOR' = ANY\(roles\) OR 'ANALISA' = ANY\(roles\) OR 'PETUGAS_LAPANGAN' = ANY\(roles\)\)/
  );
});
