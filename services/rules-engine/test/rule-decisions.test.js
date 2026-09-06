import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  clampScore,
  evaluateLostSignalDecision,
  evaluateNgetemDecision,
  evaluateOffRouteDecision,
  evaluateOverspeedDecision,
  evaluateWrongDirectionDecision,
  headingDiffDegrees,
  riskDeltaForRule,
  riskLevelForScore
} from "../src/rule-decisions.js";

const vehicle = {
  vehicle_id: "veh-1",
  plate_no: "F 1901 AK",
  route_id: "route-01",
  status: "IN_SERVICE",
  lat: -6.6,
  lon: 106.8
};

describe("rules-engine pure helpers", () => {
  it("clamps risk score and maps risk levels", () => {
    assert.equal(clampScore(-5), 0);
    assert.equal(clampScore(42.4), 42);
    assert.equal(clampScore(101), 100);
    assert.equal(riskLevelForScore(19), "LOW");
    assert.equal(riskLevelForScore(20), "MEDIUM");
    assert.equal(riskLevelForScore(40), "HIGH");
    assert.equal(riskLevelForScore(70), "CRITICAL");
  });

  it("calculates heading diff across 360 boundary and exposes rule deltas", () => {
    assert.equal(headingDiffDegrees(350, 10), 20);
    assert.equal(headingDiffDegrees(20, 200), 180);
    assert.equal(headingDiffDegrees(null, 90), null);
    assert.equal(riskDeltaForRule("NGETEM"), 8);
    assert.equal(riskDeltaForRule("OFF_ROUTE"), 12);
    assert.equal(riskDeltaForRule("WRONG_DIRECTION"), 10);
    assert.equal(riskDeltaForRule("LOST_SIGNAL"), 10);
    assert.equal(riskDeltaForRule("OVERSPEED"), 6);
    assert.equal(riskDeltaForRule("DEVICE_TAMPER"), 25);
  });
});

