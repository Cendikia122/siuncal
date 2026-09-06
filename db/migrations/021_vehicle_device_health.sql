ALTER TABLE vehicle_positions
  ADD COLUMN IF NOT EXISTS battery_level numeric(5, 2),
  ADD COLUMN IF NOT EXISTS signal_dbm numeric(6, 2),
  ADD COLUMN IF NOT EXISTS power_connected boolean;

CREATE INDEX IF NOT EXISTS idx_vehicle_positions_power_disconnect
  ON vehicle_positions (vehicle_id, ts DESC)
  WHERE power_connected = false;
