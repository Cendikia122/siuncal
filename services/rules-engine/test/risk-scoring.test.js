import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  RULE_RISK_DELTAS,
  clampScore,
  riskDeltaForRule,
  riskLevelForScore
} from "../src/risk-scoring.js";

describe("risk scoring policy", () => {
  it("keeps rule deltas in one policy module", () => {
    assert.deepEqual(RULE_RISK_DELTAS, Object.freeze({
      NGETEM: 8,
      OFF_ROUTE: 12,
      WRONG_DIRECTION: 10,
      LOST_SIGNAL: 10,
      OVERSPEED: 6,
      DEVICE_TAMPER: 25
    }));
    assert.equal(riskDeltaForRule("OFF_ROUTE"), 12);
    assert.equal(riskDeltaForRule("UNKNOWN"), 0);
  });

  it("clamps scores and maps stable severity bands", () => {
    assert.equal(clampScore(-5), 0);
    assert.equal(clampScore(42.4), 42);
    assert.equal(clampScore(101), 100);
    assert.equal(riskLevelForScore(19), "LOW");
    assert.equal(riskLevelForScore(20), "MEDIUM");
    assert.equal(riskLevelForScore(40), "HIGH");
    assert.equal(riskLevelForScore(70), "CRITICAL");
  });
});
