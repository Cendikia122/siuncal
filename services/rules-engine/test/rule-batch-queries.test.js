import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchNgetemAggregateByVehicle,
  fetchNgetemOfficialStopByVehicle,
  fetchOffRouteRowsByVehicle,
  fetchOverspeedRowsByVehicle,
  fetchWrongDirectionRowsByVehicle
} from "../src/rule-batch-queries.js";

describe("rule batch query providers", () => {
  it("fetches overspeed rows grouped by vehicle with bounded window params", async () => {
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      assert.match(text, /row_number\(\) OVER \(PARTITION BY vehicle_id ORDER BY ts DESC, position_id DESC\)/);
      return {
        rows: [
          { vehicle_id: "vehicle-01", ts: "2026-01-01T00:02:00Z", speed_kmh: 70 },
          { vehicle_id: "vehicle-01", ts: "2026-01-01T00:01:00Z", speed_kmh: 68 }
        ]
      };
    };

    const rowsByVehicle = await fetchOverspeedRowsByVehicle({
      query,
      vehicleIds: ["vehicle-01"],
      overspeedWindowPoints: 3,
      lostSignalMinutes: 5
    });

    assert.deepEqual(calls[0].params, [["vehicle-01"], 3, 5]);
    assert.equal(rowsByVehicle.get("vehicle-01").length, 2);
  });

  it("fetches off-route rows with base radius and map matching thresholds", async () => {
    const query = async (text, params = []) => {
      assert.match(text, /LEFT JOIN telemetry_matched_positions/);
      assert.match(text, /ST_DWithin/);
      assert.deepEqual(params, [["vehicle-01"], 3, 150, 0.35]);
      return { rows: [{ vehicle_id: "vehicle-01", distance_m: 180, near_base: false }] };
    };

    const rowsByVehicle = await fetchOffRouteRowsByVehicle({
      query,
      vehicleIds: ["vehicle-01"],
      offRouteGraceMinutes: 3,
      baseRadiusMeters: 150,
      mapMatchingMinConfidence: 0.35
    });

    assert.equal(rowsByVehicle.get("vehicle-01")[0].distance_m, 180);
  });

  it("fetches wrong-direction rows with heading, confidence, and speed guards", async () => {
    const query = async (text, params = []) => {
      assert.match(text, /mp\.match_status = 'MATCHED'/);
      assert.match(text, /vp\.heading IS NOT NULL/);
      assert.deepEqual(params, [["vehicle-01"], 4, 0.4, 7]);
      return { rows: [{ vehicle_id: "vehicle-01", heading: 350, matched_heading: 170 }] };
    };

    const rowsByVehicle = await fetchWrongDirectionRowsByVehicle({
      query,
      vehicleIds: ["vehicle-01"],
      wrongDirectionGraceMinutes: 4,
      mapMatchingMinConfidence: 0.4,
      wrongDirectionMinSpeedKmh: 7
    });

    assert.equal(rowsByVehicle.get("vehicle-01")[0].matched_heading, 170);
  });

  it("fetches ngetem official-stop flags and aggregate rows by vehicle", async () => {
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      if (/AS in_official_stop/.test(text)) {
        return { rows: [{ vehicle_id: "vehicle-01", in_official_stop: true }] };
      }
      return { rows: [{ vehicle_id: "vehicle-01", points: 4, avg_speed: 1.2 }] };
    };

    const officialStopByVehicle = await fetchNgetemOfficialStopByVehicle({
      query,
      vehicleIds: ["vehicle-01"],
      officialStopRadiusMeters: 120
    });
    const aggregateByVehicle = await fetchNgetemAggregateByVehicle({
      query,
      vehicleIds: ["vehicle-01"],
      ngetemMinutes: 20
    });

    assert.equal(officialStopByVehicle.get("vehicle-01"), true);
    assert.equal(aggregateByVehicle.get("vehicle-01").points, 4);
    assert.deepEqual(calls.map((call) => call.params), [[["vehicle-01"], 120], [["vehicle-01"], 20]]);
  });
});
