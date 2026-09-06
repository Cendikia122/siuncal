import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRealtimeQueries } from "../src/realtime-queries.js";

const parseBoundedInt = (value, defaultValue, { max }) => {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
};

describe("api-gateway realtime queries", () => {
  it("fetches latest vehicles with route, status, bbox, and bounded limit filters", async () => {
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      assert.match(text, /FROM vehicles v/);
      assert.match(text, /v\.route_id = \$1/);
      assert.match(text, /COALESCE\(vl\.status, v\.status\) = \$2/);
      assert.match(text, /ST_MakeEnvelope\(\$3, \$4, \$5, \$6, 4326\)/);
      assert.match(text, /ORDER BY v\.plate_no/);
      assert.match(text, /LIMIT \$7/);
      return {
        rows: [{
          vehicle_id: "vehicle-01",
          plate_no: "F 1901 AK",
          route_id: "01",
          status: "IN_SERVICE"
        }]
      };
    };
    const { fetchLatestVehicles } = createRealtimeQueries({
      query,
      parseBoundedInt,
      realtimeVehiclesLimit: 1000
    });

    const rows = await fetchLatestVehicles({
      routeId: "01",
      vehicleStatus: "IN_SERVICE",
      bbox: {
        minLon: 106.70,
        minLat: -6.70,
        maxLon: 106.90,
        maxLat: -6.50
      },
      limit: 10000
    });

    assert.deepEqual(rows, [{
      vehicle_id: "vehicle-01",
      plate_no: "F 1901 AK",
      route_id: "01",
      status: "IN_SERVICE"
    }]);
    assert.deepEqual(calls[0].params, ["01", "IN_SERVICE", 106.70, -6.70, 106.90, -6.50, 5000]);
  });

  it("maps open incidents to realtime incident payloads", async () => {
    const createdAt = "2026-06-30T01:00:00.000Z";
    const query = async (text, params = []) => {
      assert.match(text, /FROM incidents i/);
      assert.match(text, /i\.status IN \('OPEN', 'IN_PROGRESS'\)/);
      assert.match(text, /ORDER BY i\.created_at DESC/);
      assert.match(text, /LIMIT 10/);
      assert.deepEqual(params, []);
      return {
        rows: [{
          incident_id: "incident-01",
          type: "NGETEM",
          severity: "HIGH",
          status: "OPEN",
          description: "Berhenti terlalu lama",
          location_desc: "Jl. Pajajaran",
          created_at: createdAt,
          plate_no: "F 1901 AK",
          route_id: "01"
        }]
      };
    };
    const { fetchOpenIncidents } = createRealtimeQueries({
      query,
      parseBoundedInt,
      realtimeVehiclesLimit: 1000
    });

    assert.deepEqual(await fetchOpenIncidents(), [{
      id: "incident-01",
      type: "NGETEM",
      severity: "HIGH",
      status: "OPEN",
      description: "Berhenti terlalu lama",
      location: "Jl. Pajajaran",
      timestamp: createdAt,
      vehicle_plate: "F 1901 AK",
      route_id: "01"
    }]);
  });
});
