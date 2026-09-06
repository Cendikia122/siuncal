ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS reporter_user_id uuid REFERENCES users(user_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reporter_session_id uuid,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS emergency_category text,
  ADD COLUMN IF NOT EXISTS trust_level text,
  ADD COLUMN IF NOT EXISTS escalation_state text NOT NULL DEFAULT 'ON_TRACK',
  ADD COLUMN IF NOT EXISTS ack_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS assignment_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalation_target text,
  ADD COLUMN IF NOT EXISTS escalation_last_at timestamptz;

ALTER TABLE incident_actions
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_incidents_emergency_open
  ON incidents (created_at DESC)
  WHERE type = 'EMERGENCY' AND status IN ('OPEN', 'IN_PROGRESS');

CREATE INDEX IF NOT EXISTS idx_incidents_emergency_reporter_recent
  ON incidents (reporter_user_id, created_at DESC)
  WHERE type = 'EMERGENCY';

CREATE INDEX IF NOT EXISTS idx_incidents_emergency_session_recent
  ON incidents (reporter_session_id, created_at DESC)
  WHERE type = 'EMERGENCY';

CREATE INDEX IF NOT EXISTS idx_incidents_emergency_vehicle_recent
  ON incidents (vehicle_id, created_at DESC)
  WHERE type = 'EMERGENCY';
