import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRulesEngineLifecycle } from "../src/rules-engine-lifecycle.js";

describe("rules engine lifecycle", () => {
  it("routes rule decisions and risk decay through configured lifecycle dependencies", async () => {
    const calls = [];
    const pool = { name: "pool" };
    const logEvent = () => {};
    const vehicle = { vehicle_id: "vehicle-01", plate_no: "F 1901 AK" };
    const evidence = { metrics: { overspeed_points: 3 } };
    const riskDeltas = { OVERSPEED: 6 };

    const lifecycle = createRulesEngineLifecycle({
      pool,
      config: {
        risk: {
          repeatEscalationCount: 3,
          dailyDecayPercent: 5,
          weeklyDecayPoints: 10
        }
      },
      logEvent,
      riskDeltas,
      openRuleLifecycle: async (payload) => {
        calls.push({ type: "open", payload });
        return { anomalyOpened: true };
      },
      resolveRuleLifecycle: async (payload) => {
        calls.push({ type: "resolve", payload });
        return { resolved: true };
      },
      applyRiskScoreDecay: async (payload) => {
        calls.push({ type: "decay", payload });
        return { decayed: true };
      }
    });

    const openResult = await lifecycle.applyRuleDecision({
      vehicle,
      decision: {
        action: "open",
        rule: "OVERSPEED",
        severity: "HIGH",
        evidence,
        lat: -6.595,
        lon: 106.816
      }
    });
    const resolveResult = await lifecycle.applyRuleDecision({
      vehicle,
      decision: {
        action: "resolve",
        rule: "OVERSPEED",
        reason: "Kecepatan kembali normal"
      }
    });
    const ignoredResult = await lifecycle.applyRuleDecision({
      vehicle,
      decision: {
        action: "ignore",
        rule: "OVERSPEED"
      }
    });
    const decayResult = await lifecycle.applyRiskDecay();

    assert.deepEqual(openResult, { anomalyOpened: true });
    assert.deepEqual(resolveResult, { resolved: true });
    assert.equal(ignoredResult, null);
    assert.deepEqual(decayResult, { decayed: true });
    assert.deepEqual(calls.map((call) => call.type), ["open", "resolve", "decay"]);

    assert.deepEqual(calls[0].payload, {
      pool,
      vehicle,
      rule: "OVERSPEED",
      severity: "HIGH",
      evidence,
      lat: -6.595,
      lon: 106.816,
      config: {
        repeatEscalationCount: 3,
        riskDeltas
      },
      logEvent
    });
    assert.deepEqual(calls[1].payload, {
      pool,
      vehicle,
      rule: "OVERSPEED",
      reason: "Kecepatan kembali normal",
      logEvent
    });
    assert.deepEqual(calls[2].payload, {
      pool,
      dailyDecayPercent: 5,
      weeklyDecayPoints: 10,
      logEvent
    });
  });
});
