CREATE TABLE IF NOT EXISTS risk_scores (
  vehicle_id uuid PRIMARY KEY REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  current_score integer NOT NULL DEFAULT 0 CHECK (current_score >= 0 AND current_score <= 100),
  risk_level text NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  last_anomaly_at timestamptz,
  last_decay_at timestamptz,
  last_high_critical_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS risk_score_events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  anomaly_id uuid REFERENCES anomalies(anomaly_id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('ANOMALY', 'DAILY_DECAY', 'WEEKLY_DECAY')),
  rule text,
  severity text CHECK (severity IS NULL OR severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  delta integer NOT NULL,
  previous_score integer NOT NULL CHECK (previous_score >= 0 AND previous_score <= 100),
  new_score integer NOT NULL CHECK (new_score >= 0 AND new_score <= 100),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_risk_score_events_anomaly
  ON risk_score_events (anomaly_id)
  WHERE event_type = 'ANOMALY' AND anomaly_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_risk_score_events_vehicle_time ON risk_score_events (vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_risk_scores_level ON risk_scores (risk_level, current_score DESC);

WITH anomaly_deltas AS (
  SELECT
    a.anomaly_id,
    a.vehicle_id,
    a.rule,
    a.severity,
    a.started_at,
    CASE a.rule
      WHEN 'NGETEM' THEN 8
      WHEN 'OFF_ROUTE' THEN 12
      WHEN 'LOST_SIGNAL' THEN 10
      WHEN 'OVERSPEED' THEN 6
      WHEN 'DEVICE_TAMPER' THEN 25
      ELSE 0
    END AS delta
  FROM anomalies a
),
running AS (
  SELECT
    anomaly_id,
    vehicle_id,
    rule,
    severity,
    started_at,
    delta,
    LEAST(100, SUM(delta) OVER (
      PARTITION BY vehicle_id
      ORDER BY started_at, anomaly_id
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )) AS new_score
  FROM anomaly_deltas
  WHERE delta > 0
),
inserted_events AS (
  INSERT INTO risk_score_events (
    vehicle_id,
    anomaly_id,
    event_type,
    rule,
    severity,
    delta,
    previous_score,
    new_score,
    metadata,
    created_at
  )
  SELECT
    vehicle_id,
    anomaly_id,
    'ANOMALY',
    rule,
    severity,
    delta,
    GREATEST(0, new_score - delta),
    new_score,
    jsonb_build_object(
      'source', 'migration_backfill',
      'planned_multipliers', jsonb_build_array('repetition', 'rush_hour', 'concurrent_anomaly', 'owner_context')
    ),
    started_at
  FROM running
  ON CONFLICT DO NOTHING
  RETURNING vehicle_id, created_at
),
latest_scores AS (
  SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    new_score,
    created_at
  FROM risk_score_events
  ORDER BY vehicle_id, created_at DESC
)
INSERT INTO risk_scores (
  vehicle_id,
  current_score,
  risk_level,
  last_anomaly_at,
  last_high_critical_at,
  updated_at
)
SELECT
  latest_scores.vehicle_id,
  latest_scores.new_score,
  CASE
    WHEN latest_scores.new_score >= 70 THEN 'CRITICAL'
    WHEN latest_scores.new_score >= 40 THEN 'HIGH'
    WHEN latest_scores.new_score >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  MAX(a.started_at),
  MAX(a.started_at) FILTER (WHERE a.severity IN ('HIGH', 'CRITICAL')),
  now()
FROM latest_scores
JOIN anomalies a ON a.vehicle_id = latest_scores.vehicle_id
GROUP BY latest_scores.vehicle_id, latest_scores.new_score
ON CONFLICT (vehicle_id) DO UPDATE
SET current_score = EXCLUDED.current_score,
    risk_level = EXCLUDED.risk_level,
    last_anomaly_at = GREATEST(
      COALESCE(risk_scores.last_anomaly_at, '-infinity'::timestamptz),
      COALESCE(EXCLUDED.last_anomaly_at, '-infinity'::timestamptz)
    ),
    last_high_critical_at = NULLIF(
      GREATEST(
        COALESCE(risk_scores.last_high_critical_at, '-infinity'::timestamptz),
        COALESCE(EXCLUDED.last_high_critical_at, '-infinity'::timestamptz)
      ),
      '-infinity'::timestamptz
    ),
    updated_at = now();

WITH latest_events AS (
  SELECT DISTINCT ON (vehicle_id)
    vehicle_id,
    new_score,
    created_at
  FROM risk_score_events
  ORDER BY vehicle_id, created_at DESC
),
vehicle_anomaly_context AS (
  SELECT
    vehicle_id,
    MAX(started_at) AS last_anomaly_at,
    MAX(started_at) FILTER (WHERE severity IN ('HIGH', 'CRITICAL')) AS last_high_critical_at
  FROM anomalies
  GROUP BY vehicle_id
)
INSERT INTO risk_scores (
  vehicle_id,
  current_score,
  risk_level,
  last_anomaly_at,
  last_high_critical_at,
  updated_at
)
SELECT
  latest_events.vehicle_id,
  latest_events.new_score,
  CASE
    WHEN latest_events.new_score >= 70 THEN 'CRITICAL'
    WHEN latest_events.new_score >= 40 THEN 'HIGH'
    WHEN latest_events.new_score >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  vehicle_anomaly_context.last_anomaly_at,
  vehicle_anomaly_context.last_high_critical_at,
  now()
FROM latest_events
LEFT JOIN vehicle_anomaly_context ON vehicle_anomaly_context.vehicle_id = latest_events.vehicle_id
ON CONFLICT (vehicle_id) DO UPDATE
SET current_score = EXCLUDED.current_score,
    risk_level = EXCLUDED.risk_level,
    last_anomaly_at = GREATEST(
      COALESCE(risk_scores.last_anomaly_at, '-infinity'::timestamptz),
      COALESCE(EXCLUDED.last_anomaly_at, '-infinity'::timestamptz)
    ),
    last_high_critical_at = NULLIF(
      GREATEST(
        COALESCE(risk_scores.last_high_critical_at, '-infinity'::timestamptz),
        COALESCE(EXCLUDED.last_high_critical_at, '-infinity'::timestamptz)
      ),
      '-infinity'::timestamptz
    ),
    updated_at = now();
