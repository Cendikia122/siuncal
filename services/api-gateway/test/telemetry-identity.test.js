import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveVehicleIdFromTelemetryIdentity } from "../src/telemetry-identity.js";

describe("resolveVehicleIdFromTelemetryIdentity", () => {
  it("resolves directly from vehicle id before trying fallback identities", async () => {
    const queries = [];
    const query = async (text, params = []) => {
      queries.push({ text, params });
      if (/FROM vehicles WHERE vehicle_id/.test(text)) {
        return { rows: [{ vehicle_id: "vehicle-01" }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    };

    const vehicleId = await resolveVehicleIdFromTelemetryIdentity({ vehicleId: "vehicle-01", plateNo: "F 1901 AK" }, query);

    assert.equal(vehicleId, "vehicle-01");
    assert.equal(queries.length, 1);
    assert.deepEqual(queries[0].params, ["vehicle-01"]);
  });

  it("falls back from plate number to active device assignment", async () => {
    const seen = [];
    const query = async (text, params = []) => {
      seen.push({ text, params });
      if (/FROM vehicles WHERE plate_no/.test(text)) return { rows: [] };
      if (/FROM devices/.test(text)) {
        assert.deepEqual(params, ["device-01", "86753090001"]);
        return { rows: [{ device_id: "device-01" }] };
      }
      if (/FROM assignments/.test(text)) {
        assert.deepEqual(params, ["device-01"]);
        return { rows: [{ vehicle_id: "vehicle-from-device" }] };
      }
      throw new Error(`Unexpected query: ${text}`);
    };

    const vehicleId = await resolveVehicleIdFromTelemetryIdentity(
      {
        plateNo: "F 0000 ZZ",
        deviceId: "device-01",
        imei_or_serial: "86753090001"
      },
      query
    );

    assert.equal(vehicleId, "vehicle-from-device");
    assert.equal(seen.some(({ text }) => /FROM assignments/.test(text)), true);
  });

  it("returns null when no telemetry identity maps to a vehicle", async () => {
    const query = async () => ({ rows: [] });

    const vehicleId = await resolveVehicleIdFromTelemetryIdentity(
      {
        vehicleId: "missing-vehicle",
        plateNo: "F 0000 ZZ",
        deviceId: "missing-device"
      },
      query
    );

    assert.equal(vehicleId, null);
  });
});
