import { groupRowsByVehicle } from "./rules-runtime.js";

export const fetchOverspeedRowsByVehicle = async ({
  query,
  vehicleIds,
  overspeedWindowPoints,
  lostSignalMinutes
}) => {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await query(
    `WITH ranked AS (
       SELECT
         vehicle_id,
         ts,
         lat,
         lon,
         speed_kmh,
         row_number() OVER (PARTITION BY vehicle_id ORDER BY ts DESC, position_id DESC) AS rn
       FROM vehicle_positions
       WHERE vehicle_id = ANY($1::uuid[])
         AND ts >= now() - ($3::text || ' minutes')::interval
     )
     SELECT vehicle_id, ts, lat, lon, speed_kmh
     FROM ranked
     WHERE rn <= $2
     ORDER BY vehicle_id, ts DESC`,
    [vehicleIds, overspeedWindowPoints, lostSignalMinutes]
  );
  return groupRowsByVehicle(rows);
};

export const fetchOffRouteRowsByVehicle = async ({
  query,
  vehicleIds,
  offRouteGraceMinutes,
  baseRadiusMeters,
  mapMatchingMinConfidence
}) => {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await query(
    `WITH target AS (
       SELECT
         v.vehicle_id,
         v.route_id,
         o.base_lat,
         o.base_lon
       FROM vehicles v
       LEFT JOIN owners o ON o.owner_id = v.owner_id
       WHERE v.vehicle_id = ANY($1::uuid[])
     ),
     route_geom AS (
       SELECT
         t.vehicle_id,
         r.buffer_radius_m,
         CASE
           WHEN r.inbound_geom IS NULL THEN r.outbound_geom
           WHEN r.outbound_geom IS NULL THEN r.inbound_geom
           ELSE ST_Union(r.outbound_geom, r.inbound_geom)
         END AS geom
       FROM target t
       JOIN routes r ON r.route_id = t.route_id
     ),
     recent AS (
       SELECT
         vp.vehicle_id,
         vp.ts,
         vp.lat,
         vp.lon,
         vp.speed_kmh,
         vp.geom,
         mp.match_status,
         mp.confidence,
         mp.snap_distance_m,
         mp.snapped_lat,
         mp.snapped_lon,
         mp.distance_along_route_m,
         mp.road_segment
       FROM vehicle_positions vp
       LEFT JOIN telemetry_matched_positions mp
         ON mp.vehicle_id = vp.vehicle_id
        AND mp.ts = vp.ts
        AND mp.position_id = vp.position_id
       WHERE vp.vehicle_id = ANY($1::uuid[])
         AND vp.ts >= now() - ($2::text || ' minutes')::interval
     )
     SELECT
       recent.vehicle_id,
       recent.ts,
       recent.lat,
       recent.lon,
       recent.speed_kmh,
       recent.match_status,
       recent.confidence,
       recent.snap_distance_m,
       recent.snapped_lat,
       recent.snapped_lon,
       recent.distance_along_route_m,
       recent.road_segment,
       route_geom.buffer_radius_m,
       CASE
         WHEN route_geom.geom IS NULL THEN NULL
         ELSE ST_Distance(recent.geom::geography, route_geom.geom::geography)
       END AS raw_distance_m,
       CASE
         WHEN recent.match_status = 'MATCHED'
          AND COALESCE(recent.confidence::double precision, 0) >= $4::double precision THEN 0
         WHEN recent.snap_distance_m IS NOT NULL THEN recent.snap_distance_m
         WHEN route_geom.geom IS NULL THEN NULL
         ELSE ST_Distance(recent.geom::geography, route_geom.geom::geography)
       END AS distance_m,
       CASE
         WHEN target.base_lat IS NULL OR target.base_lon IS NULL THEN false
         ELSE ST_DWithin(
           recent.geom::geography,
           ST_SetSRID(ST_MakePoint(target.base_lon, target.base_lat), 4326)::geography,
           $3
         )
       END AS near_base
     FROM recent
     JOIN target ON target.vehicle_id = recent.vehicle_id
     LEFT JOIN route_geom ON route_geom.vehicle_id = recent.vehicle_id
     ORDER BY recent.vehicle_id, recent.ts DESC`,
    [vehicleIds, offRouteGraceMinutes, baseRadiusMeters, mapMatchingMinConfidence]
  );
  return groupRowsByVehicle(rows);
};

