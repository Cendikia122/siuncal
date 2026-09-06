import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { buildRealtimeFeedUrl } from "../../../apps/operator-web/src/lib/realtime-feed.ts";
import {
  createRealtimeFilters,
  realtimeVehicleScopeKey
} from "../src/realtime-feed.js";

const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
const realtimeQueries = readFileSync(new URL("../src/realtime-queries.js", import.meta.url), "utf8");
const reportJob = readFileSync(new URL("../src/jobs/generate-reports.js", import.meta.url), "utf8");
const currentStateMigration = readFileSync(new URL("../../../db/migrations/018_current_state_tables.sql", import.meta.url), "utf8");
const timescalePoliciesMigration = readFileSync(new URL("../../../db/migrations/019_timescale_policies.sql", import.meta.url), "utf8");

test("current-state migration keeps latest positions in physical tables", () => {
  assert.match(currentStateMigration, /CREATE TABLE IF NOT EXISTS vehicle_current_positions/);
  assert.match(currentStateMigration, /CREATE TABLE IF NOT EXISTS passenger_current_positions/);
  assert.match(currentStateMigration, /CREATE OR REPLACE VIEW vehicle_latest AS[\s\S]*FROM vehicle_current_positions/);
  assert.match(currentStateMigration, /CREATE OR REPLACE VIEW passenger_latest AS[\s\S]*FROM passenger_current_positions/);
  assert.match(currentStateMigration, /CREATE TRIGGER trg_vehicle_current_positions_upsert/);
  assert.match(currentStateMigration, /CREATE TRIGGER trg_passenger_current_positions_upsert/);
  assert.match(currentStateMigration, /WHERE vehicle_current_positions\.ts < EXCLUDED\.ts/);
  assert.match(currentStateMigration, /WHERE passenger_current_positions\.ts < EXCLUDED\.ts/);
});

test("public vehicles and realtime paths support bounded scoped reads", () => {
  assert.match(server, /PUBLIC_VEHICLES_DEFAULT_LIMIT/);
  assert.match(server, /PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC/);
  assert.match(server, /s-maxage=\$\{PUBLIC_VEHICLES_CDN_CACHE_TTL_SEC\}/);
  assert.match(server, /Surrogate-Control/);
  assert.match(server, /parseBboxParam/);
  assert.match(server, /ST_MakeEnvelope/);
  assert.match(server, /v\.route_id = \$\$\{params\.length\}/);
  assert.match(server, /LIMIT \$\$\{params\.length\}/);
  assert.match(server, /createRealtimeQueries/);
  assert.match(realtimeQueries, /fetchLatestVehicles = async \(\{/);
  assert.match(realtimeQueries, /vehicleStatus = null/);
  assert.match(realtimeQueries, /bbox = null/);
  const scoped = createRealtimeFilters(new URLSearchParams({
    route_id: "01",
    vehicle_status: "IN_SERVICE",
    bbox: "106.70,-6.70,106.90,-6.50"
  }));
  assert.deepEqual(scoped.filters.bbox, {
    minLon: 106.70,
    minLat: -6.70,
    maxLon: 106.90,
    maxLat: -6.50
  });
  assert.equal(
    realtimeVehicleScopeKey(scoped.filters),
    JSON.stringify({
      route_id: "01",
      vehicle_status: "IN_SERVICE",
      bbox: scoped.filters.bbox
    })
  );
});

test("telemetry rate limiting is identity-aware behind shared gateways", () => {
  assert.match(server, /TELEMETRY_IP_RATE_LIMIT_MAX/);
  assert.match(server, /isTelemetryWrite/);
  assert.match(server, /telemetryIdentityKey/);
  assert.match(server, /passenger-session:/);
  assert.match(server, /vehicle-device:/);
  assert.match(server, /telemetry-ip:/);
  assert.match(server, /telemetry-identity:/);
});

test("dashboard realtime sends viewport bbox to backend", () => {
  const mapView = readFileSync(new URL("../../../apps/operator-web/src/components/map/map-view.tsx", import.meta.url), "utf8");
  assert.match(mapView, /onBoundsChange/);
  assert.match(mapView, /map\.getBounds\(\)\.pad\(0\.2\)/);
  assert.equal(
    buildRealtimeFeedUrl("ws://localhost:4000/realtime", {
      routeId: "01",
      vehicleStatus: "IN_SERVICE",
      bbox: "106.70,-6.70,106.90,-6.50"
    }),
    "ws://localhost:4000/realtime?route_id=01&vehicle_status=IN_SERVICE&bbox=106.70%2C-6.70%2C106.90%2C-6.50"
  );
});

test("report job uses timestamp ranges instead of date casts", () => {
  assert.match(reportJob, /reportStartAt/);
  assert.match(reportJob, /reportEndAt/);
  assert.match(reportJob, /vp\.ts >= \$2::timestamptz/);
  assert.match(reportJob, /vp\.ts < \$3::timestamptz/);
  assert.match(reportJob, /i\.created_at >= \$2::timestamptz/);
  assert.doesNotMatch(reportJob, /AT TIME ZONE 'Asia\/Jakarta'\)::date/);
});

test("timescale policies define compression retention and continuous aggregate", () => {
  assert.match(timescalePoliciesMigration, /add_compression_policy\('vehicle_positions', INTERVAL '7 days'\)/);
  assert.match(timescalePoliciesMigration, /add_retention_policy\('vehicle_positions', INTERVAL '90 days'\)/);
  assert.match(timescalePoliciesMigration, /add_retention_policy\('passenger_positions', INTERVAL '30 days'\)/);
  assert.match(timescalePoliciesMigration, /CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_positions_hourly/);
  assert.match(timescalePoliciesMigration, /add_continuous_aggregate_policy/);
});
