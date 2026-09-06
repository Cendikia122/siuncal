CREATE TABLE IF NOT EXISTS telemetry_matched_positions (
  match_id bigserial PRIMARY KEY,
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  position_id bigint NOT NULL,
  ts timestamptz NOT NULL,
  route_id text REFERENCES routes(route_id),
  direction text CHECK (direction IN ('outbound', 'inbound', 'unknown')),
  provider text NOT NULL DEFAULT 'local_postgis',
  match_status text NOT NULL DEFAULT 'MATCHED' CHECK (match_status IN ('MATCHED', 'LOW_CONFIDENCE', 'NO_ROUTE')),
  road_segment text,
  confidence numeric(5, 4),
  snapped_lat double precision,
  snapped_lon double precision,
  snap_distance_m numeric(10, 2),
  distance_along_route_m numeric(12, 2),
  route_fraction numeric(10, 8),
  route_length_m numeric(12, 2),
  matched_heading numeric(6, 2),
  raw_lat double precision NOT NULL,
  raw_lon double precision NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vehicle_id, ts, position_id)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_matched_positions_vehicle_ts
  ON telemetry_matched_positions (vehicle_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_matched_positions_route_ts
  ON telemetry_matched_positions (route_id, ts DESC);

CREATE INDEX IF NOT EXISTS idx_telemetry_matched_positions_status
  ON telemetry_matched_positions (match_status, confidence);