export const fetchWrongDirectionRowsByVehicle = async ({
  query,
  vehicleIds,
  wrongDirectionGraceMinutes,
  mapMatchingMinConfidence,
  wrongDirectionMinSpeedKmh
}) => {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await query(
    `SELECT
        vp.vehicle_id,
        vp.ts,
        vp.lat,
        vp.lon,
        vp.speed_kmh,
        vp.heading,
        mp.match_status,
        mp.confidence,
        mp.snapped_lat,
        mp.snapped_lon,
        mp.matched_heading,
        mp.distance_along_route_m,
        mp.road_segment
     FROM vehicle_positions vp
     JOIN telemetry_matched_positions mp
       ON mp.vehicle_id = vp.vehicle_id
      AND mp.ts = vp.ts
      AND mp.position_id = vp.position_id
     WHERE vp.vehicle_id = ANY($1::uuid[])
       AND vp.ts >= now() - ($2::text || ' minutes')::interval
       AND mp.match_status = 'MATCHED'
       AND COALESCE(mp.confidence::double precision, 0) >= $3
       AND vp.heading IS NOT NULL
       AND mp.matched_heading IS NOT NULL
       AND COALESCE(vp.speed_kmh, 0) >= $4
     ORDER BY vp.vehicle_id, vp.ts DESC`,
    [vehicleIds, wrongDirectionGraceMinutes, mapMatchingMinConfidence, wrongDirectionMinSpeedKmh]
  );
  return groupRowsByVehicle(rows);
};

export const fetchNgetemOfficialStopByVehicle = async ({
  query,
  vehicleIds,
  officialStopRadiusMeters
}) => {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await query(
    `WITH target AS (
       SELECT vehicle_id, route_id, lon, lat
       FROM vehicle_latest
       JOIN vehicles USING (vehicle_id)
       WHERE vehicle_id = ANY($1::uuid[])
     )
     SELECT
       t.vehicle_id,
       EXISTS (
         SELECT 1
         FROM route_stops rs
         WHERE rs.route_id = t.route_id
           AND ST_DWithin(
             rs.geom::geography,
             ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::geography,
             $2
           )
         UNION
         SELECT 1
         FROM geofences gf
         WHERE gf.type IN ('TERMINAL', 'STOP', 'HALTE')
           AND (gf.route_id IS NULL OR gf.route_id = t.route_id)
           AND ST_DWithin(
             gf.geom::geography,
             ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::geography,
             0
           )
       ) AS in_official_stop
     FROM target t`,
    [vehicleIds, officialStopRadiusMeters]
  );
  return new Map(rows.map((row) => [String(row.vehicle_id), row.in_official_stop === true]));
};

export const fetchNgetemAggregateByVehicle = async ({
  query,
  vehicleIds,
  ngetemMinutes
}) => {
  if (vehicleIds.length === 0) return new Map();
  const { rows } = await query(
    `WITH target AS (
       SELECT vehicle_id, lon, lat
       FROM vehicle_latest
       WHERE vehicle_id = ANY($1::uuid[])
     )
     SELECT
       t.vehicle_id,
       COUNT(vp.position_id)::int AS points,
       MIN(vp.ts) AS started_at,
       MAX(vp.ts) AS ended_at,
       MAX(ST_Distance(vp.geom::geography, ST_SetSRID(ST_MakePoint(t.lon, t.lat), 4326)::geography)) AS max_dist_m,
       AVG(vp.speed_kmh) AS avg_speed,
       MAX(vp.speed_kmh) AS max_speed
     FROM target t
     LEFT JOIN vehicle_positions vp
       ON vp.vehicle_id = t.vehicle_id
      AND vp.ts >= now() - ($2::text || ' minutes')::interval
     GROUP BY t.vehicle_id`,
    [vehicleIds, ngetemMinutes]
  );
  return new Map(rows.map((row) => [String(row.vehicle_id), row]));
};
