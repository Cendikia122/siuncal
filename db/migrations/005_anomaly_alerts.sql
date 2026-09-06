CREATE TABLE IF NOT EXISTS anomalies (
  anomaly_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  route_id text REFERENCES routes(route_id),
  rule text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  lat double precision,
  lon double precision,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_anomalies_open_vehicle_rule
  ON anomalies (vehicle_id, rule)
  WHERE status = 'OPEN';
CREATE INDEX IF NOT EXISTS idx_anomalies_vehicle_time ON anomalies (vehicle_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_anomalies_status ON anomalies (status, severity, last_seen_at DESC);

CREATE TABLE IF NOT EXISTS alerts (
  alert_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anomaly_id uuid NOT NULL REFERENCES anomalies(anomaly_id) ON DELETE CASCADE,
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  route_id text REFERENCES routes(route_id),
  rule text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'RESOLVED', 'ESCALATED')),
  message text,
  opened_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_alerts_open_anomaly
  ON alerts (anomaly_id)
  WHERE status IN ('OPEN', 'ESCALATED');
CREATE INDEX IF NOT EXISTS idx_alerts_vehicle_time ON alerts (vehicle_id, opened_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts (status, severity, last_seen_at DESC);

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS alert_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'incidents_alert_id_fkey'
  ) THEN
    ALTER TABLE incidents
      ADD CONSTRAINT incidents_alert_id_fkey
      FOREIGN KEY (alert_id)
      REFERENCES alerts(alert_id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_incidents_alert_id ON incidents (alert_id);
