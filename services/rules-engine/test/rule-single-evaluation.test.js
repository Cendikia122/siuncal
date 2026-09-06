import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRuleSingleEvaluator } from "../src/rule-single-evaluation.js";

const baseConfig = {
  overspeedThreshold: 60,
  overspeedMinPoints: 2,
  overspeedWindowPoints: 3,
  lostSignalMinutes: 5,
  lostSignalCriticalMinutes: 10,
  offRouteMeters: 0,
  offRouteGraceMinutes: 3,
  offRouteMinPoints: 2,
  baseRadiusMeters: 150,
  mapMatchingMinConfidence: 0.35,
  wrongDirectionGraceMinutes: 4,
  wrongDirectionMinPoints: 2,
  wrongDirectionHeadingDiffDegrees: 120,
  wrongDirectionMinSpeedKmh: 7,
  ngetemMinutes: 20,
  ngetemMaxDistanceMeters: 15,
  ngetemMaxAvgSpeed: 3,
  officialStopRadiusMeters: 120
};

describe("rule single-vehicle evaluation", () => {
  it("opens wrong-direction decisions from matched telemetry rows", async () => {
    const applied = [];
    const query = async (text, params = []) => {
      assert.match(text, /JOIN telemetry_matched_positions/);
      assert.match(text, /mp\.match_status = 'MATCHED'/);
      assert.deepEqual(params, ["vehicle-01", 4, 0.35, 7]);
      return {
        rows: [
          { ts: "2026-01-01T00:02:00Z", lat: -6.6, lon: 106.8, speed_kmh: 18, heading: 350, matched_heading: 170 },
          { ts: "2026-01-01T00:01:00Z", lat: -6.6, lon: 106.8, speed_kmh: 16, heading: 10, matched_heading: 190 }
        ]
      };
    };
    const evaluator = createRuleSingleEvaluator({
      query,
      config: baseConfig,
      applyRuleDecision: async ({ vehicle, decision }) => {
        applied.push({ vehicle, decision });
        return decision;
      }
    });

    await evaluator.evaluateWrongDirection({
      vehicle_id: "vehicle-01",
      plate_no: "F 1901 AK",
      status: "IN_SERVICE"
    });

    assert.equal(applied.length, 1);
    assert.equal(applied[0].decision.action, "open");
    assert.equal(applied[0].decision.rule, "WRONG_DIRECTION");
    assert.equal(applied[0].decision.evidence.metrics.wrong_direction_points, 2);
  });

  it("opens ngetem decisions from aggregate rows outside official stops", async () => {
    const applied = [];
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      if (/AS in_official_stop/.test(text)) {
        assert.deepEqual(params, ["route-01", 106.8, -6.6, 120]);
        return { rows: [{ in_official_stop: false }] };
      }
      assert.match(text, /COUNT\(\*\)::int AS points/);
      assert.deepEqual(params, ["vehicle-01", 106.8, -6.6, 20]);
      return {
        rows: [
          {
            points: 3,
            started_at: "2026-01-01T00:00:00Z",
            ended_at: "2026-01-01T00:20:00Z",
            max_dist_m: 8,
            avg_speed: 1.2,
            max_speed: 2.1
          }
        ]
      };
    };
    const evaluator = createRuleSingleEvaluator({
      query,
      config: baseConfig,
      applyRuleDecision: async ({ vehicle, decision }) => {
        applied.push({ vehicle, decision });
        return decision;
      }
    });

    await evaluator.evaluateNgetem({
      vehicle_id: "vehicle-01",
      plate_no: "F 1901 AK",
      route_id: "route-01",
      status: "IN_SERVICE",
      ts: "2026-01-01T00:20:00Z",
      lat: -6.6,
      lon: 106.8
    }, Date.parse("2026-01-01T00:21:00Z"));

    assert.equal(calls.length, 2);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].decision.action, "open");
    assert.equal(applied[0].decision.rule, "NGETEM");
    assert.equal(applied[0].decision.evidence.metrics.avg_speed_kmh, 1.2);
  });

  it("resolves off-route for non in-service vehicles without querying telemetry", async () => {
    const applied = [];
    const evaluator = createRuleSingleEvaluator({
      query: async () => {
        throw new Error("off-route should not query telemetry for non in-service vehicles");
      },
      config: baseConfig,
      applyRuleDecision: async ({ vehicle, decision }) => {
        applied.push({ vehicle, decision });
        return decision;
      }
    });

    await evaluator.evaluateOffRoute({
      vehicle_id: "vehicle-01",
      plate_no: "F 1901 AK",
      status: "MAINTENANCE"
    });

    assert.equal(applied.length, 1);
    assert.equal(applied[0].decision.action, "resolve");
    assert.equal(applied[0].decision.rule, "OFF_ROUTE");
    assert.equal(applied[0].decision.reason, "Kendaraan tidak dalam status IN_SERVICE");
  });
});
