import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getTelemetryQualityReport,
  renderTelemetryQualityCsv
} from "../src/telemetry-quality.js";

describe("telemetry quality report", () => {
  it("summarizes vehicle, route, owner, and device quality from recent telemetry", async () => {
    const end = new Date("2026-06-30T03:00:00.000Z");
    const calls = [];
    const query = async (text, params = []) => {
      calls.push({ text, params });
      assert.match(text, /FROM vehicles v/);
      assert.match(text, /LEFT JOIN vehicle_positions vp/);
      assert.match(text, /LEFT JOIN telemetry_matched_positions mp/);
      assert.match(text, /v\.route_id = \$4/);
      return {
        rows: [
          {
            vehicle_id: "vehicle-01",
            plate_no: "F 1901 AK",
            route_id: "01",
            route_name: "Trayek 01",
            owner_id: "owner-01",
            owner_name: "Koperasi Bogor",
            device_id: "device-01",
            imei_or_serial: "86753090001",
            status: "IN_SERVICE",
            last_ping: "2026-06-30T02:59:55.000Z",
            ping_count: 700,
            duplicate_timestamp_count: 1,
            drift_count: 2,
            low_confidence_count: 1,
            avg_snap_distance_m: 8.5,
            p95_snap_distance_m: 22.4
          },
          {
            vehicle_id: "vehicle-02",
            plate_no: "F 1902 AK",
            route_id: "01",
            route_name: "Trayek 01",
            owner_id: "owner-01",
            owner_name: "Koperasi Bogor",
            device_id: null,
            imei_or_serial: null,
            status: "IN_SERVICE",
            last_ping: "2026-06-30T02:10:00.000Z",
            ping_count: 30,
            duplicate_timestamp_count: 0,
            drift_count: 8,
            low_confidence_count: 7,
            avg_snap_distance_m: 75,
            p95_snap_distance_m: 120
          }
        ]
      };
    };
    const rollingCounts = async (key) => ({
      "telemetry.invalid_identity": 3,
      "telemetry.assignment_mismatch": 2,
      "telemetry.duplicate_payload": 4
    })[key] || 0;

    const report = await getTelemetryQualityReport({
      query,
      getRollingMetricCount: rollingCounts,
      now: () => end,
      params: {
        route_id: "01",
        hours: "1",
        target_interval_sec: "5",
        stale_minutes: "10"
      }
    });

    assert.deepEqual(calls[0].params, [
      new Date("2026-06-30T02:00:00.000Z"),
      end,
      80,
      "01",
      200
    ]);
    assert.equal(report.window.target_interval_sec, 5);
    assert.equal(report.window.expected_ping_count, 720);
    assert.equal(report.summary.total_vehicles, 2);
    assert.equal(report.summary.stale_vehicles, 1);
    assert.equal(report.summary.assignment_mismatch_vehicles, 1);
    assert.equal(report.summary.missing_ping_count, 710);
    assert.equal(report.summary.tracking_valid_pct, 50.69);
    assert.equal(report.summary.sla_target_pct, 99.5);
    assert.equal(report.summary.sla_met, false);
    assert.deepEqual(report.summary.rolling_rejections, {
      invalid_device_identity: 3,
      assignment_mismatch: 2,
      duplicate_payload: 4
    });
    assert.equal(report.items[0].quality_level, "GOOD");
    assert.equal(report.items[1].quality_level, "CRITICAL");
    assert.equal(report.by_route[0].route_id, "01");
    assert.equal(report.by_route[0].quality_score, 48.47);
    assert.equal(report.by_owner[0].owner_id, "owner-01");
    assert.equal(report.by_device.some((item) => item.device_id === "UNASSIGNED"), true);
  });

  it("renders a monthly pilot review CSV with summary and grouped sections", () => {
    const csv = renderTelemetryQualityCsv({
      window: {
        start: "2026-06-01T00:00:00.000Z",
        end: "2026-07-01T00:00:00.000Z",
        hours: 720,
        target_interval_sec: 5
      },
      summary: {
        total_vehicles: 1,
        stale_vehicles: 0,
        missing_ping_count: 2,
        drift_count: 1,
        duplicate_timestamp_count: 0,
        tracking_valid_pct: 99.72,
        sla_target_pct: 99.5,
        sla_met: true,
        rolling_rejections: {
          invalid_device_identity: 1,
          assignment_mismatch: 0,
          duplicate_payload: 0
        }
      },
      items: [{
        plate_no: "F 1901 AK",
        route_id: "01",
        owner_name: "Koperasi, Bogor",
        imei_or_serial: "86753090001",
        last_ping: "2026-06-30T23:59:55.000Z",
        tracking_valid_pct: 99.72,
        quality_score: 98,
        quality_level: "GOOD",
        missing_ping_count: 2,
        drift_count: 1,
        duplicate_timestamp_count: 0,
        stale: false,
        assignment_mismatch: false
      }],
      by_route: [{
        route_id: "01",
        route_name: "Trayek 01",
        total_vehicles: 1,
        tracking_valid_pct: 99.72,
        quality_score: 98,
        quality_level: "GOOD",
        stale_vehicles: 0,
        missing_ping_count: 2,
        drift_count: 1
      }],
      by_device: [{
        device_id: "device-01",
        imei_or_serial: "86753090001",
        total_vehicles: 1,
        tracking_valid_pct: 99.72,
        quality_score: 98,
        quality_level: "GOOD",
        stale_vehicles: 0,
        missing_ping_count: 2,
        drift_count: 1
      }]
    });

    assert.match(csv, /^Summary\nMetric,Value/m);
    assert.match(csv, /Window Hours,720/);
    assert.match(csv, /^Vehicles\nPlate No,Route,Owner,Device/m);
    assert.match(csv, /"Koperasi, Bogor"/);
    assert.match(csv, /^Routes\nRoute,Route Name/m);
    assert.match(csv, /^Devices\nDevice ID,IMEI\/Serial/m);
  });
});
