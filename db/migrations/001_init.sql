CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  full_name text NOT NULL,
  password_hash text NOT NULL,
  roles text[] NOT NULL DEFAULT ARRAY['OPERATOR'],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS owners (
  owner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL,
  name text NOT NULL,
  phone_primary text,
  email text,
  base_name text,
  base_lat double precision,
  base_lon double precision,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routes (
  route_id text PRIMARY KEY,
  name text NOT NULL,
  color text,
  buffer_radius_m integer NOT NULL DEFAULT 15,
  outbound_geom geometry(LineString, 4326),
  inbound_geom geometry(LineString, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS route_stops (
  stop_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id text NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  name text NOT NULL,
  seq integer NOT NULL,
  geom geometry(Point, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicles (
  vehicle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid REFERENCES owners(owner_id),
  plate_no text NOT NULL,
  route_id text NOT NULL REFERENCES routes(route_id),
  vehicle_code text,
  status text NOT NULL DEFAULT 'OUT_OF_SERVICE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS incidents (
  incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(vehicle_id),
  type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'OPEN',
  description text,
  location_desc text,
  lat double precision,
  lon double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS vehicle_positions (
  position_id bigserial NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  speed_kmh numeric(6, 2),
  heading numeric(6, 2),
  status text,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  ) STORED,
  PRIMARY KEY (vehicle_id, ts, position_id)
);

SELECT create_hypertable('vehicle_positions', 'ts', if_not_exists => true);

CREATE INDEX IF NOT EXISTS idx_vehicle_positions_vehicle_ts ON vehicle_positions (vehicle_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_geom ON vehicle_positions USING GIST (geom);

CREATE OR REPLACE VIEW vehicle_latest AS
SELECT DISTINCT ON (vehicle_id)
  vehicle_id,
  ts,
  lat,
  lon,
  speed_kmh,
  heading,
  status
FROM vehicle_positions
ORDER BY vehicle_id, ts DESC;

CREATE TABLE IF NOT EXISTS report_kpi_daily (
  report_date date NOT NULL,
  route_id text NOT NULL REFERENCES routes(route_id) ON DELETE CASCADE,
  on_route_pct numeric(5, 2) NOT NULL,
  avg_latency_sec integer NOT NULL,
  incident_count integer NOT NULL,
  avg_speed_kmh numeric(6, 2) NOT NULL,
  avg_rit numeric(6, 2) NOT NULL,
  avg_idle_sec integer NOT NULL,
  PRIMARY KEY (report_date, route_id)
);

CREATE TABLE IF NOT EXISTS report_rit_daily (
  report_date date NOT NULL,
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  total_rit integer NOT NULL,
  PRIMARY KEY (report_date, vehicle_id)
);
