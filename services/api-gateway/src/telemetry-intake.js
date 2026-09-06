import { query as defaultQuery } from "./db.js";
import { recordRollingMetricEvent as defaultRecordRollingMetricEvent } from "./redis.js";
import { normalizeVehicleTelemetry } from "./telemetry-contract.js";
import { resolveVehicleIdFromTelemetryIdentity } from "./telemetry-identity.js";
import {
  DEVICE_TAMPER_METRIC_WINDOW_MS,
  TELEMETRY_QUALITY_METRICS,
  TELEMETRY_QUALITY_METRIC_WINDOW_MS,
  telemetryIdentityMetricKey
} from "./telemetry-quality-metrics.js";

const mapMatchingProvider = process.env.MAP_MATCHING_PROVIDER || "local_postgis";
const mapMatchingMaxSnapDistanceMeters = Number(process.env.MAP_MATCHING_MAX_SNAP_DISTANCE_METERS || 80);
const mapMatchingMinConfidence = Number(process.env.MAP_MATCHING_MIN_CONFIDENCE || 0.35);

export const persistMatchedTelemetryPosition = async ({
  vehicleId,
  positionId,
  timestamp,
  latitude,
  longitude,
  query = defaultQuery
}) => {
  if (mapMatchingProvider !== "local_postgis") {
    return null;
  }

  const { rows } = await query(
    `WITH vehicle_route AS (
       SELECT v.vehicle_id, v.route_id
       FROM vehicles v
       WHERE v.vehicle_id = $1
     ),
     input AS (
       SELECT ST_SetSRID(ST_MakePoint($5, $4), 4326) AS point
     ),
     route_lines AS (
       SELECT
         vr.vehicle_id,
         r.route_id,
         r.buffer_radius_m,
         candidate.direction,
         candidate.geom AS line_geom
       FROM vehicle_route vr
       JOIN routes r ON r.route_id = vr.route_id
       CROSS JOIN LATERAL (
         VALUES
           ('outbound'::text, r.outbound_geom),
           ('inbound'::text, r.inbound_geom)
       ) AS candidate(direction, geom)
       WHERE candidate.geom IS NOT NULL
     ),
     located AS (
       SELECT
         route_lines.*,
         input.point,
         ST_LineLocatePoint(route_lines.line_geom, input.point) AS route_fraction
       FROM route_lines
       CROSS JOIN input
     ),
     snapped AS (
       SELECT
         *,
         ST_LineInterpolatePoint(line_geom, route_fraction) AS snapped_point,
         ST_LineInterpolatePoint(line_geom, GREATEST(0, route_fraction - 0.0001)) AS before_point,
         ST_LineInterpolatePoint(line_geom, LEAST(1, route_fraction + 0.0001)) AS after_point
       FROM located
     ),
     ranked AS (
       SELECT
         *,
         ST_Distance(point::geography, snapped_point::geography)::float AS snap_distance_m,
         ST_Length(ST_LineSubstring(line_geom, 0, route_fraction)::geography)::float AS distance_along_route_m,
         ST_Length(line_geom::geography)::float AS route_length_m,
         degrees(ST_Azimuth(before_point, after_point))::float AS matched_heading,
         ROW_NUMBER() OVER (ORDER BY ST_Distance(point::geography, snapped_point::geography), direction) AS rank
       FROM snapped
     )
     INSERT INTO telemetry_matched_positions (
       vehicle_id,
       position_id,
       ts,
       route_id,
       direction,
       provider,
       match_status,
       road_segment,
       confidence,
       snapped_lat,
       snapped_lon,
       snap_distance_m,
       distance_along_route_m,
       route_fraction,
       route_length_m,
       matched_heading,
       raw_lat,
       raw_lon,
       metadata
     )
     SELECT
       vehicle_id,
       $2,
       $3,
       route_id,
       direction,
       $6,
       CASE
         WHEN snap_distance_m <= $7::double precision
          AND GREATEST(0, LEAST(1, 1 - (snap_distance_m / NULLIF($7::double precision, 0)))) >= $8::double precision
           THEN 'MATCHED'
         ELSE 'LOW_CONFIDENCE'
       END,
       route_id || ':' || direction || ':' || floor(route_fraction * 1000)::int,
       ROUND(GREATEST(0, LEAST(1, 1 - (snap_distance_m / NULLIF($7::double precision, 0))))::numeric, 4),
       ST_Y(snapped_point),
       ST_X(snapped_point),
       ROUND(snap_distance_m::numeric, 2),
       ROUND(distance_along_route_m::numeric, 2),
       ROUND(route_fraction::numeric, 8),
       ROUND(route_length_m::numeric, 2),
       ROUND(matched_heading::numeric, 2),
       $4,
       $5,
       jsonb_build_object(
         'algorithm', 'st_line_locate_point',
         'max_snap_distance_m', $7::double precision,
         'min_confidence', $8::double precision,
         'buffer_radius_m', buffer_radius_m
       )
     FROM ranked
     WHERE rank = 1
     ON CONFLICT (vehicle_id, ts, position_id) DO UPDATE
       SET route_id = EXCLUDED.route_id,
           direction = EXCLUDED.direction,
           provider = EXCLUDED.provider,
           match_status = EXCLUDED.match_status,
           road_segment = EXCLUDED.road_segment,
           confidence = EXCLUDED.confidence,
           snapped_lat = EXCLUDED.snapped_lat,
           snapped_lon = EXCLUDED.snapped_lon,
           snap_distance_m = EXCLUDED.snap_distance_m,
           distance_along_route_m = EXCLUDED.distance_along_route_m,
           route_fraction = EXCLUDED.route_fraction,
           route_length_m = EXCLUDED.route_length_m,
           matched_heading = EXCLUDED.matched_heading,
           raw_lat = EXCLUDED.raw_lat,
           raw_lon = EXCLUDED.raw_lon,
           metadata = EXCLUDED.metadata
     RETURNING match_id, match_status, confidence::float, snap_distance_m::float, distance_along_route_m::float`,
    [
      vehicleId,
      positionId,
      timestamp,
      latitude,
      longitude,
      mapMatchingProvider,
      mapMatchingMaxSnapDistanceMeters,
      mapMatchingMinConfidence
    ]
  );

  return rows[0] || null;
};

