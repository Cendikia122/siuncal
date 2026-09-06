-- Phase 1 scale hardening: maintain latest/current positions outside raw hypertables.
-- Hot paths keep reading vehicle_latest/passenger_latest, but those views now read
-- from compact current-state tables instead of DISTINCT ON over full history.

CREATE TABLE IF NOT EXISTS vehicle_current_positions (
  vehicle_id uuid PRIMARY KEY REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  position_id bigint NOT NULL,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  speed_kmh numeric(6, 2),
  heading numeric(6, 2),
  status text,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_current_positions_ts
  ON vehicle_current_positions (ts DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_current_positions_geom
  ON vehicle_current_positions USING GIST (geom);
CREATE INDEX IF NOT EXISTS idx_vehicle_current_positions_route_status
  ON vehicles (route_id, status, plate_no);

INSERT INTO vehicle_current_positions (
  vehicle_id,
  position_id,
  ts,
  lat,
  lon,
  speed_kmh,
  heading,
  status,
  updated_at
)
SELECT DISTINCT ON (vehicle_id)
  vehicle_id,
  position_id,
  ts,
  lat,
  lon,
  speed_kmh,
  heading,
  status,
  now()
FROM vehicle_positions
ORDER BY vehicle_id, ts DESC, position_id DESC
ON CONFLICT (vehicle_id) DO UPDATE
SET position_id = EXCLUDED.position_id,
    ts = EXCLUDED.ts,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    speed_kmh = EXCLUDED.speed_kmh,
    heading = EXCLUDED.heading,
    status = EXCLUDED.status,
    updated_at = now()
WHERE vehicle_current_positions.ts < EXCLUDED.ts
   OR (vehicle_current_positions.ts = EXCLUDED.ts
       AND vehicle_current_positions.position_id < EXCLUDED.position_id);

CREATE OR REPLACE FUNCTION upsert_vehicle_current_position()
RETURNS trigger AS $$
BEGIN
  INSERT INTO vehicle_current_positions (
    vehicle_id,
    position_id,
    ts,
    lat,
    lon,
    speed_kmh,
    heading,
    status,
    updated_at
  )
  VALUES (
    NEW.vehicle_id,
    NEW.position_id,
    NEW.ts,
    NEW.lat,
    NEW.lon,
    NEW.speed_kmh,
    NEW.heading,
    NEW.status,
    now()
  )
  ON CONFLICT (vehicle_id) DO UPDATE
  SET position_id = EXCLUDED.position_id,
      ts = EXCLUDED.ts,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      speed_kmh = EXCLUDED.speed_kmh,
      heading = EXCLUDED.heading,
      status = EXCLUDED.status,
      updated_at = now()
  WHERE vehicle_current_positions.ts < EXCLUDED.ts
     OR (vehicle_current_positions.ts = EXCLUDED.ts
         AND vehicle_current_positions.position_id < EXCLUDED.position_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vehicle_current_positions_upsert ON vehicle_positions;
CREATE TRIGGER trg_vehicle_current_positions_upsert
AFTER INSERT ON vehicle_positions
FOR EACH ROW
EXECUTE FUNCTION upsert_vehicle_current_position();

CREATE OR REPLACE VIEW vehicle_latest AS
SELECT
  vehicle_id,
  ts,
  lat,
  lon,
  speed_kmh,
  heading,
  status,
  geom
FROM vehicle_current_positions;

CREATE TABLE IF NOT EXISTS passenger_current_positions (
  user_id uuid PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  token_id uuid REFERENCES passenger_tracking_tokens(token_id) ON DELETE SET NULL,
  position_id bigint NOT NULL,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  accuracy numeric(8, 2),
  battery_level numeric(5, 2),
  app_state text,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  ) STORED,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_passenger_current_positions_ts
  ON passenger_current_positions (ts DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_current_positions_session_ts
  ON passenger_current_positions (session_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_current_positions_geom
  ON passenger_current_positions USING GIST (geom);

INSERT INTO passenger_current_positions (
  user_id,
  session_id,
  token_id,
  position_id,
  ts,
  lat,
  lon,
  accuracy,
  battery_level,
  app_state,
  updated_at
)
SELECT DISTINCT ON (user_id)
  user_id,
  session_id,
  token_id,
  position_id,
  ts,
  lat,
  lon,
  accuracy,
  battery_level,
  app_state,
  now()
FROM passenger_positions
ORDER BY user_id, ts DESC, position_id DESC
ON CONFLICT (user_id) DO UPDATE
SET session_id = EXCLUDED.session_id,
    token_id = EXCLUDED.token_id,
    position_id = EXCLUDED.position_id,
    ts = EXCLUDED.ts,
    lat = EXCLUDED.lat,
    lon = EXCLUDED.lon,
    accuracy = EXCLUDED.accuracy,
    battery_level = EXCLUDED.battery_level,
    app_state = EXCLUDED.app_state,
    updated_at = now()
WHERE passenger_current_positions.ts < EXCLUDED.ts
   OR (passenger_current_positions.ts = EXCLUDED.ts
       AND passenger_current_positions.position_id < EXCLUDED.position_id);

CREATE OR REPLACE FUNCTION upsert_passenger_current_position()
RETURNS trigger AS $$
BEGIN
  INSERT INTO passenger_current_positions (
    user_id,
    session_id,
    token_id,
    position_id,
    ts,
    lat,
    lon,
    accuracy,
    battery_level,
    app_state,
    updated_at
  )
  VALUES (
    NEW.user_id,
    NEW.session_id,
    NEW.token_id,
    NEW.position_id,
    NEW.ts,
    NEW.lat,
    NEW.lon,
    NEW.accuracy,
    NEW.battery_level,
    NEW.app_state,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE
  SET session_id = EXCLUDED.session_id,
      token_id = EXCLUDED.token_id,
      position_id = EXCLUDED.position_id,
      ts = EXCLUDED.ts,
      lat = EXCLUDED.lat,
      lon = EXCLUDED.lon,
      accuracy = EXCLUDED.accuracy,
      battery_level = EXCLUDED.battery_level,
      app_state = EXCLUDED.app_state,
      updated_at = now()
  WHERE passenger_current_positions.ts < EXCLUDED.ts
     OR (passenger_current_positions.ts = EXCLUDED.ts
         AND passenger_current_positions.position_id < EXCLUDED.position_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_passenger_current_positions_upsert ON passenger_positions;
CREATE TRIGGER trg_passenger_current_positions_upsert
AFTER INSERT ON passenger_positions
FOR EACH ROW
EXECUTE FUNCTION upsert_passenger_current_position();

CREATE OR REPLACE VIEW passenger_latest AS
SELECT
  user_id,
  session_id,
  token_id,
  ts,
  lat,
  lon,
  accuracy,
  app_state,
  geom
FROM passenger_current_positions;
