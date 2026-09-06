-- Phase 16: Heatmap Operasional Real

CREATE TABLE IF NOT EXISTS heatmap_data (
  heatmap_id bigserial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('STOP_DENSITY','NGETEM_ZONE','OFF_ROUTE_ZONE','SPEED_ZONE')),
  grid_lat double precision NOT NULL,
  grid_lon double precision NOT NULL,
  route_id text REFERENCES routes(route_id) ON DELETE SET NULL,
  time_window tstzrange NOT NULL,
  metric text NOT NULL,
  value double precision NOT NULL DEFAULT 0,
  vehicle_count integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_heatmap_type_time ON heatmap_data (type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_heatmap_grid ON heatmap_data USING GIST (
  ST_SetSRID(ST_MakePoint(grid_lon, grid_lat), 4326)
);
CREATE INDEX IF NOT EXISTS idx_heatmap_time_window ON heatmap_data USING GIST (time_window);
CREATE INDEX IF NOT EXISTS idx_heatmap_route ON heatmap_data (route_id, type);
