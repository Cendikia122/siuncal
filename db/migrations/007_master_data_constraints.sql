DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vehicles_plate_no_key'
  ) THEN
    ALTER TABLE vehicles
      ADD CONSTRAINT vehicles_plate_no_key UNIQUE (plate_no);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active_vehicle
  ON assignments (vehicle_id)
  WHERE is_active = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_assignments_active_device
  ON assignments (device_id)
  WHERE is_active = true AND device_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_route_stops_route_seq
  ON route_stops (route_id, seq);

CREATE INDEX IF NOT EXISTS idx_routes_outbound_geom
  ON routes USING GIST (outbound_geom);

CREATE INDEX IF NOT EXISTS idx_routes_inbound_geom
  ON routes USING GIST (inbound_geom);
