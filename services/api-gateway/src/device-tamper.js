export const DEVICE_TAMPER_REASONS = Object.freeze({
  powerDisconnectThenLostSignal: "POWER_DISCONNECT_THEN_LOST_SIGNAL",
  impossibleMovement: "IMPOSSIBLE_MOVEMENT",
  repeatedIdentityMismatch: "REPEATED_IDENTITY_MISMATCH",
  assignedDeviceWithoutTelemetry: "ASSIGNED_DEVICE_WITHOUT_TELEMETRY",
  frequentReassignment: "FREQUENT_REASSIGNMENT"
});

export const buildDeviceTamperCandidate = ({
  powerDisconnectThenLostSignal = false,
  impossibleMovementCount = 0,
  repeatedIdentityMismatchCount = 0,
  repeatedIdentityMismatchThreshold = 3,
  noTelemetry = false,
  frequentlyReassigned = false
} = {}) => {
  const reasons = [];

  if (powerDisconnectThenLostSignal) reasons.push(DEVICE_TAMPER_REASONS.powerDisconnectThenLostSignal);
  if (Number(impossibleMovementCount || 0) > 0) reasons.push(DEVICE_TAMPER_REASONS.impossibleMovement);
  if (Number(repeatedIdentityMismatchCount || 0) >= repeatedIdentityMismatchThreshold) {
    reasons.push(DEVICE_TAMPER_REASONS.repeatedIdentityMismatch);
  }
  if (noTelemetry) reasons.push(DEVICE_TAMPER_REASONS.assignedDeviceWithoutTelemetry);
  if (frequentlyReassigned) reasons.push(DEVICE_TAMPER_REASONS.frequentReassignment);

  if (!reasons.length) return null;

  const highSignal = reasons.some((reason) => [
    DEVICE_TAMPER_REASONS.powerDisconnectThenLostSignal,
    DEVICE_TAMPER_REASONS.impossibleMovement,
    DEVICE_TAMPER_REASONS.repeatedIdentityMismatch
  ].includes(reason));

  return {
    rule: "DEVICE_TAMPER",
    status: "candidate",
    severity: highSignal ? "HIGH" : "MEDIUM",
    reasons,
    evidence: {
      impossible_movement_count_24h: Number(impossibleMovementCount || 0),
      repeated_identity_mismatch_count_24h: Number(repeatedIdentityMismatchCount || 0)
    }
  };
};
