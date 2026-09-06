import { TELEMETRY_QUALITY_METRICS } from "./telemetry-quality-metrics.js";

const DEFAULTS = {
  hours: 1,
  targetIntervalSec: 5,
  staleMinutes: 10,
  driftThresholdMeters: 80,
  slaTargetPct: 99.5,
  limit: 200
};

const boundedNumber = (value, fallback, { min, max }) => {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
};

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const levelForScore = (score) => {
  if (score >= 95) return "GOOD";
  if (score >= 85) return "WATCH";
  if (score >= 70) return "DEGRADED";
  return "CRITICAL";
};

const qualityScoreFor = ({ validPct, driftRatePct, stale, assignmentMismatch }) => {
  const penalty = (stale ? 15 : 0) + (assignmentMismatch ? 10 : 0) + Math.min(driftRatePct, 20);
  return Math.max(0, Math.min(100, round(validPct - penalty)));
};

const aggregateBy = (items, keyField, labelField) => {
  const groups = new Map();
  for (const item of items) {
    const key = item[keyField] || "UNKNOWN";
    const current = groups.get(key) || {
      [keyField]: key,
      [labelField]: item[labelField] || key,
      total_vehicles: 0,
      stale_vehicles: 0,
      missing_ping_count: 0,
      drift_count: 0,
      duplicate_timestamp_count: 0,
      qualityScoreSum: 0,
      trackingValidPctSum: 0
    };
    current.total_vehicles += 1;
    current.stale_vehicles += item.stale ? 1 : 0;
    current.missing_ping_count += item.missing_ping_count;
    current.drift_count += item.drift_count;
    current.duplicate_timestamp_count += item.duplicate_timestamp_count;
    current.qualityScoreSum += item.quality_score;
    current.trackingValidPctSum += item.tracking_valid_pct;
    groups.set(key, current);
  }

  return [...groups.values()]
    .map((group) => ({
      [keyField]: group[keyField],
      [labelField]: group[labelField],
      total_vehicles: group.total_vehicles,
      stale_vehicles: group.stale_vehicles,
      missing_ping_count: group.missing_ping_count,
      drift_count: group.drift_count,
      duplicate_timestamp_count: group.duplicate_timestamp_count,
      tracking_valid_pct: round(group.trackingValidPctSum / group.total_vehicles),
      quality_score: round(group.qualityScoreSum / group.total_vehicles),
      quality_level: levelForScore(group.qualityScoreSum / group.total_vehicles)
    }))
    .sort((a, b) => a.quality_score - b.quality_score || String(a[keyField]).localeCompare(String(b[keyField])));
};

const aggregateDevices = (items) => {
  const normalized = items.map((item) => ({
    ...item,
    device_group_id: item.device_id || "UNASSIGNED",
    device_label: item.imei_or_serial || "Tanpa device aktif"
  }));
  return aggregateBy(normalized, "device_group_id", "device_label").map((item) => ({
    device_id: item.device_group_id,
    imei_or_serial: item.device_label,
    total_vehicles: item.total_vehicles,
    stale_vehicles: item.stale_vehicles,
    missing_ping_count: item.missing_ping_count,
    drift_count: item.drift_count,
    duplicate_timestamp_count: item.duplicate_timestamp_count,
    tracking_valid_pct: item.tracking_valid_pct,
    quality_score: item.quality_score,
    quality_level: item.quality_level
  }));
};

const csvCell = (value) => {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
};

const csvRow = (values) => values.map(csvCell).join(",");

const appendCsvSection = (lines, title, header, rows) => {
  lines.push(title);
  lines.push(csvRow(header));
  for (const row of rows) lines.push(csvRow(row));
  lines.push("");
};

