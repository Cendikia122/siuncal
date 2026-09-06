export const createRealtimeQueries = ({
  query,
  parseBoundedInt,
  realtimeVehiclesLimit
}) => {
  const fetchLatestVehicles = async ({
    routeId = null,
    vehicleStatus = null,
    bbox = null,
    limit = realtimeVehiclesLimit
  } = {}) => {
    const filters = [];
    const params = [];
    if (routeId) {
      params.push(routeId);
      filters.push(`v.route_id = $${params.length}`);
    }
    if (vehicleStatus) {
      params.push(vehicleStatus);
      filters.push(`COALESCE(vl.status, v.status) = $${params.length}`);
    }
    if (bbox) {
      params.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);
      const minLonParam = params.length - 3;
      filters.push(`ST_SetSRID(ST_MakePoint(COALESCE(mp.snapped_lon, vl.lon), COALESCE(mp.snapped_lat, vl.lat)), 4326) && ST_MakeEnvelope($${minLonParam}, $${minLonParam + 1}, $${minLonParam + 2}, $${minLonParam + 3}, 4326)`);
    }
    params.push(parseBoundedInt(limit, realtimeVehiclesLimit, { max: 5000 }));
    const whereClause = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

    const { rows } = await query(
      `SELECT
          v.vehicle_id,
          v.plate_no,
          v.route_id,
          v.status,
          rs.current_score AS risk_score,
          rs.risk_level,
          (
            SELECT a.rule
            FROM alerts a
            WHERE a.vehicle_id = v.vehicle_id
              AND a.status IN ('OPEN', 'ESCALATED')
            ORDER BY a.last_seen_at DESC
            LIMIT 1
          ) AS alert_status,
          COALESCE(mp.snapped_lat, vl.lat) AS lat,
          COALESCE(mp.snapped_lon, vl.lon) AS lon,
          vl.speed_kmh AS speed,
          COALESCE(mp.matched_heading, vl.heading)::float AS heading,
          mp.match_status,
          mp.confidence::float AS match_confidence,
          mp.snap_distance_m::float AS snap_distance_m,
          vl.ts AS last_ping
       FROM vehicles v
       LEFT JOIN vehicle_latest vl ON vl.vehicle_id = v.vehicle_id
       LEFT JOIN telemetry_matched_positions mp
         ON mp.vehicle_id = vl.vehicle_id
        AND mp.ts = vl.ts
        AND mp.match_status = 'MATCHED'
       LEFT JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
       ${whereClause}
       ORDER BY v.plate_no
       LIMIT $${params.length}`,
      params
    );
    return rows;
  };

  const fetchOpenIncidents = async () => {
    const { rows } = await query(
      `SELECT
          i.incident_id,
          i.type,
          i.severity,
          i.status,
          i.description,
          i.location_desc,
          i.created_at,
          v.plate_no,
          v.route_id
       FROM incidents i
       LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
       WHERE i.status IN ('OPEN', 'IN_PROGRESS')
       ORDER BY i.created_at DESC
       LIMIT 10`
    );
    return rows.map((row) => ({
      id: row.incident_id,
      type: row.type,
      severity: row.severity,
      status: row.status,
      description: row.description,
      location: row.location_desc,
      timestamp: row.created_at,
      vehicle_plate: row.plate_no,
      route_id: row.route_id
    }));
  };

  return {
    fetchLatestVehicles,
    fetchOpenIncidents
  };
};
