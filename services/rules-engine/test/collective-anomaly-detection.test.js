import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  detectOwnerMultiHighRisk,
  detectRouteClusterViolation
} from "../src/collective-anomaly-detection.js";

describe("collective anomaly detection", () => {
  it("opens active owner multi-risk anomalies and resolves stale owner anomalies", async () => {
    const calls = [];
    const logs = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      if (/JOIN risk_scores[\s\S]*HAVING COUNT\(\*\) >= 2/.test(text)) {
        return {
          rows: [{
            owner_id: "owner-01",
            owner_name: "Koperasi Demo",
            vehicle_ids: ["vehicle-01", "vehicle-02"],
            plate_nos: ["F 1901 AK", "F 1902 AK"],
            scores: [72, 48],
            levels: ["CRITICAL", "HIGH"]
          }]
        };
      }
      if (/WHERE type = 'OWNER_MULTI_HIGH_RISK'/.test(text)) {
        return { rows: [{ collective_anomaly_id: "collective-stale", involved_owners: ["owner-02"], escalation_count: 1 }] };
      }
      if (/INSERT INTO collective_anomalies[\s\S]*OWNER_MULTI_HIGH_RISK/.test(text)) return { rows: [] };
      if (/UPDATE collective_anomalies SET status = 'RESOLVED'/.test(text)) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    };

    await detectOwnerMultiHighRisk({
      query,
      logEvent: (event, payload) => logs.push({ event, payload })
    });

    const insert = calls.find((call) => /INSERT INTO collective_anomalies[\s\S]*OWNER_MULTI_HIGH_RISK/.test(call.text));
    assert.deepEqual(insert.params.slice(1), [["vehicle-01", "vehicle-02"], ["owner-01"]]);
    assert.deepEqual(JSON.parse(insert.params[0]), {
      owner_id: "owner-01",
      owner_name: "Koperasi Demo",
      vehicles: [
        { vehicle_id: "vehicle-01", plate_no: "F 1901 AK", score: 72, level: "CRITICAL" },
        { vehicle_id: "vehicle-02", plate_no: "F 1902 AK", score: 48, level: "HIGH" }
      ]
    });

    const resolve = calls.find((call) => /UPDATE collective_anomalies SET status = 'RESOLVED'/.test(call.text));
    assert.deepEqual(resolve.params, ["collective-stale"]);
    assert.deepEqual(logs.map((entry) => entry.event), ["collective_anomaly_opened", "collective_anomaly_resolved"]);
  });

  it("updates active route cluster anomalies and resolves stale route clusters", async () => {
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      if (/FROM anomalies a[\s\S]*a.rule = 'OFF_ROUTE'/.test(text)) {
        return {
          rows: [{
            route_id: "01",
            route_name: "Trayek 01",
            vehicle_ids: ["vehicle-01", "vehicle-02", "vehicle-03"],
            vehicle_count: 3
          }]
        };
      }
      if (/WHERE type = 'ROUTE_CLUSTER_VIOLATION'/.test(text)) {
        return {
          rows: [
            { collective_anomaly_id: "collective-active", route_id: "01", escalation_count: 2 },
            { collective_anomaly_id: "collective-stale", route_id: "02", escalation_count: 1 }
          ]
        };
      }
      if (/UPDATE collective_anomalies[\s\S]*escalation_count = escalation_count \+ 1/.test(text)) return { rows: [] };
      if (/UPDATE collective_anomalies SET status = 'RESOLVED'/.test(text)) return { rows: [] };
      throw new Error(`Unexpected query: ${text}`);
    };

    await detectRouteClusterViolation({ query });

    const update = calls.find((call) => /escalation_count = escalation_count \+ 1/.test(call.text));
    assert.deepEqual(update.params, [
      "CRITICAL",
      JSON.stringify({
        route_id: "01",
        route_name: "Trayek 01",
        vehicle_count: 3,
        vehicle_ids: ["vehicle-01", "vehicle-02", "vehicle-03"]
      }),
      ["vehicle-01", "vehicle-02", "vehicle-03"],
      "collective-active"
    ]);

    const resolve = calls.find((call) => /UPDATE collective_anomalies SET status = 'RESOLVED'/.test(call.text));
    assert.deepEqual(resolve.params, ["collective-stale"]);
  });
});
