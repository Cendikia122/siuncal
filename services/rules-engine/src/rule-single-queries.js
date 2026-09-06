export const fetchOverspeedRows = async ({
  query,
  vehicleId,
  overspeedWindowPoints,
  lostSignalMinutes
}) => {
  const { rows } = await query(
    `SELECT ts, lat, lon, speed_kmh
     FROM vehicle_positions
     WHERE vehicle_id = $1
       AND ts >= now() - ($3::text || ' minutes')::interval
     ORDER BY ts DESC
     LIMIT $2`,
    [vehicleId, overspeedWindowPoints, lostSignalMinutes]
  );
  return rows;
};

export const fetchOffRouteRows = async ({
  query,
  vehicle,
  offRouteGraceMinutes,
  baseRadiusMeters,
  mapMatchingMinConfidence
}) => {
  const { rows } = await query(
    `WITH route_geom AS (
       SELECT
         route_id,
         buffer_radius_m,
         CASE
           WHEN inbound_geom IS NULL THEN outbound_geom
           WHEN outbound_geom IS NULL THEN inbound_geom
           ELSE ST_Union(outbound_geom, inbound_geom)
         END AS geom
       FROM routes
       WHERE route_id = $2
     ),
     recent AS (
       SELECT
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
       WHERE vp.vehicle_id = $1
         AND vp.ts >= now() - ($3::text || ' minutes')::interval
       ORDER BY vp.ts DESC
     )
     SELECT
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
          AND COALESCE(recent.confidence::double precision, 0) >= $7::double precision THEN 0
         WHEN recent.snap_distance_m IS NOT NULL THEN recent.snap_distance_m
         WHEN route_geom.geom IS NULL THEN NULL
         ELSE ST_Distance(recent.geom::geography, route_geom.geom::geography)
       END AS distance_m,
       CASE
         WHEN $4::double precision IS NULL OR $5::double precision IS NULL THEN false
         ELSE ST_DWithin(
           recent.geom::geography,
           ST_SetSRID(ST_MakePoint($5, $4), 4326)::geography,
           $6
         )
       END AS near_base
     FROM recent
     LEFT JOIN route_geom ON true`,
    [
      vehicle.vehicle_id,
      vehicle.route_id,
      offRouteGraceMinutes,
      vehicle.base_lat,
      vehicle.base_lon,
      baseRadiusMeters,
      mapMatchingMinConfidence
    ]
  );
  return rows;
};

export const fetchWrongDirectionRows = async ({
  query,
  vehicleId,
  wrongDirectionGraceMinutes,
  mapMatchingMinConfidence,
  wrongDirectionMinSpeedKmh
}) => {
  const { rows } = await query(
    `SELECT
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
     WHERE vp.vehicle_id = $1
       AND vp.ts >= now() - ($2::text || ' minutes')::interval
       AND mp.match_status = 'MATCHED'
       AND COALESCE(mp.confidence::double precision, 0) >= $3
       AND vp.heading IS NOT NULL
       AND mp.matched_heading IS NOT NULL
       AND COALESCE(vp.speed_kmh, 0) >= $4
     ORDER BY vp.ts DESC`,
    [vehicleId, wrongDirectionGraceMinutes, mapMatchingMinConfidence, wrongDirectionMinSpeedKmh]
  );
  return rows;
};

export const fetchNgetemOfficialStop = async ({
  query,
  vehicle,
  officialStopRadiusMeters
}) => {
  const result = await query(
    `SELECT EXISTS (
       SELECT 1
       FROM route_stops rs
       WHERE rs.route_id = $1
         AND ST_DWithin(
           rs.geom::geography,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           $4
         )
       UNION
       SELECT 1
       FROM geofences gf
       WHERE gf.type IN ('TERMINAL', 'STOP', 'HALTE')
         AND (gf.route_id IS NULL OR gf.route_id = $1)
         AND ST_DWithin(
           gf.geom::geography,
           ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography,
           0
         )
     ) AS in_official_stop`,
    [vehicle.route_id, vehicle.lon, vehicle.lat, officialStopRadiusMeters]
  );
  return result.rows[0]?.in_official_stop === true;
};

export const fetchNgetemAggregateRows = async ({
  query,
  vehicle,
  ngetemMinutes
}) => {
  const { rows } = await query(
    `SELECT
        COUNT(*)::int AS points,
        MIN(ts) AS started_at,
        MAX(ts) AS ended_at,
        MAX(ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography)) AS max_dist_m,
        AVG(speed_kmh) AS avg_speed,
        MAX(speed_kmh) AS max_speed
     FROM vehicle_positions
     WHERE vehicle_id = $1
       AND ts >= now() - ($4::text || ' minutes')::interval`,
    [vehicle.vehicle_id, vehicle.lon, vehicle.lat, ngetemMinutes]
  );
  return rows;
};
