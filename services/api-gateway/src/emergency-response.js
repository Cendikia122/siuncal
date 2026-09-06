const defaultAckSlaSeconds = 60;
const defaultAssignmentSlaSeconds = 180;

const allowedCategories = new Set([
  "SECURITY",
  "MEDICAL",
  "ACCIDENT",
  "HARASSMENT",
  "PANIC_BUTTON",
  "OTHER",
]);

const cleanText = (value, fallback = "") => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text || fallback;
};

const isoAfter = (date, seconds) =>
  new Date(date.getTime() + seconds * 1000).toISOString();

const classifyTrustSignal = ({ source, body = {}, user = null } = {}) => {
  if (body.manual_override === true) {
    return { trustLevel: "MANUAL_OVERRIDE", trustSignal: "MANUAL_OPERATOR_OVERRIDE" };
  }
  if (source === "PASSENGER_APP" && user?.user_id && body.session_id) {
    return { trustLevel: "HIGH", trustSignal: "TRACKING_SESSION_MATCH" };
  }
  if (source === "DRIVER_DEVICE" && (body.vehicle_id || body.plate_no || body.device_id || body.imei_or_serial)) {
    return { trustLevel: "HIGH", trustSignal: "AUTHENTICATED_DEVICE" };
  }
  if (body.accuracy_m !== undefined && Number(body.accuracy_m) > 100) {
    return { trustLevel: "LOW", trustSignal: "LOW_ACCURACY_LOCATION" };
  }
  return { trustLevel: "MEDIUM", trustSignal: "AUTHENTICATED_REQUEST" };
};

export const buildEmergencyIncident = ({
  source,
  user = null,
  body = {},
  now = new Date(),
  ackSlaSeconds = defaultAckSlaSeconds,
  assignmentSlaSeconds = defaultAssignmentSlaSeconds,
} = {}) => {
  const category = cleanText(body.category, source === "DRIVER_DEVICE" ? "PANIC_BUTTON" : "OTHER").toUpperCase();
  const emergencyCategory = allowedCategories.has(category) ? category : "OTHER";
  const message = cleanText(body.message || body.description, "SOS darurat diterima.");
  const { trustLevel, trustSignal } = classifyTrustSignal({ source, body, user });

  return {
    incident: {
      type: "EMERGENCY",
      severity: "CRITICAL",
      status: "OPEN",
      description: `SOS ${emergencyCategory}: ${message}`,
      location_desc: source === "DRIVER_DEVICE" ? "SOS driver/device" : "SOS penumpang",
      lat: Number(body.lat),
      lon: Number(body.lon),
      vehicle_id: body.vehicle_id || null,
      reporter_user_id: user?.user_id || null,
      reporter_session_id: body.session_id || null,
      source,
      emergency_category: emergencyCategory,
      trust_level: trustLevel,
      escalation_state: "ON_TRACK",
      ack_due_at: isoAfter(now, ackSlaSeconds),
      assignment_due_at: isoAfter(now, assignmentSlaSeconds),
    },
    action: {
      action: "SOS_RECEIVED",
      notes: `Passenger SOS received with trust ${trustLevel}`,
      metadata: {
        source,
        category: emergencyCategory,
        accuracy_m: body.accuracy_m ?? null,
        trust_signal: trustSignal,
        manual_override: body.manual_override === true,
      },
    },
  };
};

export const deriveEmergencyEscalation = ({
  status,
  createdAt,
  acknowledgedAt = null,
  assignedTo = null,
  resolvedAt = null,
  now = new Date(),
  ackSlaSeconds = defaultAckSlaSeconds,
  assignmentSlaSeconds = defaultAssignmentSlaSeconds,
} = {}) => {
  if (resolvedAt || ["RESOLVED", "FALSE_ALARM", "CLOSED"].includes(String(status || "").toUpperCase())) {
    return { state: "CLOSED", target: null, breached_seconds: 0 };
  }

  const created = new Date(createdAt).getTime();
  const elapsedSeconds = Number.isFinite(created) ? Math.floor((now.getTime() - created) / 1000) : 0;
  if (!acknowledgedAt && elapsedSeconds > ackSlaSeconds) {
    return { state: "ACK_OVERDUE", target: "SUPERVISOR", breached_seconds: elapsedSeconds - ackSlaSeconds };
  }
  if (!assignedTo && elapsedSeconds > assignmentSlaSeconds) {
    return { state: "ASSIGNMENT_OVERDUE", target: "KOORDINATOR_LAPANGAN", breached_seconds: elapsedSeconds - assignmentSlaSeconds };
  }
  return { state: "ON_TRACK", target: null, breached_seconds: 0 };
};
