-- Phase 2 database performance: TimescaleDB policies and reusable aggregate.
-- Retention policy is intentionally explicit because it can delete old raw data:
-- vehicle_positions: 90 days; passenger_positions: 30 days (privacy-oriented).

ALTER TABLE vehicle_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vehicle_id',
  timescaledb.compress_orderby = 'ts DESC, position_id DESC'
);

ALTER TABLE passenger_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'user_id, token_id',
  timescaledb.compress_orderby = 'ts DESC, position_id DESC'
);

DO $$
BEGIN
  PERFORM add_compression_policy('vehicle_positions', INTERVAL '7 days');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%already exists%' THEN RAISE; END IF;
END $$;

DO $$
BEGIN
  PERFORM add_compression_policy('passenger_positions', INTERVAL '7 days');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%already exists%' THEN RAISE; END IF;
END $$;

DO $$
BEGIN
  PERFORM add_retention_policy('vehicle_positions', INTERVAL '90 days');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%already exists%' THEN RAISE; END IF;
END $$;

DO $$
BEGIN
  PERFORM add_retention_policy('passenger_positions', INTERVAL '30 days');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%already exists%' THEN RAISE; END IF;
END $$;

CREATE MATERIALIZED VIEW IF NOT EXISTS vehicle_positions_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', ts) AS bucket,
  vehicle_id,
  count(*) AS ping_count,
  avg(speed_kmh) AS avg_speed_kmh,
  min(ts) AS first_seen_at,
  max(ts) AS last_seen_at
FROM vehicle_positions
GROUP BY bucket, vehicle_id
WITH NO DATA;

CREATE INDEX IF NOT EXISTS idx_vehicle_positions_hourly_vehicle_bucket
  ON vehicle_positions_hourly (vehicle_id, bucket DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_positions_hourly_bucket
  ON vehicle_positions_hourly (bucket DESC);

DO $$
BEGIN
  PERFORM add_continuous_aggregate_policy(
    'vehicle_positions_hourly',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN OTHERS THEN
    IF SQLERRM NOT ILIKE '%already exists%' THEN RAISE; END IF;
END $$;
