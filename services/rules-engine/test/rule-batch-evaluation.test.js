import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRuleBatchEvaluator } from "../src/rule-batch-evaluation.js";

const baseConfig = {
  ruleEvaluationConcurrency: 1,
  overspeedThreshold: 60,
  overspeedMinPoints: 2,
  overspeedWindowPoints: 3,
  lostSignalMinutes: 5,
  offRouteMeters: 0,
  offRouteGraceMinutes: 3,
  offRouteMinPoints: 2,
  baseRadiusMeters: 150,
  ngetemMinutes: 20,
  ngetemMaxDistanceMeters: 15,
  ngetemMaxAvgSpeed: 3,
  officialStopRadiusMeters: 120
};

describe("rule batch evaluation", () => {
  it("opens overspeed decisions from batch telemetry rows", async () => {
    const applied = [];
    const query = async (text, params = []) => {
      assert.match(text, /vehicle_id = ANY\(\$1::uuid\[\]\)/);
      assert.deepEqual(params, [["vehicle-01"], 3, 5]);
      return {
        rows: [
          { vehicle_id: "vehicle-01", ts: "2026-01-01T00:02:00Z", lat: -6.6, lon: 106.8, speed_kmh: 82 },
          { vehicle_id: "vehicle-01", ts: "2026-01-01T00:01:00Z", lat: -6.6, lon: 106.8, speed_kmh: 77 },
          { vehicle_id: "vehicle-01", ts: "2026-01-01T00:00:00Z", lat: -6.6, lon: 106.8, speed_kmh: 30 }
        ]
      };
    };
    const evaluator = createRuleBatchEvaluator({
      query,
      config: baseConfig,
      applyRuleDecision: async ({ vehicle, decision }) => {
        applied.push({ vehicle, decision });
        return decision;
      }
    });

    await evaluator.evaluateOverspeedBatch([
      { vehicle_id: "vehicle-01", plate_no: "F 1901 AK", status: "IN_SERVICE" }
    ]);

    assert.equal(applied.length, 1);
    assert.equal(applied[0].decision.action, "open");
    assert.equal(applied[0].decision.rule, "OVERSPEED");
    assert.equal(applied[0].decision.evidence.metrics.overspeed_points, 2);
  });

  it("opens ngetem decisions from aggregate rows outside official stops", async () => {
    const applied = [];
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      if (/AS in_official_stop/.test(text)) {
        assert.deepEqual(params, [["vehicle-01"], 120]);
        return { rows: [{ vehicle_id: "vehicle-01", in_official_stop: false }] };
      }
      assert.match(text, /AVG\(vp\.speed_kmh\) AS avg_speed/);
      assert.deepEqual(params, [["vehicle-01"], 20]);
      return {
        rows: [
          {
            vehicle_id: "vehicle-01",
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
    const evaluator = createRuleBatchEvaluator({
      query,
      config: baseConfig,
      applyRuleDecision: async ({ vehicle, decision }) => {
        applied.push({ vehicle, decision });
        return decision;
      }
    });

    await evaluator.evaluateNgetemBatch([
      {
        vehicle_id: "vehicle-01",
        plate_no: "F 1901 AK",
        status: "IN_SERVICE",
        ts: "2026-01-01T00:20:00Z",
        lat: -6.6,
        lon: 106.8
      }
    ], Date.parse("2026-01-01T00:21:00Z"));

    assert.equal(calls.length, 2);
    assert.equal(applied.length, 1);
    assert.equal(applied[0].decision.action, "open");
    assert.equal(applied[0].decision.rule, "NGETEM");
    assert.equal(applied[0].decision.evidence.metrics.avg_speed_kmh, 1.2);
  });

  it("resolves off-route batches for non in-service vehicles without querying telemetry", async () => {
    const applied = [];
    const evaluator = createRuleBatchEvaluator({
      query: async () => {
        throw new Error("off-route should not query telemetry for non in-service vehicles");
      },
      config: baseConfig,
      applyRuleDecision: async ({ vehicle, decision }) => {
        applied.push({ vehicle, decision });
        return decision;
      }
    });

    await evaluator.evaluateOffRouteBatch([
      { vehicle_id: "vehicle-01", plate_no: "F 1901 AK", status: "MAINTENANCE" }
    ]);

    assert.equal(applied.length, 1);
    assert.equal(applied[0].decision.action, "resolve");
    assert.equal(applied[0].decision.rule, "OFF_ROUTE");
    assert.equal(applied[0].decision.reason, "Kendaraan tidak dalam status IN_SERVICE");
  });
});
