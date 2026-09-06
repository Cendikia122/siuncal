import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRulesEngineCollectiveRuntime } from "../src/rules-engine-collective-runtime.js";

describe("rules engine collective runtime", () => {
  it("wires collective detection to owner risk propagation", async () => {
    const calls = [];
    const query = async () => ({ rows: [] });
    const logEvent = () => {};

    const runtime = createRulesEngineCollectiveRuntime({
      query,
      logEvent,
      runCollectiveAnomalyDetection: async (payload) => {
        calls.push({ type: "collective", payload });
        await payload.applyOwnerRiskPropagation();
        return { ok: true };
      },
      applyOwnerRiskPropagation: async (payload) => {
        calls.push({ type: "owner-propagation", payload });
        return { propagated: true };
      }
    });

    const result = await runtime.runCollectiveAnomalyDetection();

    assert.deepEqual(result, { ok: true });
    assert.deepEqual(calls.map((call) => call.type), ["collective", "owner-propagation"]);
    assert.equal(calls[0].payload.query, query);
    assert.equal(calls[0].payload.logEvent, logEvent);
    assert.equal(typeof calls[0].payload.applyOwnerRiskPropagation, "function");
    assert.deepEqual(calls[1].payload, { query });
  });
});
