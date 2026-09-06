export {
  RULE_RISK_DELTAS,
  clampScore,
  riskDeltaForRule,
  riskLevelForScore
} from "./risk-scoring.js";

export const headingDiffDegrees = (a, b) => {
  if (a === null || a === undefined || b === null || b === undefined) return null;
  const diff = Math.abs(Number(a) - Number(b)) % 360;
  return diff > 180 ? 360 - diff : diff;
};

const timestampMs = (value) => {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const latestTimestamp = (rows) => {
  const timestamps = rows.map((row) => timestampMs(row.ts)).filter((value) => value !== null);
  if (!timestamps.length) return null;
  return new Date(Math.max(...timestamps)).toISOString();
};

const earliestTimestamp = (rows) => {
  const timestamps = rows.map((row) => timestampMs(row.ts)).filter((value) => value !== null);
  if (!timestamps.length) return null;
  return new Date(Math.min(...timestamps)).toISOString();
};

const locationFrom = (row) => row && row.lat !== null && row.lat !== undefined && row.lon !== null && row.lon !== undefined
  ? { lat: Number(row.lat), lon: Number(row.lon) }
  : null;

export const buildEvidence = ({ vehicle, rule, severity, window, pointCount, location, threshold, metrics }) => ({
  vehicle: {
    vehicle_id: vehicle?.vehicle_id,
    plate_no: vehicle?.plate_no,
    status: vehicle?.status
  },
  route_id: vehicle?.route_id || null,
  rule,
  severity,
  window,
  point_count: Number(pointCount || 0),
  location,
  threshold,
  metrics
});

const resolve = (rule, reason) => ({ action: "resolve", rule, reason });

const open = ({ vehicle, rule, severity, window, pointCount, location, threshold, metrics }) => ({
  action: "open",
  rule,
  severity,
  evidence: buildEvidence({ vehicle, rule, severity, window, pointCount, location, threshold, metrics }),
  lat: location?.lat ?? null,
  lon: location?.lon ?? null
});

export const evaluateLostSignalDecision = ({ vehicle, nowMs = Date.now(), config }) => {
  const rule = "LOST_SIGNAL";
  const lastPingMs = timestampMs(vehicle?.ts);
  const minutesSince = lastPingMs === null ? null : Math.round((nowMs - lastPingMs) / 60000);
  if (minutesSince !== null && minutesSince <= config.lostSignalMinutes) {
    return resolve(rule, "Ping sudah kembali normal");
  }

  const severity = minutesSince !== null && minutesSince > config.lostSignalCriticalMinutes ? "CRITICAL" : "HIGH";
  return open({
    vehicle,
    rule,
    severity,
    window: { start: vehicle?.ts || null, end: new Date(nowMs).toISOString(), minutes: minutesSince },
    pointCount: 0,
    location: locationFrom(vehicle),
    threshold: {
      lost_signal_minutes: config.lostSignalMinutes,
      critical_minutes: config.lostSignalCriticalMinutes
    },
    metrics: { last_ping_at: vehicle?.ts || null, minutes_since_ping: minutesSince }
  });
};

export const evaluateOverspeedDecision = ({ vehicle, rows, config }) => {
  const rule = "OVERSPEED";
  const overspeedRows = rows.filter((row) => Number(row.speed_kmh || 0) > config.overspeedThreshold);
  const shouldOpen = rows.length >= config.overspeedMinPoints && overspeedRows.length >= config.overspeedMinPoints;
  if (!shouldOpen) return resolve(rule, "Kecepatan kembali normal dalam window telemetry");

  const maxSpeed = Math.max(...rows.map((row) => Number(row.speed_kmh || 0)));
  const severity = maxSpeed >= config.overspeedThreshold + 20 ? "HIGH" : "MEDIUM";
  const latest = rows[0];
  return open({
    vehicle,
    rule,
    severity,
    window: { start: earliestTimestamp(rows), end: latestTimestamp(rows), points: rows.length },
    pointCount: rows.length,
    location: locationFrom(latest),
    threshold: {
      max_speed_kmh: config.overspeedThreshold,
      min_points: config.overspeedMinPoints,
      window_points: config.overspeedWindowPoints
    },
    metrics: {
      overspeed_points: overspeedRows.length,
      max_speed_kmh: maxSpeed,
      speeds_kmh: rows.map((row) => Number(row.speed_kmh || 0))
    }
  });
};

export const evaluateOffRouteDecision = ({ vehicle, rows, config }) => {
  const rule = "OFF_ROUTE";
  if (vehicle?.status !== "IN_SERVICE") return resolve(rule, "Kendaraan tidak dalam status IN_SERVICE");

  const distanceOf = (row) => row.distance_m ?? row.distance_to_corridor_m;
  const measured = rows.filter((row) => distanceOf(row) !== null && distanceOf(row) !== undefined);
  const routeBufferMeters = Number(measured[0]?.buffer_radius_m || 0);
  const corridorToleranceMeters = routeBufferMeters + config.offRouteMeters;
  const offRows = measured.filter((row) => Number(distanceOf(row) || 0) > corridorToleranceMeters);
  const nearBaseRows = measured.filter((row) => row.near_base);
  const shouldOpen = measured.length >= config.offRouteMinPoints &&
    offRows.length >= config.offRouteMinPoints &&
    nearBaseRows.length === 0;

  if (!shouldOpen) return resolve(rule, "Armada kembali ke koridor atau masuk pengecualian pool");

  const maxDistance = Math.max(...measured.map((row) => Number(distanceOf(row) || 0)));
  const severity = maxDistance >= 1000 ? "HIGH" : "MEDIUM";
  const latest = measured[0];
  return open({
    vehicle,
    rule,
    severity,
    window: { start: earliestTimestamp(measured), end: latestTimestamp(measured), minutes: config.offRouteGraceMinutes },
    pointCount: measured.length,
    location: locationFrom(latest),
    threshold: {
      off_route_meters: config.offRouteMeters,
      route_buffer_radius_meters: routeBufferMeters,
      total_corridor_tolerance_meters: corridorToleranceMeters,
      grace_minutes: config.offRouteGraceMinutes,
      min_points: config.offRouteMinPoints,
      base_radius_meters: config.baseRadiusMeters
    },
    metrics: {
      off_route_points: offRows.length,
      max_distance_meters: Math.round(maxDistance),
      distances_meters: measured.map((row) => Math.round(Number(distanceOf(row) || 0))),
      raw_distances_meters: measured.map((row) => Math.round(Number(row.raw_distance_m || 0))),
      matched_points: measured.filter((row) => row.match_status === "MATCHED").length,
      match_confidences: measured.map((row) => row.confidence === null || row.confidence === undefined ? null : Number(row.confidence)),
      road_segments: measured.map((row) => row.road_segment).filter(Boolean),
      distance_along_route_meters: measured.map((row) => row.distance_along_route_m === null || row.distance_along_route_m === undefined ? null : Math.round(Number(row.distance_along_route_m))),
      near_base_points: nearBaseRows.length
    }
  });
};

export const evaluateWrongDirectionDecision = ({ vehicle, rows, config }) => {
  const rule = "WRONG_DIRECTION";
  if (vehicle?.status !== "IN_SERVICE") return resolve(rule, "Kendaraan tidak dalam status IN_SERVICE");

  const measuredRows = rows.map((row) => ({
    ...row,
    heading_diff: headingDiffDegrees(row.heading, row.matched_heading)
  }));
  const wrongRows = measuredRows.filter((row) => Number(row.heading_diff || 0) >= config.wrongDirectionHeadingDiffDegrees);
  const shouldOpen = measuredRows.length >= config.wrongDirectionMinPoints && wrongRows.length >= config.wrongDirectionMinPoints;

  if (!shouldOpen) return resolve(rule, "Arah kendaraan kembali sesuai hasil map matching");

  const maxDiff = Math.max(...wrongRows.map((row) => Number(row.heading_diff || 0)));
  const severity = maxDiff >= 150 ? "HIGH" : "MEDIUM";
  const latest = wrongRows[0];
  return open({
    vehicle,
    rule,
    severity,
    window: { start: earliestTimestamp(measuredRows), end: latestTimestamp(measuredRows), minutes: config.wrongDirectionGraceMinutes },
    pointCount: measuredRows.length,
    location: {
      lat: Number(latest.snapped_lat || latest.lat),
      lon: Number(latest.snapped_lon || latest.lon)
    },
    threshold: {
      heading_diff_degrees: config.wrongDirectionHeadingDiffDegrees,
      grace_minutes: config.wrongDirectionGraceMinutes,
      min_speed_kmh: config.wrongDirectionMinSpeedKmh,
      min_points: config.wrongDirectionMinPoints,
      min_match_confidence: config.mapMatchingMinConfidence
    },
    metrics: {
      wrong_direction_points: wrongRows.length,
      max_heading_diff_degrees: Math.round(maxDiff),
      heading_diffs_degrees: measuredRows.map((row) => row.heading_diff === null ? null : Math.round(Number(row.heading_diff))),
      raw_headings: measuredRows.map((row) => row.heading === null ? null : Number(row.heading)),
      matched_headings: measuredRows.map((row) => row.matched_heading === null ? null : Number(row.matched_heading)),
      road_segments: measuredRows.map((row) => row.road_segment).filter(Boolean),
      distance_along_route_meters: measuredRows.map((row) => row.distance_along_route_m === null || row.distance_along_route_m === undefined ? null : Math.round(Number(row.distance_along_route_m)))
    }
  });
};

export const evaluateNgetemDecision = ({ vehicle, rows = null, nowMs = Date.now(), inOfficialStop = false, config }) => {
  const rule = "NGETEM";
  if (vehicle?.status !== "IN_SERVICE") return resolve(rule, "Kendaraan tidak dalam status IN_SERVICE");

  const lastPing = timestampMs(vehicle?.ts);
  const minutesSince = lastPing ? (nowMs - lastPing) / 60000 : Infinity;
  if (minutesSince > config.lostSignalMinutes || vehicle?.lat === null || vehicle?.lat === undefined || vehicle?.lon === null || vehicle?.lon === undefined) {
    return resolve(rule, "Telemetry tidak cukup untuk evaluasi ngetem");
  }

  if (inOfficialStop) return resolve(rule, "Berhenti di halte atau terminal resmi");
  if (rows === null) return null;

  const data = rows[0];
  const pointCount = Number(data?.points || 0);
  const maxDistance = Number(data?.max_dist_m || 0);
  const avgSpeed = Number(data?.avg_speed || 0);
  const durationMinutes = Number(config.ngetemMinutes || 0);
  const isNgetem = pointCount >= 2 && maxDistance <= config.ngetemMaxDistanceMeters && avgSpeed <= config.ngetemMaxAvgSpeed;
  if (!isNgetem) return resolve(rule, "Armada kembali bergerak atau berpindah lokasi");

  const severity = durationMinutes >= 20 ? "HIGH" : "MEDIUM";
  return open({
    vehicle,
    rule,
    severity,
    window: { start: data.started_at, end: data.ended_at, minutes: durationMinutes },
    pointCount,
    location: locationFrom(vehicle),
    threshold: {
      duration_minutes: config.ngetemMinutes,
      max_distance_meters: config.ngetemMaxDistanceMeters,
      max_avg_speed_kmh: config.ngetemMaxAvgSpeed,
      official_stop_radius_meters: config.officialStopRadiusMeters
    },
    metrics: {
      duration_minutes: config.ngetemMinutes,
      max_distance_meters: Math.round(maxDistance),
      avg_speed_kmh: Number(avgSpeed.toFixed(2)),
      max_speed_kmh: Number(data.max_speed || 0),
      in_official_stop: false
    }
  });
};
