import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { evaluateLostSignalDecision } from "../src/rule-decisions.js";

const enabled = process.env.RULES_ENGINE_TEST_DB === "1";

if (enabled) {
  Object.assign(process.env, {
    WRONG_DIRECTION_GRACE_MINUTES: "5",
    WRONG_DIRECTION_MIN_POINTS: "3",
    WRONG_DIRECTION_HEADING_DIFF_DEGREES: "120",
    WRONG_DIRECTION_MIN_SPEED_KMH: "5",
    MAP_MATCHING_MIN_CONFIDENCE: "0.35",
    NGETEM_MINUTES: "20",
    NGETEM_MAX_DISTANCE_METERS: "15",
    NGETEM_MAX_AVG_SPEED: "3",
    OFFICIAL_STOP_RADIUS_METERS: "120"
  });
}

const rulePersistenceSummary = async (vehicleId, rule) => {
  const result = await runtime.query(
    `SELECT
       (SELECT COUNT(*)::int FROM anomalies WHERE vehicle_id = $1 AND rule = $2 AND status = 'OPEN') AS open_anomalies,
       (SELECT COUNT(*)::int FROM alerts WHERE vehicle_id = $1 AND rule = $2) AS alerts,
       (SELECT COUNT(*)::int FROM incidents WHERE vehicle_id = $1 AND type = $2) AS incidents,
       (SELECT COUNT(*)::int FROM risk_score_events WHERE vehicle_id = $1 AND rule = $2 AND event_type = 'ANOMALY') AS risk_events,
       (SELECT COALESCE(SUM(delta), 0)::int FROM risk_score_events WHERE vehicle_id = $1 AND rule = $2 AND event_type = 'ANOMALY') AS risk_delta,
       COALESCE((SELECT current_score::int FROM risk_scores WHERE vehicle_id = $1), 0) AS current_score`,
    [vehicleId, rule]
  );
  return result.rows[0];
};

const insertPosition = async ({ minutesAgo, lat, lon, speedKmh, heading }) => {
  const ts = new Date(Date.now() - (minutesAgo * 60000)).toISOString();
  const result = await runtime.query(
    `INSERT INTO vehicle_positions (vehicle_id, ts, lat, lon, speed_kmh, heading, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'IN_SERVICE')
     RETURNING position_id, ts, lat, lon, speed_kmh, heading`,
    [vehicle.vehicle_id, ts, lat, lon, speedKmh, heading]
  );
  return result.rows[0];
};
const describeIntegration = enabled ? describe : describe.skip;

let runtime;
let ownerId;
let vehicle;
const routeId = `test-route-${Date.now()}`;
const plateNo = `TEST ${Date.now()}`;

const cleanup = async () => {
  if (!runtime || !vehicle?.vehicle_id) return;
  await runtime.query(
    `DELETE FROM notifications
     WHERE incident_id IN (SELECT incident_id FROM incidents WHERE vehicle_id = $1)`,
    [vehicle.vehicle_id]
  );
  await runtime.query(
    `DELETE FROM incident_actions
     WHERE incident_id IN (SELECT incident_id FROM incidents WHERE vehicle_id = $1)`,
    [vehicle.vehicle_id]
  );
  await runtime.query("DELETE FROM incidents WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM telemetry_matched_positions WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM vehicle_positions WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM risk_score_events WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM risk_scores WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM alerts WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM anomalies WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM vehicles WHERE vehicle_id = $1", [vehicle.vehicle_id]);
  await runtime.query("DELETE FROM routes WHERE route_id = $1", [routeId]);
  if (ownerId) await runtime.query("DELETE FROM owners WHERE owner_id = $1", [ownerId]);
};

