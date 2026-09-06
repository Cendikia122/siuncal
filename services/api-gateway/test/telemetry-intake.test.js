import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ingestVehicleTelemetry } from "../src/telemetry-intake.js";
import {
  DEVICE_TAMPER_METRIC_WINDOW_MS,
  TELEMETRY_QUALITY_METRICS,
  TELEMETRY_QUALITY_METRIC_WINDOW_MS,
  telemetryIdentityMetricKey
} from "../src/telemetry-quality-metrics.js";

describe("ingestVehicleTelemetry", () => {
  it("accepts telemetry with a known vehicle id and returns the persisted matched position", async () => {
    const queries = [];
    const query = async (text, params = []) => {
      queries.push({ text, params });

      if (/FROM vehicles WHERE vehicle_id/.test(text)) {
        return { rows: [{ vehicle_id: "vehicle-01" }] };
      }
      if (/FROM vehicle_positions/.test(text)) {
        return { rows: [] };
      }
      if (/INSERT INTO vehicle_positions/.test(text)) {
        assert.equal(params[7], 0.87);
        assert.equal(params[8], -84);
        assert.equal(params[9], true);
        return { rows: [{ position_id: "position-01" }] };
      }
      if (/INSERT INTO telemetry_matched_positions/.test(text)) {
        return {
          rows: [{
            match_id: "match-01",
            match_status: "MATCHED",
            confidence: 0.91,
            snap_distance_m: 12.4,
            distance_along_route_m: 128
          }]
        };
      }
      if (/UPDATE vehicles SET status/.test(text)) {
        return { rows: [] };
      }

      throw new Error(`Unexpected query: ${text}`);
    };

    const result = await ingestVehicleTelemetry(
      {
        vehicle_id: "vehicle-01",
        ts: "2026-01-25T10:15:30.123Z",
        lat: -6.595038,
        lon: 106.816635,
        speed_kmh: 23.5,
        heading: 120,
        status: "IN_SERVICE",
        device: {
          battery: 0.87,
          signal_dbm: -84,
          power_connected: true
        }
      },
      { query }
    );

    assert.deepEqual(result, {
      ok: true,
      position_id: "position-01",
      matched_position: {
        match_id: "match-01",
        match_status: "MATCHED",
        confidence: 0.91,
        snap_distance_m: 12.4,
        distance_along_route_m: 128
      }
    });
    assert.equal(queries.some(({ text }) => /telemetry_matched_positions/.test(text)), true);
  });

  it("falls back to plate number when vehicle id is not present", async () => {
    const query = async (text, params = []) => {
      if (/FROM vehicles WHERE plate_no/.test(text)) {
        assert.deepEqual(params, ["F 1901 AK"]);
        return { rows: [{ vehicle_id: "vehicle-from-plate" }] };
      }
      if (/FROM vehicle_positions/.test(text)) {
        return { rows: [] };
      }
      if (/INSERT INTO vehicle_positions/.test(text)) {
        assert.equal(params[0], "vehicle-from-plate");
        return { rows: [{ position_id: "position-from-plate" }] };
      }
      if (/INSERT INTO telemetry_matched_positions/.test(text)) {
        return { rows: [] };
      }
      return { rows: [] };
    };

    const result = await ingestVehicleTelemetry(
      {
        plate_no: "F 1901 AK",
        lat: -6.595038,
        lon: 106.816635,
        speed_kmh: 12.5
      },
      { query }
    );

    assert.equal(result.ok, true);
    assert.equal(result.position_id, "position-from-plate");
    assert.equal(result.matched_position, null);
  });

  it("falls back to the active assignment for a known device identity", async () => {
    const seen = [];
    const query = async (text, params = []) => {
      seen.push(text);
      if (/FROM devices/.test(text)) {
        assert.deepEqual(params, ["device-01", "86753090001"]);
        return { rows: [{ device_id: "device-01" }] };
      }
      if (/FROM assignments/.test(text)) {
        assert.deepEqual(params, ["device-01"]);
        return { rows: [{ vehicle_id: "vehicle-from-device" }] };
      }
      if (/FROM vehicle_positions/.test(text)) {
        return { rows: [] };
      }
      if (/INSERT INTO vehicle_positions/.test(text)) {
        assert.equal(params[0], "vehicle-from-device");
        return { rows: [{ position_id: "position-from-device" }] };
      }
      if (/INSERT INTO telemetry_matched_positions/.test(text)) {
        return { rows: [{ match_id: "match-from-device", match_status: "LOW_CONFIDENCE" }] };
      }
      return { rows: [] };
    };

    const result = await ingestVehicleTelemetry(
      {
        device_id: "device-01",
        imei_or_serial: "86753090001",
        lat: -6.595038,
        lon: 106.816635
      },
      { query }
    );

    assert.equal(result.ok, true);
    assert.equal(result.position_id, "position-from-device");
    assert.equal(result.matched_position.match_status, "LOW_CONFIDENCE");
    assert.equal(seen.some((text) => /FROM assignments/.test(text)), true);
  });

  it("treats an already received vehicle ping as duplicate instead of inserting another point", async () => {
    const metrics = [];
    const queries = [];
    const query = async (text, params = []) => {
      queries.push({ text, params });
      if (/FROM vehicles WHERE vehicle_id/.test(text)) {
        return { rows: [{ vehicle_id: "vehicle-01" }] };
      }
      if (/FROM vehicle_positions/.test(text)) {
        assert.deepEqual(params, [
          "vehicle-01",
          new Date("2026-01-25T10:15:30.123Z"),
          -6.595038,
          106.816635
        ]);
        return { rows: [{ position_id: "position-existing" }] };
      }
      if (/INSERT INTO vehicle_positions/.test(text)) {
        throw new Error("duplicate telemetry must not insert another position");
      }
      return { rows: [] };
    };

    const result = await ingestVehicleTelemetry(
      {
        vehicle_id: "vehicle-01",
        ts: "2026-01-25T10:15:30.123Z",
        lat: -6.595038,
        lon: 106.816635
      },
      {
        query,
        recordRollingMetricEvent: async (key, options) => {
          metrics.push({ key, options });
        }
      }
    );

    assert.deepEqual(result, {
      ok: true,
      duplicate: true,
      position_id: "position-existing",
      matched_position: null
    });
    assert.equal(queries.some(({ text }) => /INSERT INTO vehicle_positions/.test(text)), false);
    assert.deepEqual(metrics, [{
      key: "telemetry.duplicate_payload",
      options: { windowMs: 60 * 60 * 1000 }
    }]);
  });

  it("returns not found when no vehicle can be resolved", async () => {
    const queries = [];
    const query = async (text) => {
      queries.push(text);
      return { rows: [] };
    };

    const result = await ingestVehicleTelemetry(
      {
        plate_no: "F 0000 ZZ",
        lat: -6.595038,
        lon: 106.816635
      },
      { query, recordRollingMetricEvent: async () => {} }
    );

    assert.deepEqual(result, {
      ok: false,
      status: 404,
      error: { code: "NOT_FOUND", message: "Vehicle not found" }
    });
    assert.equal(queries.some((text) => /INSERT INTO vehicle_positions/.test(text)), false);
  });

  it("records a per-device identity mismatch metric for tamper detection", async () => {
    const metrics = [];
    const query = async () => ({ rows: [] });

    const result = await ingestVehicleTelemetry(
      {
        imei_or_serial: "86753090001",
        lat: -6.595038,
        lon: 106.816635
      },
      {
        query,
        recordRollingMetricEvent: async (key, options) => {
          metrics.push({ key, options });
        }
      }
    );

    assert.equal(result.ok, false);
    assert.deepEqual(metrics, [
      {
        key: TELEMETRY_QUALITY_METRICS.invalidDeviceIdentity,
        options: { windowMs: TELEMETRY_QUALITY_METRIC_WINDOW_MS }
      },
      {
        key: telemetryIdentityMetricKey("86753090001"),
        options: { windowMs: DEVICE_TAMPER_METRIC_WINDOW_MS }
      }
    ]);
  });
});