export const renderTelemetryQualityCsv = (report) => {
  const lines = [];
  appendCsvSection(lines, "Summary", ["Metric", "Value"], [
    ["Window Start", report.window.start],
    ["Window End", report.window.end],
    ["Window Hours", report.window.hours],
    ["Target Interval Sec", report.window.target_interval_sec],
    ["SLA Target Pct", report.summary.sla_target_pct],
    ["Tracking Valid Pct", report.summary.tracking_valid_pct],
    ["SLA Met", report.summary.sla_met ? "yes" : "no"],
    ["Total Vehicles", report.summary.total_vehicles],
    ["Stale Vehicles", report.summary.stale_vehicles],
    ["Missing Ping Count", report.summary.missing_ping_count],
    ["GPS Drift Count", report.summary.drift_count],
    ["Duplicate Timestamp Count", report.summary.duplicate_timestamp_count],
    ["Invalid Device Identity Rejections", report.summary.rolling_rejections.invalid_device_identity],
    ["Assignment Mismatch Rejections", report.summary.rolling_rejections.assignment_mismatch],
    ["Duplicate Payload Rejections", report.summary.rolling_rejections.duplicate_payload]
  ]);

  appendCsvSection(lines, "Vehicles", [
    "Plate No",
    "Route",
    "Owner",
    "Device",
    "Last Ping",
    "Tracking Valid Pct",
    "Quality Score",
    "Quality Level",
    "Missing Ping Count",
    "GPS Drift Count",
    "Duplicate Timestamp Count",
    "Stale",
    "Assignment Mismatch"
  ], report.items.map((item) => [
    item.plate_no,
    item.route_id,
    item.owner_name,
    item.imei_or_serial,
    item.last_ping,
    item.tracking_valid_pct,
    item.quality_score,
    item.quality_level,
    item.missing_ping_count,
    item.drift_count,
    item.duplicate_timestamp_count,
    item.stale ? "yes" : "no",
    item.assignment_mismatch ? "yes" : "no"
  ]));

  appendCsvSection(lines, "Routes", [
    "Route",
    "Route Name",
    "Total Vehicles",
    "Tracking Valid Pct",
    "Quality Score",
    "Quality Level",
    "Stale Vehicles",
    "Missing Ping Count",
    "GPS Drift Count"
  ], report.by_route.map((item) => [
    item.route_id,
    item.route_name,
    item.total_vehicles,
    item.tracking_valid_pct,
    item.quality_score,
    item.quality_level,
    item.stale_vehicles,
    item.missing_ping_count,
    item.drift_count
  ]));

  appendCsvSection(lines, "Devices", [
    "Device ID",
    "IMEI/Serial",
    "Total Vehicles",
    "Tracking Valid Pct",
    "Quality Score",
    "Quality Level",
    "Stale Vehicles",
    "Missing Ping Count",
    "GPS Drift Count"
  ], report.by_device.map((item) => [
    item.device_id,
    item.imei_or_serial,
    item.total_vehicles,
    item.tracking_valid_pct,
    item.quality_score,
    item.quality_level,
    item.stale_vehicles,
    item.missing_ping_count,
    item.drift_count
  ]));

  return lines.join("\n").trimEnd() + "\n";
};

export const createTelemetryQualityScope = (params = {}, defaults = DEFAULTS) => {
  const hours = boundedNumber(params.hours, defaults.hours, { min: 1, max: 24 * 31 });
  const targetIntervalSec = boundedNumber(params.target_interval_sec, defaults.targetIntervalSec, { min: 1, max: 300 });
  const staleMinutes = boundedNumber(params.stale_minutes, defaults.staleMinutes, { min: 1, max: 24 * 60 });
  const driftThresholdMeters = boundedNumber(params.drift_threshold_m, defaults.driftThresholdMeters, { min: 5, max: 1000 });
  const slaTargetPct = boundedNumber(params.sla_target_pct, defaults.slaTargetPct, { min: 50, max: 100 });
  const limit = Math.floor(boundedNumber(params.limit, defaults.limit, { min: 1, max: 1000 }));
  const routeId = params.route_id ? String(params.route_id) : null;

  return {
    hours,
    targetIntervalSec,
    staleMinutes,
    driftThresholdMeters,
    slaTargetPct,
    limit,
    routeId
  };
};

