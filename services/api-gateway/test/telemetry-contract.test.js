import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { normalizeVehicleTelemetry } from "../src/telemetry-contract.js";
import { publicReportSchema, vehicleTelemetrySchema } from "../src/validation.js";

describe("normalizeVehicleTelemetry", () => {
  it("accepts the current telemetry contract with heading, status, and top-level device identity", () => {
    const payload = {
      imei_or_serial: "86753090001",
      ts: "2026-01-25T10:15:30.123Z",
      lat: -6.595038,
      lon: 106.816635,
      speed_kmh: 23.5,
      heading: 120,
      status: "IN_SERVICE"
    };
    const validated = vehicleTelemetrySchema.safeParse(payload);
    assert.equal(validated.success, true);

    const result = normalizeVehicleTelemetry(validated.data);

    assert.equal(result.ok, true);
    assert.equal(result.value.imei_or_serial, "86753090001");
    assert.equal(result.value.speedKmh, 23.5);
    assert.equal(result.value.heading, 120);
    assert.equal(result.value.status, "IN_SERVICE");
    assert.equal(result.value.timestamp.toISOString(), "2026-01-25T10:15:30.123Z");
  });

  it("maps legacy heading_deg and mode when devices still send the old payload", () => {
    const result = normalizeVehicleTelemetry({
      plate_no: "F 1234 XX",
      lat: "-6.595038",
      lon: "106.816635",
      speed_kmh: "0",
      heading_deg: "45",
      mode: "OUT_OF_SERVICE"
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.heading, 45);
    assert.equal(result.value.status, "OUT_OF_SERVICE");
  });

  it("accepts plate/device identifiers and keeps them for resolver fallback", () => {
    const result = vehicleTelemetrySchema.safeParse({
      plate_no: "F 1901 AK",
      device_id: "8f221a32-2bb1-4e2f-85cf-f2c7d87c76d0",
      imei_or_serial: "86753090001",
      timestamp: "2026-01-25T10:15:30.123Z",
      lat: "-6.595038",
      lon: "106.816635",
      speed_kmh: "12.5",
      heading: "121",
      device: {
        imei_or_serial: "86753090001",
        battery: "0.87",
        signal_dbm: "-85",
        power_connected: "false"
      }
    });

    assert.equal(result.success, true);
    assert.equal(result.data.plate_no, "F 1901 AK");
    assert.equal(result.data.device_id, "8f221a32-2bb1-4e2f-85cf-f2c7d87c76d0");
    assert.equal(result.data.imei_or_serial, "86753090001");
    assert.equal(result.data.heading, 121);
    assert.equal(result.data.speed_kmh, 12.5);
    assert.equal(result.data.device.battery, 0.87);
    assert.equal(result.data.device.signal_dbm, -85);
    assert.equal(result.data.device.power_connected, false);
  });

  it("normalizes optional device health signals for tamper detection", () => {
    const result = normalizeVehicleTelemetry({
      imei_or_serial: "86753090001",
      lat: -6.595038,
      lon: 106.816635,
      device: {
        battery: 0.42,
        signal_dbm: -91,
        power_connected: false
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.value.batteryLevel, 0.42);
    assert.equal(result.value.signalDbm, -91);
    assert.equal(result.value.powerConnected, false);
  });

  it("rejects telemetry without any vehicle, plate, or device identifier", () => {
    const result = vehicleTelemetrySchema.safeParse({
      lat: -6.595038,
      lon: 106.816635
    });

    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /wajib diisi/);
  });

  it("accepts multipart-like public report coordinates as strings", () => {
    const result = publicReportSchema.safeParse({
      plate_no: "F 1901 AK",
      category: "NGETEM",
      description: "Angkot ngetem terlalu lama di luar halte resmi",
      lat: "-6.595038",
      lon: "106.816635",
      reported_at: "2026-01-25T10:15:30.123Z",
      accuracy_m: "12"
    });

    assert.equal(result.success, true);
    assert.equal(result.data.lat, -6.595038);
    assert.equal(result.data.lon, 106.816635);
    assert.equal(result.data.accuracy_m, 12);
  });

  it("rejects empty public report coordinates instead of coercing them to zero", () => {
    const result = publicReportSchema.safeParse({
      plate_no: "F 1901 AK",
      category: "NGETEM",
      description: "Angkot ngetem terlalu lama di luar halte resmi",
      lat: "",
      lon: "106.816635"
    });

    assert.equal(result.success, false);
    assert.equal(result.error.issues[0].path[0], "lat");
  });

  it("rejects invalid speed, heading, and timestamp values", () => {
    assert.equal(normalizeVehicleTelemetry({ lat: -6.5, lon: 106.8, speed_kmh: -1 }).error.message, "speed_kmh must be a number from 0 to 200");
    assert.equal(normalizeVehicleTelemetry({ lat: -6.5, lon: 106.8, heading: 361 }).error.message, "heading must be a number from 0 to 360");
    assert.equal(normalizeVehicleTelemetry({ lat: -6.5, lon: 106.8, ts: "bad-date" }).error.message, "ts must be a valid ISO-8601 timestamp");
  });
});