export const ingestVehicleTelemetry = async (
  body,
  {
    query = defaultQuery,
    recordRollingMetricEvent = defaultRecordRollingMetricEvent
  } = {}
) => {
  const normalized = normalizeVehicleTelemetry(body);
  if (!normalized.ok) {
    return { ok: false, status: 400, error: normalized.error };
  }

  const telemetry = normalized.value;
  const resolvedVehicleId = await resolveVehicleIdFromTelemetryIdentity(telemetry, query);

  if (!resolvedVehicleId) {
    const identityMetricKey = telemetryIdentityMetricKey(telemetry.imei_or_serial || telemetry.deviceId);
    const metricWrites = [
      recordRollingMetricEvent(TELEMETRY_QUALITY_METRICS.invalidDeviceIdentity, {
        windowMs: TELEMETRY_QUALITY_METRIC_WINDOW_MS
      })
    ];
    if (identityMetricKey) {
      metricWrites.push(recordRollingMetricEvent(identityMetricKey, {
        windowMs: DEVICE_TAMPER_METRIC_WINDOW_MS
      }));
    }
    await Promise.all(metricWrites);
    return {
      ok: false,
      status: 404,
      error: { code: "NOT_FOUND", message: "Vehicle not found" }
    };
  }

  const duplicatePosition = await query(
    `SELECT position_id
     FROM vehicle_positions
     WHERE vehicle_id = $1
       AND ts = $2
       AND lat = $3
       AND lon = $4
     ORDER BY position_id DESC
     LIMIT 1`,
    [
      resolvedVehicleId,
      telemetry.timestamp,
      telemetry.latitude,
      telemetry.longitude
    ]
  );

  if (duplicatePosition.rows.length) {
    await recordRollingMetricEvent(TELEMETRY_QUALITY_METRICS.duplicatePayload, {
      windowMs: TELEMETRY_QUALITY_METRIC_WINDOW_MS
    });
    return {
      ok: true,
      duplicate: true,
      position_id: duplicatePosition.rows[0].position_id,
      matched_position: null
    };
  }

  const positionResult = await query(
    `INSERT INTO vehicle_positions (
       vehicle_id,
       ts,
       lat,
       lon,
       speed_kmh,
       heading,
       status,
       battery_level,
       signal_dbm,
       power_connected
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
     RETURNING position_id`,
    [
      resolvedVehicleId,
      telemetry.timestamp,
      telemetry.latitude,
      telemetry.longitude,
      telemetry.speedKmh,
      telemetry.heading,
      telemetry.status,
      telemetry.batteryLevel,
      telemetry.signalDbm,
      telemetry.powerConnected
    ]
  );
  const positionId = positionResult.rows[0]?.position_id;

  const matchedPosition = positionId
    ? await persistMatchedTelemetryPosition({
      vehicleId: resolvedVehicleId,
      positionId,
      timestamp: telemetry.timestamp,
      latitude: telemetry.latitude,
      longitude: telemetry.longitude,
      query
    })
    : null;

  if (telemetry.status) {
    await query("UPDATE vehicles SET status = $1 WHERE vehicle_id = $2", [telemetry.status, resolvedVehicleId]);
  }

  return { ok: true, position_id: positionId, matched_position: matchedPosition };
};
