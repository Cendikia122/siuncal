const STATUS_VALUES = new Set([
  "IN_SERVICE",
  "DEADHEAD_TO_BASE",
  "OUT_OF_SERVICE",
  "MAINTENANCE",
  "EMERGENCY"
]);

const numberFrom = (value) => {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const invalidBoolean = Symbol("invalidBoolean");
const booleanFrom = (value) => {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number" && (value === 0 || value === 1)) return Boolean(value);
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }
  return invalidBoolean;
};

const validationError = (message) => ({
  ok: false,
  error: {
    code: "VALIDATION_ERROR",
    message
  }
});

export const normalizeVehicleTelemetry = (body = {}) => {
  const latitude = numberFrom(body.lat);
  const longitude = numberFrom(body.lon);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return validationError("lat and lon must be numeric");
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return validationError("lat/lon out of range");
  }

  const speedKmh = numberFrom(body.speed_kmh);
  if (Number.isNaN(speedKmh) || (speedKmh !== null && (speedKmh < 0 || speedKmh > 200))) {
    return validationError("speed_kmh must be a number from 0 to 200");
  }

  const headingSource = body.heading ?? body.heading_deg;
  const heading = numberFrom(headingSource);
  if (Number.isNaN(heading) || (heading !== null && (heading < 0 || heading > 360))) {
    return validationError("heading must be a number from 0 to 360");
  }

  const status = body.status ?? body.mode ?? (speedKmh !== null && speedKmh > 0 ? "IN_SERVICE" : null);
  if (status && !STATUS_VALUES.has(status)) {
    return validationError(`status must be one of ${Array.from(STATUS_VALUES).join(", ")}`);
  }

  const timestampSource = body.ts ?? body.timestamp;
  const timestamp = timestampSource ? new Date(timestampSource) : new Date();
  if (Number.isNaN(timestamp.getTime())) {
    return validationError("ts must be a valid ISO-8601 timestamp");
  }

  const batteryLevel = numberFrom(body.battery_level ?? body.battery ?? body.device?.battery);
  if (Number.isNaN(batteryLevel) || (batteryLevel !== null && (batteryLevel < 0 || batteryLevel > 1))) {
    return validationError("battery must be a number from 0 to 1");
  }

  const signalDbm = numberFrom(body.signal_dbm ?? body.device?.signal_dbm);
  if (Number.isNaN(signalDbm) || (signalDbm !== null && (signalDbm < -150 || signalDbm > 0))) {
    return validationError("signal_dbm must be a number from -150 to 0");
  }

  const powerConnected = booleanFrom(body.power_connected ?? body.device?.power_connected);
  if (powerConnected === invalidBoolean) {
    return validationError("power_connected must be a boolean");
  }

  return {
    ok: true,
    value: {
      vehicleId: body.vehicle_id || null,
      plateNo: body.plate_no || null,
      deviceId: body.device_id || body.device?.device_id || null,
      imei_or_serial: body.imei_or_serial || body.device?.imei_or_serial || null,
      latitude,
      longitude,
      speedKmh,
      heading,
      status,
      timestamp,
      batteryLevel,
      signalDbm,
      powerConnected
    }
  };
};
