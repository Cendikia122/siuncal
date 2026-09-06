#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import process from "node:process";
import WebSocket from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESULTS_DIR = resolve(__dirname, "results");

const config = {
  apiBaseUrl: env("LOAD_TEST_API_BASE_URL", "http://localhost:4000").replace(/\/+$/, ""),
  wsUrl: env("LOAD_TEST_WS_URL", "ws://localhost:4000/realtime"),
  email: env("LOAD_TEST_EMAIL", "analisa@pemda.go.id"),
  password: env("LOAD_TEST_PASSWORD", "password123"),
  telemetryToken: env("TELEMETRY_INGEST_TOKEN", "CHANGE_ME_GENERATE_TOKEN"),
  publicDurationSec: intEnv("LOAD_TEST_PUBLIC_DURATION_SEC", 60),
  publicConnections: intEnv("LOAD_TEST_PUBLIC_CONNECTIONS", 50),
  dashboardDurationSec: intEnv("LOAD_TEST_DASHBOARD_DURATION_SEC", 60),
  dashboardConnections: intEnv("LOAD_TEST_DASHBOARD_CONNECTIONS", 20),
  telemetryVehicles: intEnv("LOAD_TEST_TELEMETRY_VEHICLES", 1000),
  telemetryConcurrency: intEnv("LOAD_TEST_TELEMETRY_CONCURRENCY", 50),
  publicP95ThresholdMs: intEnv("LOAD_TEST_PUBLIC_P95_MS", 300),
  dashboardP95ThresholdMs: intEnv("LOAD_TEST_DASHBOARD_P95_MS", 500),
  errorRateThresholdPct: Number(env("LOAD_TEST_ERROR_RATE_PCT", "1"))
};

function env(name, fallback) {
  return process.env[name] || fallback;
}

function intEnv(name, fallback) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[index];
}

function summarizeScenario({ name, durationMs, latencies, statuses, errors, thresholds = {} }) {
  const total = latencies.length + errors.length;
  const failedStatusCount = statuses.filter((status) => status >= 400).length;
  const errorCount = errors.length + failedStatusCount;
  const errorRatePct = total === 0 ? 100 : (errorCount / total) * 100;
  const throughputRps = durationMs > 0 ? (total / durationMs) * 1000 : 0;
  const p95 = percentile(latencies, 95);
  const checks = [];

  if (thresholds.p95Ms) {
    checks.push({
      label: `p95 < ${thresholds.p95Ms}ms`,
      pass: p95 < thresholds.p95Ms,
      actual: `${Math.round(p95)}ms`
    });
  }
  if (thresholds.errorRatePct !== undefined) {
    checks.push({
      label: `error rate < ${thresholds.errorRatePct}%`,
      pass: errorRatePct < thresholds.errorRatePct,
      actual: `${errorRatePct.toFixed(2)}%`
    });
  }

  return {
    name,
    total,
    ok: statuses.filter((status) => status >= 200 && status < 400).length,
    failed: errorCount,
    errors,
    p50: percentile(latencies, 50),
    p75: percentile(latencies, 75),
    p90: percentile(latencies, 90),
    p95,
    max: latencies.length ? Math.max(...latencies) : 0,
    throughputRps,
    errorRatePct,
    checks,
    pass: checks.every((check) => check.pass)
  };
}

async function runHttpScenario({ name, durationSec, connections, request, thresholds }) {
  const deadline = Date.now() + durationSec * 1000;
  const latencies = [];
  const statuses = [];
  const errors = [];
  const startedAt = Date.now();

  const worker = async () => {
    while (Date.now() < deadline) {
      const started = performance.now();
      try {
        const response = await request();
        await response.arrayBuffer();
        statuses.push(response.status);
        latencies.push(performance.now() - started);
      } catch (error) {
        errors.push(error.message);
      }
    }
  };

  await Promise.all(Array.from({ length: connections }, worker));
  return summarizeScenario({
    name,
    durationMs: Date.now() - startedAt,
    latencies,
    statuses,
    errors,
    thresholds
  });
}

async function login() {
  const response = await fetch(`${config.apiBaseUrl}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: config.email, password: config.password })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Login failed: HTTP ${response.status} ${body}`);
  }

  const setCookies = typeof response.headers.getSetCookie === "function"
    ? response.headers.getSetCookie()
    : splitSetCookieHeader(response.headers.get("set-cookie") || "");
  const cookieHeader = setCookies.map((cookie) => cookie.split(";")[0]).filter(Boolean).join("; ");
  if (!cookieHeader.includes("sentra_access=")) {
    throw new Error("Login did not return sentra_access cookie");
  }
  return cookieHeader;
}

function splitSetCookieHeader(header) {
  if (!header) return [];
  return header.split(/,(?=\s*[^;,=]+=[^;,]+)/g).map((value) => value.trim());
}

