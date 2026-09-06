CREATE TABLE IF NOT EXISTS passenger_tracking_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id uuid NOT NULL DEFAULT gen_random_uuid(),
  token_hash text NOT NULL,
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_used_at timestamptz,
  user_agent text,
  CONSTRAINT passenger_tracking_tokens_hash_not_blank CHECK (btrim(token_hash) <> '')
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_passenger_tracking_tokens_hash
  ON passenger_tracking_tokens (token_hash);
CREATE INDEX IF NOT EXISTS idx_passenger_tracking_tokens_user_active
  ON passenger_tracking_tokens (user_id, revoked_at, expires_at DESC);

CREATE TABLE IF NOT EXISTS passenger_positions (
  position_id bigserial NOT NULL,
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  token_id uuid REFERENCES passenger_tracking_tokens(token_id) ON DELETE SET NULL,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  accuracy numeric(8, 2),
  battery_level numeric(5, 2),
  app_state text,
  geom geometry(Point, 4326) GENERATED ALWAYS AS (
    ST_SetSRID(ST_MakePoint(lon, lat), 4326)
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, ts, position_id),
  CONSTRAINT passenger_positions_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT passenger_positions_lon_range CHECK (lon BETWEEN -180 AND 180)
);

SELECT create_hypertable('passenger_positions', 'ts', if_not_exists => true);

CREATE INDEX IF NOT EXISTS idx_passenger_positions_user_ts
  ON passenger_positions (user_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_positions_session_ts
  ON passenger_positions (session_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_positions_geom
  ON passenger_positions USING GIST (geom);

CREATE OR REPLACE VIEW passenger_latest AS
SELECT DISTINCT ON (user_id)
  user_id,
  session_id,
  token_id,
  ts,
  lat,
  lon,
  accuracy,
  app_state
FROM passenger_positions
ORDER BY user_id, ts DESC;