export const getTelemetryQualityReport = async ({
  query,
  getRollingMetricCount,
  now = () => new Date(),
  params = {},
  defaults = DEFAULTS
}) => {
  const scope = createTelemetryQualityScope(params, defaults);
  const end = now();
  const start = new Date(end.getTime() - scope.hours * 60 * 60 * 1000);
  const expectedPingCount = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 1000 / scope.targetIntervalSec));
  const queryParams = [
    start,
    end,
    scope.driftThresholdMeters
  ];
  const filters = [];
  if (scope.routeId) {
    queryParams.push(scope.routeId);
    filters.push(`v.route_id = $${queryParams.length}`);
  }
  queryParams.push(scope.limit);
  const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const { rows } = await query(
    `SELECT
        v.vehicle_id,
        v.plate_no,
        v.route_id,
        r.name AS route_name,
        o.owner_id,
        o.name AS owner_name,
        d.device_id,
        d.imei_or_serial,
        COALESCE(vl.status, v.status) AS status,
        vl.ts AS last_ping,
        COUNT(vp.position_id)::int AS ping_count,
        GREATEST(COUNT(vp.position_id) - COUNT(DISTINCT vp.ts), 0)::int AS duplicate_timestamp_count,
        COUNT(vp.position_id) FILTER (
          WHERE mp.match_status = 'LOW_CONFIDENCE'
             OR mp.snap_distance_m::float > $3::double precision
        )::int AS drift_count,
        COUNT(vp.position_id) FILTER (WHERE mp.match_status = 'LOW_CONFIDENCE')::int AS low_confidence_count,
        ROUND(AVG(mp.snap_distance_m)::numeric, 2)::float AS avg_snap_distance_m,
        ROUND((PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY mp.snap_distance_m))::numeric, 2)::float AS p95_snap_distance_m
     FROM vehicles v
     LEFT JOIN owners o ON o.owner_id = v.owner_id
     LEFT JOIN routes r ON r.route_id = v.route_id
     LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
     LEFT JOIN assignments a ON a.vehicle_id = v.vehicle_id AND a.is_active = true
     LEFT JOIN devices d ON d.device_id = a.device_id
     LEFT JOIN vehicle_positions vp
       ON vp.vehicle_id = v.vehicle_id
      AND vp.ts >= $1
      AND vp.ts < $2
     LEFT JOIN telemetry_matched_positions mp
       ON mp.vehicle_id = vp.vehicle_id
      AND mp.ts = vp.ts
      AND mp.position_id = vp.position_id
     ${whereClause}
     GROUP BY
       v.vehicle_id,
       v.plate_no,
       v.route_id,
       r.name,
       o.owner_id,
       o.name,
       d.device_id,
       d.imei_or_serial,
       vl.status,
       v.status,
       vl.ts
     ORDER BY v.route_id, v.plate_no
     LIMIT $${queryParams.length}`,
    queryParams
  );

  const items = rows.map((row) => {
    const pingCount = Number(row.ping_count || 0);
    const driftCount = Number(row.drift_count || 0);
    const duplicateTimestampCount = Number(row.duplicate_timestamp_count || 0);
    const missingPingCount = Math.max(expectedPingCount - pingCount, 0);
    const validPct = round(Math.min(100, (pingCount / expectedPingCount) * 100));
    const driftRatePct = pingCount > 0 ? round((driftCount / pingCount) * 100) : 0;
    const lastPingMs = row.last_ping ? new Date(row.last_ping).getTime() : null;
    const minutesSinceLastPing = lastPingMs ? round((end.getTime() - lastPingMs) / 60000, 1) : null;
    const stale = minutesSinceLastPing === null || minutesSinceLastPing > scope.staleMinutes;
    const assignmentMismatch = !row.device_id;
    const qualityScore = qualityScoreFor({
      validPct,
      driftRatePct,
      stale,
      assignmentMismatch
    });

    return {
      vehicle_id: row.vehicle_id,
      plate_no: row.plate_no,
      route_id: row.route_id,
      route_name: row.route_name,
      owner_id: row.owner_id || "UNKNOWN",
      owner_name: row.owner_name || "Tanpa pemilik",
      device_id: row.device_id,
      imei_or_serial: row.imei_or_serial,
      status: row.status,
      last_ping: row.last_ping,
      minutes_since_last_ping: minutesSinceLastPing,
      stale,
      assignment_mismatch: assignmentMismatch,
      ping_count: pingCount,
      expected_ping_count: expectedPingCount,
      missing_ping_count: missingPingCount,
      duplicate_timestamp_count: duplicateTimestampCount,
      drift_count: driftCount,
      low_confidence_count: Number(row.low_confidence_count || 0),
      avg_snap_distance_m: Number(row.avg_snap_distance_m || 0),
      p95_snap_distance_m: Number(row.p95_snap_distance_m || 0),
      tracking_valid_pct: validPct,
      drift_rate_pct: driftRatePct,
      quality_score: qualityScore,
      quality_level: levelForScore(qualityScore)
    };
  });

  const totals = items.reduce((acc, item) => {
    acc.expected += item.expected_ping_count;
    acc.pings += item.ping_count;
    acc.missing += item.missing_ping_count;
    acc.drift += item.drift_count;
    acc.duplicates += item.duplicate_timestamp_count;
    acc.stale += item.stale ? 1 : 0;
    acc.assignmentMismatch += item.assignment_mismatch ? 1 : 0;
    acc.qualityScore += item.quality_score;
    return acc;
  }, {
    expected: 0,
    pings: 0,
    missing: 0,
    drift: 0,
    duplicates: 0,
    stale: 0,
    assignmentMismatch: 0,
    qualityScore: 0
  });
  const trackingValidPct = totals.expected > 0 ? round(Math.min(100, (totals.pings / totals.expected) * 100)) : 0;

  const metricWindowMs = scope.hours * 60 * 60 * 1000;
  const [
    invalidDeviceIdentity,
    assignmentMismatchRejections,
    duplicatePayload
  ] = await Promise.all([
    getRollingMetricCount(TELEMETRY_QUALITY_METRICS.invalidDeviceIdentity, { windowMs: metricWindowMs }),
    getRollingMetricCount(TELEMETRY_QUALITY_METRICS.assignmentMismatch, { windowMs: metricWindowMs }),
    getRollingMetricCount(TELEMETRY_QUALITY_METRICS.duplicatePayload, { windowMs: metricWindowMs })
  ]);

  return {
    window: {
      start: start.toISOString(),
      end: end.toISOString(),
      hours: scope.hours,
      target_interval_sec: scope.targetIntervalSec,
      stale_minutes: scope.staleMinutes,
      drift_threshold_m: scope.driftThresholdMeters,
      expected_ping_count: expectedPingCount
    },
    summary: {
      total_vehicles: items.length,
      stale_vehicles: totals.stale,
      assignment_mismatch_vehicles: totals.assignmentMismatch,
      missing_ping_count: totals.missing,
      drift_count: totals.drift,
      duplicate_timestamp_count: totals.duplicates,
      tracking_valid_pct: trackingValidPct,
      quality_score: items.length ? round(totals.qualityScore / items.length) : 0,
      sla_target_pct: scope.slaTargetPct,
      sla_met: trackingValidPct >= scope.slaTargetPct,
      rolling_rejections: {
        invalid_device_identity: Number(invalidDeviceIdentity || 0),
        assignment_mismatch: Number(assignmentMismatchRejections || 0),
        duplicate_payload: Number(duplicatePayload || 0)
      }
    },
    items,
    by_route: aggregateBy(items, "route_id", "route_name"),
    by_owner: aggregateBy(items, "owner_id", "owner_name"),
    by_device: aggregateDevices(items)
  };
};
