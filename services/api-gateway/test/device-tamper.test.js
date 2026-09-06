import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  DEVICE_TAMPER_REASONS,
  buildDeviceTamperCandidate
} from "../src/device-tamper.js";

describe("device tamper candidate builder", () => {
  it("returns null when no tamper signal is present", () => {
    assert.equal(buildDeviceTamperCandidate(), null);
  });

  it("raises high severity for power disconnect followed by lost signal", () => {
    const candidate = buildDeviceTamperCandidate({
      powerDisconnectThenLostSignal: true
    });

    assert.equal(candidate.rule, "DEVICE_TAMPER");
    assert.equal(candidate.status, "candidate");
    assert.equal(candidate.severity, "HIGH");
    assert.deepEqual(candidate.reasons, [
      DEVICE_TAMPER_REASONS.powerDisconnectThenLostSignal
    ]);
  });

  it("includes impossible movement and repeated identity mismatch evidence", () => {
    const candidate = buildDeviceTamperCandidate({
      impossibleMovementCount: 2,
      repeatedIdentityMismatchCount: 4,
      repeatedIdentityMismatchThreshold: 3
    });

    assert.equal(candidate.severity, "HIGH");
    assert.deepEqual(candidate.reasons, [
      DEVICE_TAMPER_REASONS.impossibleMovement,
      DEVICE_TAMPER_REASONS.repeatedIdentityMismatch
    ]);
    assert.deepEqual(candidate.evidence, {
      impossible_movement_count_24h: 2,
      repeated_identity_mismatch_count_24h: 4
    });
  });
});