describeIntegration("rules-engine runtime integration", () => {
  before(async () => {
    if (!/test/i.test(process.env.DB_NAME || "")) {
      throw new Error("Refusing to run rules-engine integration tests unless DB_NAME contains 'test'.");
    }

    runtime = await import("../src/index.js");

    const owner = await runtime.query(
      `INSERT INTO owners (owner_type, name, status)
       VALUES ('INDIVIDUAL', 'Rules Engine Test Owner', 'ACTIVE')
       RETURNING owner_id`
    );
    ownerId = owner.rows[0].owner_id;

    await runtime.query(
      `INSERT INTO routes (route_id, name, color)
       VALUES ($1, 'Rules Engine Test Route', '#16a34a')`,
      [routeId]
    );

    const insertedVehicle = await runtime.query(
      `INSERT INTO vehicles (owner_id, plate_no, route_id, status)
       VALUES ($1, $2, $3, 'IN_SERVICE')
       RETURNING vehicle_id, owner_id, plate_no, route_id, status`,
      [ownerId, plateNo, routeId]
    );
    vehicle = {
      ...insertedVehicle.rows[0],
      lat: -6.6,
      lon: 106.8,
      ts: "2026-06-03T00:00:00.000Z"
    };
  });

  after(async () => {
    try {
      await cleanup();
    } finally {
      if (runtime) await runtime.closeRulesEngine();
    }
  });

  const riskScoreForVehicle = async () => {
    const result = await runtime.query(
      "SELECT COALESCE((SELECT current_score::int FROM risk_scores WHERE vehicle_id = $1), 0) AS current_score",
      [vehicle.vehicle_id]
    );
    return Number(result.rows[0]?.current_score || 0);
  };

  it("opens, deduplicates, scores, creates incident, and resolves a LOST_SIGNAL anomaly", async () => {
    const decision = evaluateLostSignalDecision({
      vehicle,
      nowMs: Date.parse("2026-06-03T00:15:00.000Z"),
      config: { lostSignalMinutes: 3, lostSignalCriticalMinutes: 10 }
    });

    assert.equal(decision.action, "open");
    assert.equal(decision.severity, "CRITICAL");

    const firstOpen = await runtime.openRule({
      vehicle,
      rule: decision.rule,
      severity: decision.severity,
      evidence: decision.evidence,
      lat: decision.lat,
      lon: decision.lon
    });
    assert.equal(firstOpen.anomalyOpened, true);

    const afterFirstOpen = await runtime.query(
      `SELECT
         (SELECT COUNT(*)::int FROM anomalies WHERE vehicle_id = $1 AND rule = 'LOST_SIGNAL' AND status = 'OPEN') AS open_anomalies,
         (SELECT COUNT(*)::int FROM alerts WHERE vehicle_id = $1 AND rule = 'LOST_SIGNAL') AS alerts,
         (SELECT COUNT(*)::int FROM incidents WHERE vehicle_id = $1 AND type = 'LOST_SIGNAL') AS incidents,
         (SELECT COUNT(*)::int FROM risk_score_events WHERE vehicle_id = $1 AND event_type = 'ANOMALY') AS risk_events,
         (SELECT current_score::int FROM risk_scores WHERE vehicle_id = $1) AS current_score`,
      [vehicle.vehicle_id]
    );
    assert.deepEqual(afterFirstOpen.rows[0], {
      open_anomalies: 1,
      alerts: 1,
      incidents: 1,
      risk_events: 1,
      current_score: 10
    });

    const secondOpen = await runtime.openRule({
      vehicle,
      rule: decision.rule,
      severity: decision.severity,
      evidence: decision.evidence,
      lat: decision.lat,
      lon: decision.lon
    });
    assert.equal(secondOpen.anomalyOpened, false);

    const afterDuplicate = await runtime.query(
      `SELECT
         (SELECT COUNT(*)::int FROM anomalies WHERE vehicle_id = $1 AND rule = 'LOST_SIGNAL' AND status = 'OPEN') AS open_anomalies,
         (SELECT COUNT(*)::int FROM alerts WHERE vehicle_id = $1 AND rule = 'LOST_SIGNAL') AS alerts,
         (SELECT COUNT(*)::int FROM incidents WHERE vehicle_id = $1 AND type = 'LOST_SIGNAL') AS incidents,
         (SELECT COUNT(*)::int FROM risk_score_events WHERE vehicle_id = $1 AND event_type = 'ANOMALY') AS risk_events,
         (SELECT current_score::int FROM risk_scores WHERE vehicle_id = $1) AS current_score`,
      [vehicle.vehicle_id]
    );
    assert.deepEqual(afterDuplicate.rows[0], afterFirstOpen.rows[0]);

    await runtime.resolveRule({ vehicle, rule: "LOST_SIGNAL", reason: "integration test resolve" });

    const afterResolve = await runtime.query(
      `SELECT
         (SELECT COUNT(*)::int FROM anomalies WHERE vehicle_id = $1 AND rule = 'LOST_SIGNAL' AND status = 'RESOLVED') AS resolved_anomalies,
         (SELECT COUNT(*)::int FROM alerts WHERE vehicle_id = $1 AND rule = 'LOST_SIGNAL' AND status = 'RESOLVED') AS resolved_alerts,
         (SELECT COUNT(*)::int FROM incidents WHERE vehicle_id = $1 AND type = 'LOST_SIGNAL' AND status = 'RESOLVED') AS resolved_incidents,
         (SELECT COUNT(*)::int FROM incident_actions ia JOIN incidents i ON i.incident_id = ia.incident_id WHERE i.vehicle_id = $1 AND ia.action = 'AUTO_RESOLVE') AS auto_resolve_actions`,
      [vehicle.vehicle_id]
    );
    assert.deepEqual(afterResolve.rows[0], {
      resolved_anomalies: 1,
      resolved_alerts: 1,
      resolved_incidents: 1,
      auto_resolve_actions: 1
    });
  });

  it("opens, scores, and escalates a WRONG_DIRECTION anomaly from matched telemetry", async () => {
    const beforeScore = await riskScoreForVehicle();
    const points = [
      { minutesAgo: 1, lat: -6.12340, lon: 106.12340, speedKmh: 18, heading: 350, matchedHeading: 170 },
      { minutesAgo: 2, lat: -6.12345, lon: 106.12345, speedKmh: 16, heading: 10, matchedHeading: 190 },
      { minutesAgo: 3, lat: -6.12350, lon: 106.12350, speedKmh: 17, heading: 20, matchedHeading: 200 }
    ];

    for (const point of points) {
      const inserted = await insertPosition(point);
      await runtime.query(
        `INSERT INTO telemetry_matched_positions (
           vehicle_id,
           position_id,
           ts,
           route_id,
           direction,
           match_status,
           road_segment,
           confidence,
           snapped_lat,
           snapped_lon,
           snap_distance_m,
           distance_along_route_m,
           route_fraction,
           route_length_m,
           matched_heading,
           raw_lat,
           raw_lon
         )
         VALUES ($1, $2, $3, $4, 'outbound', 'MATCHED', 'test-segment', 0.9000, $5, $6, 3.00, 1000.00, 0.50000000, 2000.00, $7, $8, $9)`,
        [
          vehicle.vehicle_id,
          inserted.position_id,
          inserted.ts,
          routeId,
          point.lat + 0.00001,
          point.lon + 0.00001,
          point.matchedHeading,
          point.lat,
          point.lon
        ]
      );
    }

    const result = await runtime.evaluateWrongDirection(vehicle);
    assert.equal(result.anomalyOpened, true);

    const summary = await rulePersistenceSummary(vehicle.vehicle_id, "WRONG_DIRECTION");
    assert.deepEqual(summary, {
      open_anomalies: 1,
      alerts: 1,
      incidents: 1,
      risk_events: 1,
      risk_delta: 10,
      current_score: Math.min(100, beforeScore + 10)
    });
  });

  it("opens, scores, and escalates a NGETEM anomaly from low-speed clustered telemetry outside official stops", async () => {
    await runtime.query("DELETE FROM telemetry_matched_positions WHERE vehicle_id = $1", [vehicle.vehicle_id]);
    await runtime.query("DELETE FROM vehicle_positions WHERE vehicle_id = $1", [vehicle.vehicle_id]);

    const beforeScore = await riskScoreForVehicle();
    const baseLat = -6.22340;
    const baseLon = 106.22340;
    vehicle.lat = baseLat;
    vehicle.lon = baseLon;
    vehicle.ts = new Date().toISOString();

    const points = [
      { minutesAgo: 1, lat: baseLat, lon: baseLon, speedKmh: 0.8, heading: 90 },
      { minutesAgo: 10, lat: baseLat + 0.00002, lon: baseLon + 0.00002, speedKmh: 1.2, heading: 92 },
      { minutesAgo: 19, lat: baseLat - 0.00002, lon: baseLon - 0.00002, speedKmh: 0.5, heading: 88 }
    ];

    for (const point of points) {
      await insertPosition(point);
    }

    const result = await runtime.evaluateNgetem(vehicle, Date.now());
    assert.equal(result.anomalyOpened, true);

    const summary = await rulePersistenceSummary(vehicle.vehicle_id, "NGETEM");
    assert.deepEqual(summary, {
      open_anomalies: 1,
      alerts: 1,
      incidents: 1,
      risk_events: 1,
      risk_delta: 8,
      current_score: Math.min(100, beforeScore + 8)
    });
  });
});
