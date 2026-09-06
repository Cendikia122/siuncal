import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { applyOwnerRiskPropagation } from "../src/owner-risk-propagation.js";

describe("owner risk propagation runtime", () => {
  it("propagates owner context once per vehicle per 24 hour window", async () => {
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      if (/UNION[\s\S]*collective_anomalies[\s\S]*sanctions/.test(text)) {
        return { rows: [{ owner_id: "owner-01", vehicle_ids: ["vehicle-01", "vehicle-02"] }] };
      }
      if (/event_type = 'OWNER_PROPAGATION'/.test(text)) {
        return { rows: params[0] === "vehicle-02" ? [{ event_id: "recent-event" }] : [] };
      }
      if (/SELECT current_score FROM risk_scores/.test(text)) {
        return { rows: [{ current_score: 38 }] };
      }
      if (/INSERT INTO risk_scores/.test(text)) return { rows: [] };
      if (/INSERT INTO risk_score_events/.test(text)) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    };

    await applyOwnerRiskPropagation({ query, propagationDelta: 5 });

    const scoreWrite = calls.find((call) => /INSERT INTO risk_scores/.test(call.text));
    assert.deepEqual(scoreWrite.params, ["vehicle-01", 43, "HIGH"]);

    const eventWrite = calls.find((call) => /INSERT INTO risk_score_events/.test(call.text));
    assert.deepEqual(eventWrite.params.slice(0, 4), ["vehicle-01", 5, 38, 43]);
    assert.deepEqual(JSON.parse(eventWrite.params[4]), {
      owner_id: "owner-01",
      reason: "owner_multi_risk_or_collective_anomaly_or_sanction"
    });

    assert.equal(calls.filter((call) => /INSERT INTO risk_score_events/.test(call.text)).length, 1);
  });
});