describe("rules-engine decisions", () => {
  it("opens LOST_SIGNAL with HIGH/CRITICAL severity based on minutes since ping", () => {
    const nowMs = Date.parse("2026-06-03T00:30:00.000Z");
    const high = evaluateLostSignalDecision({
      vehicle: { ...vehicle, ts: "2026-06-03T00:15:00.000Z" },
      nowMs,
      config: { lostSignalMinutes: 10, lostSignalCriticalMinutes: 30 }
    });
    assert.equal(high.action, "open");
    assert.equal(high.severity, "HIGH");
    assert.deepEqual(high.evidence.vehicle, {
      vehicle_id: vehicle.vehicle_id,
      plate_no: vehicle.plate_no,
      status: vehicle.status
    });
    assert.equal(high.evidence.route_id, vehicle.route_id);
    assert.equal(high.evidence.metrics.minutes_since_ping, 15);
    assert.equal(high.evidence.metrics.last_ping_at, "2026-06-03T00:15:00.000Z");

    const critical = evaluateLostSignalDecision({
      vehicle: { ...vehicle, ts: "2026-06-02T23:00:00.000Z" },
      nowMs,
      config: { lostSignalMinutes: 10, lostSignalCriticalMinutes: 30 }
    });
    assert.equal(critical.action, "open");
    assert.equal(critical.severity, "CRITICAL");
  });

  it("resolves LOST_SIGNAL when telemetry is recent", () => {
    const result = evaluateLostSignalDecision({
      vehicle: { ...vehicle, ts: "2026-06-03T00:25:00.000Z" },
      nowMs: Date.parse("2026-06-03T00:30:00.000Z"),
      config: { lostSignalMinutes: 10, lostSignalCriticalMinutes: 30 }
    });
    assert.equal(result.action, "resolve");
    assert.equal(result.reason, "Ping sudah kembali normal");
  });

  it("does not open OVERSPEED from a single GPS spike", () => {
    const result = evaluateOverspeedDecision({
      vehicle,
      rows: [{ ts: "2026-06-03T00:00:00Z", lat: -6.6, lon: 106.8, speed_kmh: 90 }],
      config: { overspeedThreshold: 60, overspeedMinPoints: 2 }
    });
    assert.equal(result.action, "resolve");
    assert.equal(result.reason, "Kecepatan kembali normal dalam window telemetry");
  });

  it("opens OVERSPEED when enough points exceed the threshold", () => {
    const result = evaluateOverspeedDecision({
      vehicle,
      rows: [
        { ts: "2026-06-03T00:02:00Z", lat: -6.61, lon: 106.81, speed_kmh: 83 },
        { ts: "2026-06-03T00:01:00Z", lat: -6.6, lon: 106.8, speed_kmh: 79 },
        { ts: "2026-06-03T00:00:00Z", lat: -6.59, lon: 106.79, speed_kmh: 40 }
      ],
      config: { overspeedThreshold: 60, overspeedMinPoints: 2, overspeedWindowPoints: 3 }
    });
    assert.equal(result.action, "open");
    assert.equal(result.rule, "OVERSPEED");
    assert.equal(result.severity, "HIGH");
    assert.equal(result.evidence.window.points, 3);
    assert.equal(result.evidence.point_count, 3);
    assert.equal(result.evidence.threshold.max_speed_kmh, 60);
    assert.equal(result.evidence.threshold.window_points, 3);
    assert.equal(result.evidence.metrics.overspeed_points, 2);
    assert.equal(result.evidence.metrics.max_speed_kmh, 83);
    assert.deepEqual(result.evidence.metrics.speeds_kmh, [83, 79, 40]);
  });

  it("resolves OFF_ROUTE for non in-service vehicles and near-base points", () => {
    assert.equal(evaluateOffRouteDecision({
      vehicle: { ...vehicle, status: "MAINTENANCE" },
      rows: [],
      config: { offRouteMeters: 80, offRouteGraceMinutes: 3, offRouteMinPoints: 2, baseRadiusMeters: 150 }
    }).action, "resolve");

    assert.equal(evaluateOffRouteDecision({
      vehicle,
      rows: [
        { ts: "2026-06-03T00:00:00Z", lat: -6.6, lon: 106.8, distance_to_corridor_m: 250, near_base: true },
        { ts: "2026-06-03T00:01:00Z", lat: -6.61, lon: 106.81, distance_to_corridor_m: 300, near_base: true }
      ],
      config: { offRouteMeters: 80, offRouteGraceMinutes: 3, offRouteMinPoints: 2, baseRadiusMeters: 150 }
    }).action, "resolve");
  });

  it("opens OFF_ROUTE when enough measured points are outside the corridor", () => {
    const result = evaluateOffRouteDecision({
      vehicle,
      rows: [
        { ts: "2026-06-03T00:01:00Z", lat: -6.61, lon: 106.81, distance_to_corridor_m: 210, near_base: false, match_status: "OFF_ROUTE", confidence: 0.1 },
        { ts: "2026-06-03T00:00:00Z", lat: -6.6, lon: 106.8, distance_to_corridor_m: 180, near_base: false, match_status: "OFF_ROUTE", confidence: 0.1 }
      ],
      config: { offRouteMeters: 80, offRouteGraceMinutes: 3, offRouteMinPoints: 2, baseRadiusMeters: 150 }
    });
    assert.equal(result.action, "open");
    assert.equal(result.rule, "OFF_ROUTE");
    assert.equal(result.severity, "MEDIUM");
    assert.equal(result.evidence.window.minutes, 3);
    assert.equal(result.evidence.point_count, 2);
    assert.equal(result.evidence.threshold.total_corridor_tolerance_meters, 80);
    assert.equal(result.evidence.metrics.off_route_points, 2);
    assert.deepEqual(result.evidence.metrics.distances_meters, [210, 180]);
  });

  it("opens WRONG_DIRECTION with wrap-around heading diff and minimum speed", () => {
    const result = evaluateWrongDirectionDecision({
      vehicle,
      rows: [
        { ts: "2026-06-03T00:01:00Z", lat: -6.61, lon: 106.81, speed_kmh: 18, heading: 350, matched_heading: 170, snapped_lat: -6.6105, snapped_lon: 106.8105, road_segment: "seg-2", distance_along_route_m: 1200.4 },
        { ts: "2026-06-03T00:00:00Z", lat: -6.6, lon: 106.8, speed_kmh: 16, heading: 10, matched_heading: 190, snapped_lat: -6.6005, snapped_lon: 106.8005, road_segment: "seg-1", distance_along_route_m: 1000.2 }
      ],
      config: { wrongDirectionGraceMinutes: 3, wrongDirectionHeadingDiffDegrees: 120, wrongDirectionMinSpeedKmh: 5, wrongDirectionMinPoints: 2, mapMatchingMinConfidence: 0.35 }
    });
    assert.equal(result.action, "open");
    assert.equal(result.rule, "WRONG_DIRECTION");
    assert.equal(result.severity, "HIGH");
    assert.deepEqual(result.evidence.location, { lat: -6.6105, lon: 106.8105 });
    assert.equal(result.evidence.window.minutes, 3);
    assert.equal(result.evidence.point_count, 2);
    assert.equal(result.evidence.threshold.min_match_confidence, 0.35);
    assert.equal(result.evidence.metrics.wrong_direction_points, 2);
    assert.deepEqual(result.evidence.metrics.heading_diffs_degrees, [180, 180]);
    assert.deepEqual(result.evidence.metrics.raw_headings, [350, 10]);
    assert.deepEqual(result.evidence.metrics.matched_headings, [170, 190]);
    assert.deepEqual(result.evidence.metrics.road_segments, ["seg-2", "seg-1"]);
    assert.deepEqual(result.evidence.metrics.distance_along_route_meters, [1200, 1000]);
  });

  it("resolves NGETEM near official stops and opens from aggregate low-speed tight cluster", () => {
    assert.equal(evaluateNgetemDecision({
      vehicle: { ...vehicle, ts: "2026-06-03T00:25:00Z" },
      nowMs: Date.parse("2026-06-03T00:30:00Z"),
      rows: null,
      inOfficialStop: true,
      config: { lostSignalMinutes: 10, ngetemMinutes: 10, ngetemMaxDistanceMeters: 50, ngetemMaxAvgSpeed: 3, officialStopRadiusMeters: 120 }
    }).action, "resolve");

    const result = evaluateNgetemDecision({
      vehicle: { ...vehicle, ts: "2026-06-03T00:25:00Z" },
      nowMs: Date.parse("2026-06-03T00:30:00Z"),
      rows: [
        { points: 4, started_at: "2026-06-03T00:05:00Z", ended_at: "2026-06-03T00:30:00Z", max_dist_m: 12.4, avg_speed: 1.234, max_speed: 2.5 }
      ],
      config: { lostSignalMinutes: 10, ngetemMinutes: 25, ngetemMaxDistanceMeters: 50, ngetemMaxAvgSpeed: 3, officialStopRadiusMeters: 120 }
    });
    assert.equal(result.action, "open");
    assert.equal(result.rule, "NGETEM");
    assert.equal(result.severity, "HIGH");
    assert.equal(result.evidence.window.minutes, 25);
    assert.equal(result.evidence.point_count, 4);
    assert.equal(result.evidence.threshold.duration_minutes, 25);
    assert.equal(result.evidence.threshold.official_stop_radius_meters, 120);
    assert.equal(result.evidence.metrics.duration_minutes, 25);
    assert.equal(result.evidence.metrics.max_distance_meters, 12);
    assert.equal(result.evidence.metrics.avg_speed_kmh, 1.23);
    assert.equal(result.evidence.metrics.max_speed_kmh, 2.5);
    assert.equal(result.evidence.metrics.in_official_stop, false);
  });
});
