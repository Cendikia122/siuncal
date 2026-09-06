CREATE TABLE IF NOT EXISTS playback_records (
  record_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  start_ts timestamptz NOT NULL,
  end_ts timestamptz NOT NULL,
  point_count integer NOT NULL DEFAULT 0,
  event_count integer NOT NULL DEFAULT 0,
  storage_bucket text NOT NULL,
  storage_key text NOT NULL,
  object_url text,
  byte_size integer,
  created_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_playback_records_storage_key
  ON playback_records (storage_bucket, storage_key);

CREATE INDEX IF NOT EXISTS idx_playback_records_vehicle_time
  ON playback_records (vehicle_id, created_at DESC);
