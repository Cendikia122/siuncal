import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyRiskScoreDecay } from "../src/risk-decay.js";

const createScriptedPool = (script) => {
  const calls = [];
  const client = {
    calls,
    query: async (text, params = []) => {
      calls.push({ text, params });
      const step = script.shift();
      if (!step) throw new Error(`Unexpected query: ${text}`);
      if (step.match && !step.match.test(text)) throw new Error(`Expected ${step.match}, got ${text}`);
      return { rows: step.rows || [] };
    },
    release: () => calls.push({ text: "RELEASE", params: [] })
  };

  return {
    client,
    connect: async () => client
  };
};

describe("risk score decay runtime", () => {
  it("applies daily percentage decay and weekly point decay in one transaction", async () => {
    const pool = createScriptedPool([
      { match: /^BEGIN$/ },
      { match: /last_anomaly_at[\s\S]*24 hours[\s\S]*FOR UPDATE/, rows: [{ vehicle_id: "vehicle-01", current_score: 41 }] },
      { match: /INSERT INTO risk_score_events[\s\S]*DAILY_DECAY/ },
      { match: /UPDATE risk_scores/ },
      { match: /last_high_critical_at[\s\S]*WEEKLY_DECAY[\s\S]*FOR UPDATE/, rows: [{ vehicle_id: "vehicle-02", current_score: 8 }] },
      { match: /INSERT INTO risk_score_events[\s\S]*WEEKLY_DECAY/ },
      { match: /UPDATE risk_scores/ },
      { match: /^COMMIT$/ }
    ]);
    const logs = [];

    await applyRiskScoreDecay({
      pool,
      dailyDecayPercent: 5,
      weeklyDecayPoints: 10,
      logEvent: (event, payload) => logs.push({ event, payload })
    });

    const dailyInsert = pool.client.calls.find((call) => /INSERT INTO risk_score_events[\s\S]*DAILY_DECAY/.test(call.text));
    assert.deepEqual(dailyInsert.params.slice(0, 4), ["vehicle-01", -3, 41, 38]);

    const weeklyInsert = pool.client.calls.find((call) => /INSERT INTO risk_score_events[\s\S]*WEEKLY_DECAY/.test(call.text));
    assert.deepEqual(weeklyInsert.params.slice(0, 4), ["vehicle-02", -8, 8, 0]);

    assert.equal(pool.client.calls.some((call) => call.text === "COMMIT"), true);
    assert.equal(pool.client.calls.at(-1).text, "RELEASE");
    assert.deepEqual(logs.map((entry) => entry.payload.event_type), ["DAILY_DECAY", "WEEKLY_DECAY"]);
  });
});
