import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRulesEngineEvaluators } from "../src/rules-engine-evaluators.js";

describe("rules engine evaluators", () => {
  it("builds single and batch evaluators with the rule evaluation config", async () => {
    const calls = [];
    const query = async () => ({ rows: [] });
    const applyRuleDecision = async () => null;
    const ruleEvaluation = { lostSignalMinutes: 5 };

    const evaluators = createRulesEngineEvaluators({
      query,
      applyRuleDecision,
      config: {
        runtime: { ruleBatchSize: 100 },
        ruleEvaluation
      },
      createRuleSingleEvaluator: (payload) => {
        calls.push({ type: "single", payload });
        return {
          evaluateLostSignal: async () => "single-lost-signal",
          evaluateOverspeed: async () => "single-overspeed",
          evaluateOffRoute: async () => "single-off-route",
          evaluateWrongDirection: async () => "single-wrong-direction",
          evaluateNgetem: async () => "single-ngetem"
        };
      },
      createRuleBatchEvaluator: (payload) => {
        calls.push({ type: "batch", payload });
        return {
          evaluateLostSignalBatch: async () => "batch-lost-signal",
          evaluateOverspeedBatch: async () => "batch-overspeed",
          evaluateOffRouteBatch: async () => "batch-off-route",
          evaluateWrongDirectionBatch: async () => "batch-wrong-direction",
          evaluateNgetemBatch: async () => "batch-ngetem"
        };
      }
    });

    assert.deepEqual(calls.map((call) => call.type), ["single", "batch"]);
    for (const call of calls) {
      assert.equal(call.payload.query, query);
      assert.equal(call.payload.applyRuleDecision, applyRuleDecision);
      assert.equal(call.payload.config, ruleEvaluation);
    }

    assert.equal(await evaluators.evaluateLostSignal(), "single-lost-signal");
    assert.equal(await evaluators.evaluateOverspeed(), "single-overspeed");
    assert.equal(await evaluators.evaluateOffRoute(), "single-off-route");
    assert.equal(await evaluators.evaluateWrongDirection(), "single-wrong-direction");
    assert.equal(await evaluators.evaluateNgetem(), "single-ngetem");
    assert.equal(await evaluators.evaluateLostSignalBatch(), "batch-lost-signal");
    assert.equal(await evaluators.evaluateOverspeedBatch(), "batch-overspeed");
    assert.equal(await evaluators.evaluateOffRouteBatch(), "batch-off-route");
    assert.equal(await evaluators.evaluateWrongDirectionBatch(), "batch-wrong-direction");
    assert.equal(await evaluators.evaluateNgetemBatch(), "batch-ngetem");
  });
});
