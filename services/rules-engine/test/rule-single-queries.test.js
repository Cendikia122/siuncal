import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  fetchNgetemAggregateRows,
  fetchNgetemOfficialStop,
  fetchOffRouteRows,
  fetchOverspeedRows,
  fetchWrongDirectionRows
} from "../src/rule-single-queries.js";

describe("rule single-vehicle query providers", () => {
  it("fetches overspeed rows with bounded window params", async () => {
    const query = async (text, params = []) => {
      assert.match(text, /FROM vehicle_positions/);
      assert.match(text, /ORDER BY ts DESC/);
      assert.deepEqual(params, ["vehicle-01", 3, 5]);
      return {
        rows: [
          { ts: "2026-01-01T00:02:00Z", speed_kmh: 70 },
          { ts: "2026-01-01T00:01:00Z", speed_kmh: 68 }
        ]
      };
    };

    const rows = await fetchOverspeedRows({
      query,
      vehicleId: "vehicle-01",
      overspeedWindowPoints: 3,
      lostSignalMinutes: 5
    });

    assert.equal(rows.length, 2);
    assert.equal(rows[0].speed_kmh, 70);
  });

  it("fetches wrong-direction rows with heading, confidence, and speed guards", async () => {
    const query = async (text, params = []) => {
      assert.match(text, /JOIN telemetry_matched_positions/);
      assert.match(text, /mp\.match_status = 'MATCHED'/);
      assert.match(text, /vp\.heading IS NOT NULL/);
      assert.deepEqual(params, ["vehicle-01", 4, 0.4, 7]);
      return {
        rows: [
          { ts: "2026-01-01T00:02:00Z", heading: 350, matched_heading: 170 }
        ]
      };
    };

    const rows = await fetchWrongDirectionRows({
      query,
      vehicleId: "vehicle-01",
      wrongDirectionGraceMinutes: 4,
      mapMatchingMinConfidence: 0.4,
      wrongDirectionMinSpeedKmh: 7
    });

    assert.equal(rows[0].matched_heading, 170);
  });

  it("fetches off-route rows with vehicle route and base params", async () => {
    const vehicle = {
      vehicle_id: "vehicle-01",
      route_id: "route-01",
      base_lat: -6.6,
      base_lon: 106.8
    };
    const query = async (text, params = []) => {
      assert.match(text, /WITH route_geom AS/);
      assert.match(text, /LEFT JOIN telemetry_matched_positions/);
      assert.match(text, /ST_DWithin/);
      assert.deepEqual(params, ["vehicle-01", "route-01", 3, -6.6, 106.8, 150, 0.35]);
      return {
        rows: [
          { ts: "2026-01-01T00:02:00Z", distance_m: 180, near_base: false }
        ]
      };
    };

    const rows = await fetchOffRouteRows({
      query,
      vehicle,
      offRouteGraceMinutes: 3,
      baseRadiusMeters: 150,
      mapMatchingMinConfidence: 0.35
    });

    assert.equal(rows[0].distance_m, 180);
    assert.equal(rows[0].near_base, false);
  });

  it("fetches ngetem official-stop flag for the vehicle location", async () => {
    const vehicle = {
      route_id: "route-01",
      lon: 106.8,
      lat: -6.6
    };
    const query = async (text, params = []) => {
      assert.match(text, /SELECT EXISTS/);
      assert.match(text, /FROM route_stops/);
      assert.match(text, /FROM geofences/);
      assert.deepEqual(params, ["route-01", 106.8, -6.6, 120]);
      return { rows: [{ in_official_stop: true }] };
    };

    const inOfficialStop = await fetchNgetemOfficialStop({
      query,
      vehicle,
      officialStopRadiusMeters: 120
    });

    assert.equal(inOfficialStop, true);
  });

  it("fetches ngetem aggregate rows using the current vehicle point", async () => {
    const vehicle = {
      vehicle_id: "vehicle-01",
      lon: 106.8,
      lat: -6.6
    };
    const query = async (text, params = []) => {
      assert.match(text, /COUNT\(\*\)::int AS points/);
      assert.match(text, /MAX\(ST_Distance/);
      assert.deepEqual(params, ["vehicle-01", 106.8, -6.6, 20]);
      return { rows: [{ points: 4, avg_speed: 1.2, max_dist_m: 8 }] };
    };

    const rows = await fetchNgetemAggregateRows({
      query,
      vehicle,
      ngetemMinutes: 20
    });

    assert.equal(rows[0].points, 4);
    assert.equal(rows[0].avg_speed, 1.2);
  });
});
