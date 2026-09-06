import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { openRuleLifecycle } from "../src/anomaly-lifecycle.js";

const createScriptedPool = (script) => {
  const calls = [];
  const client = {
    calls,
    query: async (text, params = []) => {
      calls.push({ text, params });
      const step = script.shift();
      if (!step) throw new Error(`Unexpected query: ${text}`);
      if (step.match && !step.match.test(text)) {
        throw new Error(`Expected ${step.match}, got ${text}`);
      }
      return { rows: step.rows || [] };
    },
    release: () => calls.push({ text: "RELEASE", params: [] })
  };

  return {
    client,
    connect: async () => client
  };
};

describe("anomaly lifecycle", () => {
  it("opens a high-severity rule into anomaly, alert, incident, and risk score state", async () => {
    const pool = createScriptedPool([
      { match: /^BEGIN$/ },
      { match: /FROM anomalies[\s\S]*status = 'OPEN'/, rows: [] },
      { match: /INSERT INTO anomalies/, rows: [{ anomaly_id: "anomaly-01" }] },
      { match: /FROM risk_score_events/, rows: [] },
      { match: /INSERT INTO risk_scores/, rows: [] },
      { match: /FROM risk_scores[\s\S]*FOR UPDATE/, rows: [{ current_score: 15 }] },
      { match: /INSERT INTO risk_score_events/, rows: [{ event_id: "risk-event-01" }] },
      { match: /UPDATE risk_scores/, rows: [] },
      { match: /FROM alerts[\s\S]*status IN \('OPEN', 'ESCALATED'\)/, rows: [] },
      { match: /INSERT INTO alerts/, rows: [{ alert_id: "alert-01" }] },
      { match: /FROM incidents/, rows: [] },
      { match: /INSERT INTO incidents/, rows: [{ incident_id: "incident-01" }] },
      { match: /INSERT INTO incident_actions/, rows: [] },
      { match: /INSERT INTO notifications/, rows: [] },
      { match: /UPDATE alerts[\s\S]*status = 'ESCALATED'/, rows: [] },
      { match: /^COMMIT$/ }
    ]);
    const logs = [];

    const result = await openRuleLifecycle({
      pool,
      vehicle: {
        vehicle_id: "vehicle-01",
        plate_no: "F 1901 AK",
        route_id: "01"
      },
      rule: "OVERSPEED",
      severity: "HIGH",
      evidence: {
        vehicle: { vehicle_id: "vehicle-01", plate_no: "F 1901 AK" },
        threshold: { max_speed_kmh: 60 },
        metrics: { overspeed_points: 3 }
      },
      lat: -6.595,
      lon: 106.816,
      config: {
        repeatEscalationCount: 3,
        riskDeltas: { OVERSPEED: 6 }
      },
      logEvent: (event, payload) => logs.push({ event, payload })
    });

    assert.deepEqual(result, {
      anomalyOpened: true,
      anomalyId: "anomaly-01",
      alertId: "alert-01"
    });
    assert.equal(pool.client.calls.some((call) => call.text === "COMMIT"), true);
    assert.equal(pool.client.calls.some((call) => /ROLLBACK/.test(call.text)), false);
    assert.equal(logs.some((entry) => entry.event === "incident_open"), true);
    assert.equal(logs.some((entry) => entry.event === "risk_score_change"), true);
  });
});
