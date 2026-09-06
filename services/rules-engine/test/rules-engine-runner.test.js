import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRulesEngineRunner } from "../src/rules-engine-runner.js";

describe("rules engine runner", () => {
  it("fetches vehicles, evaluates each batch in rule order, and applies risk decay", async () => {
    const vehicles = [
      { vehicle_id: "vehicle-01", plate_no: "F 1901 AK" },
      { vehicle_id: "vehicle-02", plate_no: "F 1902 AK" },
      { vehicle_id: "vehicle-03", plate_no: "F 1903 AK" }
    ];
    const calls = [];

    const query = async (text, params = []) => {
      calls.push({ type: "query", text, params });
      assert.match(text, /FROM vehicles v/);
      assert.match(text, /ORDER BY v\.plate_no/);
      assert.deepEqual(params, []);
      return { rows: vehicles };
    };

    const recordBatch = (type) => async (batch, nowMs) => {
      calls.push({
        type,
        vehicleIds: batch.map((vehicle) => vehicle.vehicle_id),
        nowMs
      });
    };

    const runner = createRulesEngineRunner({
      query,
      evaluateLostSignalBatch: recordBatch("lost-signal"),
      evaluateOverspeedBatch: recordBatch("overspeed"),
      evaluateOffRouteBatch: recordBatch("off-route"),
      evaluateWrongDirectionBatch: recordBatch("wrong-direction"),
      evaluateNgetemBatch: recordBatch("ngetem"),
      applyRiskDecay: async () => calls.push({ type: "risk-decay" }),
      config: {
        runtime: {
          ruleBatchSize: 2
        }
      },
      nowMs: () => 1234567890
    });

    await runner.runRules();

    assert.deepEqual(calls.map((call) => call.type), [
      "query",
      "lost-signal",
      "overspeed",
      "off-route",
      "wrong-direction",
      "ngetem",
      "lost-signal",
      "overspeed",
      "off-route",
      "wrong-direction",
      "ngetem",
      "risk-decay"
    ]);
    assert.deepEqual(calls[1].vehicleIds, ["vehicle-01", "vehicle-02"]);
    assert.equal(calls[1].nowMs, 1234567890);
    assert.deepEqual(calls[5].vehicleIds, ["vehicle-01", "vehicle-02"]);
    assert.equal(calls[5].nowMs, 1234567890);
    assert.deepEqual(calls[6].vehicleIds, ["vehicle-03"]);
  });
});
