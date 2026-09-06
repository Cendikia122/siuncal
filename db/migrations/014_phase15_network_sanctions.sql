-- Phase 15: Network View, Collective Anomaly, Sanction Workflow
-- Migration 014

-- 1. Collective Anomalies
CREATE TABLE IF NOT EXISTS collective_anomalies (
  collective_anomaly_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('OWNER_MULTI_HIGH_RISK','ROUTE_CLUSTER_VIOLATION','DEVICE_REASSIGN_ABUSE','TIMING_COORDINATION')),
  severity text NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','ESCALATED','RESOLVED')),
  evidence jsonb NOT NULL DEFAULT '{}',
  involved_vehicles uuid[] NOT NULL DEFAULT '{}',
  involved_owners uuid[],
  route_id text REFERENCES routes(route_id),
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  escalation_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_collective_anomalies_status ON collective_anomalies (status, severity, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_collective_anomalies_type ON collective_anomalies (type, detected_at DESC);

-- 2. Sanctions
CREATE TABLE IF NOT EXISTS sanctions (
  sanction_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  owner_id uuid REFERENCES owners(owner_id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('WARNING','COACHING','ADMINISTRATIVE','SUSPENSION','REVOCATION')),
  level text NOT NULL CHECK (level IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  reason text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}',
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  collective_anomaly_id uuid REFERENCES collective_anomalies(collective_anomaly_id) ON DELETE SET NULL,
  decided_by uuid NOT NULL REFERENCES users(user_id),
  decided_at timestamptz NOT NULL DEFAULT now(),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_until date,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','EXPIRED','REVOKED','RENEWED')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (vehicle_id IS NOT NULL OR owner_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_sanctions_vehicle ON sanctions (vehicle_id, status);
CREATE INDEX IF NOT EXISTS idx_sanctions_owner ON sanctions (owner_id, status);
CREATE INDEX IF NOT EXISTS idx_sanctions_status ON sanctions (status, effective_from DESC);

-- 3. Sanction Actions (audit trail)
CREATE TABLE IF NOT EXISTS sanction_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sanction_id uuid NOT NULL REFERENCES sanctions(sanction_id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('CREATE','RENEW','REVOKE','NOTE')),
  actor_id uuid REFERENCES users(user_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sanction_actions_sanction ON sanction_actions (sanction_id, created_at DESC);

-- 4. Extend risk_score_events event_type to include new types
ALTER TABLE risk_score_events DROP CONSTRAINT IF EXISTS risk_score_events_event_type_check;
ALTER TABLE risk_score_events ADD CONSTRAINT risk_score_events_event_type_check
  CHECK (event_type IN ('ANOMALY','DAILY_DECAY','WEEKLY_DECAY','COLLECTIVE_ANOMALY','OWNER_PROPAGATION'));
