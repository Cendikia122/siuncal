import crypto from "node:crypto";

export const TELEMETRY_QUALITY_METRICS = {
  invalidDeviceIdentity: "telemetry.invalid_identity",
  assignmentMismatch: "telemetry.assignment_mismatch",
  duplicatePayload: "telemetry.duplicate_payload"
};

export const TELEMETRY_QUALITY_METRIC_WINDOW_MS = 60 * 60 * 1000;
export const DEVICE_TAMPER_METRIC_WINDOW_MS = 24 * 60 * 60 * 1000;

export const telemetryIdentityMetricKey = (identity) => {
  const normalized = String(identity || "").trim().toLowerCase();
  if (!normalized) return null;
  const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 24);
  return `${TELEMETRY_QUALITY_METRICS.invalidDeviceIdentity}:identity:${digest}`;
};