async function runTelemetryScenario(cookieHeader) {
  const latencies = [];
  const statuses = [];
  const errors = [];
  const startedAt = Date.now();
  const realtimeProbe = await createRealtimeProbe(cookieHeader).catch((error) => ({ error }));

  const vehicles = Array.from({ length: config.telemetryVehicles }, (_, index) => ({
    plate_no: `F ${String(1001 + (index % 45)).padStart(4, "0")} AA`,
    lat: -6.595 + ((index % 20) * 0.0008),
    lon: 106.816 + ((index % 20) * 0.0008),
    speed_kmh: 18 + (index % 35),
    heading: index % 360,
    status: "IN_SERVICE",
    ts: new Date().toISOString()
  }));

  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < vehicles.length) {
      const current = nextIndex;
      nextIndex += 1;
      const started = performance.now();
      try {
        const response = await fetch(`${config.apiBaseUrl}/telemetry/vehicle`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-telemetry-token": config.telemetryToken
          },
          body: JSON.stringify(vehicles[current])
        });
        await response.arrayBuffer();
        statuses.push(response.status);
        latencies.push(performance.now() - started);
      } catch (error) {
        errors.push(error.message);
      }
    }
  };

  await Promise.all(Array.from({ length: config.telemetryConcurrency }, worker));

  const realtimeLatencyMs = realtimeProbe.error
    ? null
    : await realtimeProbe.waitForVehiclePayload(15000).finally(() => realtimeProbe.close());
  if (realtimeProbe.error) {
    errors.push(`WebSocket probe failed: ${realtimeProbe.error.message}`);
  } else if (realtimeLatencyMs === null) {
    errors.push("WebSocket probe did not receive vehicle payload within 15s");
  }

  const summary = summarizeScenario({
    name: "Telemetry ingestion + WebSocket probe",
    durationMs: Date.now() - startedAt,
    latencies,
    statuses,
    errors,
    thresholds: { errorRatePct: config.errorRateThresholdPct }
  });
  summary.realtimeLatencyMs = realtimeLatencyMs;
  return summary;
}

async function createRealtimeProbe(cookieHeader) {
  const connectedAt = performance.now();
  const ws = new WebSocket(config.wsUrl, {
    headers: {
      Cookie: cookieHeader,
      Origin: "http://localhost:3000"
    }
  });

  let resolved = false;
  let resolvePayload;
  const payloadPromise = new Promise((resolve) => {
    resolvePayload = resolve;
  });

  ws.on("message", (raw) => {
    try {
      const payload = JSON.parse(raw.toString());
      if (!resolved && (payload.type === "VEHICLE_POSITIONS" || payload.type === "VEHICLES" || payload.vehicles)) {
        resolved = true;
        resolvePayload(performance.now() - connectedAt);
      }
    } catch {
      // Ignore malformed realtime messages in the probe.
    }
  });

  await new Promise((resolve, reject) => {
    ws.once("open", resolve);
    ws.once("error", reject);
    ws.once("close", (code, reason) => {
      if (code !== 1000 && code !== 1005) reject(new Error(`WebSocket closed ${code}: ${reason.toString()}`));
    });
  });

  return {
    waitForVehiclePayload: (timeoutMs) => Promise.race([
      payloadPromise,
      new Promise((resolve) => setTimeout(() => resolve(null), timeoutMs))
    ]),
    close: () => ws.close()
  };
}

function renderReport({ generatedAt, summaries }) {
  const lines = [
    `# Load Test Report - ${generatedAt}`,
    "",
    `API base URL: \`${config.apiBaseUrl}\``,
    `WebSocket URL: \`${config.wsUrl}\``,
    "",
    "| Scenario | Result | Requests | OK | Failed | p50 | p75 | p90 | p95 | Max | Error Rate | Throughput |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const summary of summaries) {
    lines.push([
      summary.name,
      summary.pass ? "PASS" : "FAIL",
      summary.total,
      summary.ok,
      summary.failed,
      `${Math.round(summary.p50)}ms`,
      `${Math.round(summary.p75)}ms`,
      `${Math.round(summary.p90)}ms`,
      `${Math.round(summary.p95)}ms`,
      `${Math.round(summary.max)}ms`,
      `${summary.errorRatePct.toFixed(2)}%`,
      `${summary.throughputRps.toFixed(2)} rps`
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |"));
  }

  lines.push("", "## Threshold Checks", "");
  for (const summary of summaries) {
    lines.push(`### ${summary.name}`, "");
    for (const check of summary.checks) {
      lines.push(`- ${check.pass ? "PASS" : "FAIL"} ${check.label}; actual ${check.actual}`);
    }
    if (summary.realtimeLatencyMs !== undefined) {
      lines.push(`- WebSocket probe latency: ${summary.realtimeLatencyMs === null ? "not received" : `${Math.round(summary.realtimeLatencyMs)}ms`}`);
    }
    if (summary.errors.length > 0) {
      lines.push("", "Errors:");
      for (const error of [...new Set(summary.errors)].slice(0, 10)) {
        lines.push(`- ${error}`);
      }
    }
    lines.push("");
  }

  lines.push(`Overall: **${summaries.every((summary) => summary.pass) ? "PASS" : "FAIL"}**`, "");
  return lines.join("\n");
}

async function main() {
  await mkdir(RESULTS_DIR, { recursive: true });
  const generatedAt = new Date().toISOString().replace(/[:.]/g, "-");
  const cookieHeader = await login();

  const publicVehicles = await runHttpScenario({
    name: "Public vehicles",
    durationSec: config.publicDurationSec,
    connections: config.publicConnections,
    request: () => fetch(`${config.apiBaseUrl}/public/vehicles`),
    thresholds: {
      p95Ms: config.publicP95ThresholdMs,
      errorRatePct: config.errorRateThresholdPct
    }
  });

  const dashboardSummary = await runHttpScenario({
    name: "Dashboard summary",
    durationSec: config.dashboardDurationSec,
    connections: config.dashboardConnections,
    request: () => fetch(`${config.apiBaseUrl}/dashboard/summary`, {
      headers: { Cookie: cookieHeader }
    }),
    thresholds: {
      p95Ms: config.dashboardP95ThresholdMs,
      errorRatePct: config.errorRateThresholdPct
    }
  });

  const telemetry = await runTelemetryScenario(cookieHeader);
  const summaries = [publicVehicles, dashboardSummary, telemetry];
  const report = renderReport({ generatedAt, summaries });
  const reportPath = resolve(RESULTS_DIR, `REPORT-${generatedAt}.md`);
  await writeFile(reportPath, report);
  console.log(report);
  console.log(`Report written to ${reportPath}`);

  if (!summaries.every((summary) => summary.pass)) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
