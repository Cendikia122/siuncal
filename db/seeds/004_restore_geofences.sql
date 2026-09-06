-- Restore operational geofences deleted by 003_osrm_snap_to_road.sql.
-- Keep ROUTE_CORRIDOR from 003, then restore TERMINAL/HALTE/STOP for NGETEM
-- exceptions and BASE for demo/operator context. This file is idempotent so it
-- can also repair reused Docker volumes.

BEGIN;

INSERT INTO geofences (name, type, route_id, geom)
SELECT name, type, NULL::text AS route_id,
       ST_Buffer(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius_m)::geometry AS geom
FROM (VALUES
  -- Terminals (radius 150 m)
  ('Terminal Merdeka',        'TERMINAL', 106.787778,  -6.589167, 150),
  ('Terminal Baranangsiang',  'TERMINAL', 106.806157,  -6.604274, 150),
  ('Terminal Bubulak',        'TERMINAL', 106.754339,  -6.569672, 150),
  -- Key station stop shared across routes (radius 100 m)
  ('Halte Stasiun Bogor / Kapten Muslihat', 'HALTE', 106.790822, -6.594078, 100)
) AS t(name, type, lon, lat, radius_m)
WHERE NOT EXISTS (
  SELECT 1
  FROM geofences gf
  WHERE gf.name = t.name
    AND gf.type = t.type
);

INSERT INTO geofences (name, type, route_id, geom)
SELECT name, type, NULL::text AS route_id,
       ST_Buffer(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius_m)::geometry AS geom
FROM (VALUES
  ('Pool Cipaku',        'BASE', 106.815472, -6.635827, 100),
  ('Pool Sukasari',      'BASE', 106.801546, -6.607318, 100),
  ('Pool Baranangsiang', 'BASE', 106.806157, -6.604274, 100)
) AS t(name, type, lon, lat, radius_m)
WHERE NOT EXISTS (
  SELECT 1
  FROM geofences gf
  WHERE gf.name = t.name
    AND gf.type = t.type
);

INSERT INTO geofences (name, type, route_id, geom)
SELECT
  concat('Stop resmi ', rs.route_id, ' #', rs.seq, ' - ', rs.name) AS name,
  'STOP' AS type,
  rs.route_id,
  ST_Buffer(rs.geom::geography, 75)::geometry AS geom
FROM route_stops rs
WHERE rs.geom IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM geofences gf
    WHERE gf.type = 'STOP'
      AND gf.route_id = rs.route_id
      AND gf.name = concat('Stop resmi ', rs.route_id, ' #', rs.seq, ' - ', rs.name)
  );

COMMIT;
