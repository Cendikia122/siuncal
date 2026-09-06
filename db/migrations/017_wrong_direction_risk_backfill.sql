WITH missing_wrong_direction AS (
  SELECT
    a.anomaly_id,
    a.vehicle_id,
    a.rule,
    a.severity,
    a.started_at,
    10 AS delta
  FROM anomalies a
  WHERE a.rule = 'WRONG_DIRECTION'
    AND NOT EXISTS (
      SELECT 1
      FROM risk_score_events e
      WHERE e.anomaly_id = a.anomaly_id
        AND e.event_type = 'ANOMALY'
    )
),
base_scores AS (
  SELECT
    missing_wrong_direction.vehicle_id,
    COALESCE(risk_scores.current_score, 0) AS current_score
  FROM missing_wrong_direction
  LEFT JOIN risk_scores ON risk_scores.vehicle_id = missing_wrong_direction.vehicle_id
  GROUP BY missing_wrong_direction.vehicle_id, risk_scores.current_score
),
ordered_events AS (
  SELECT
    missing_wrong_direction.*,
    base_scores.current_score,
    ROW_NUMBER() OVER (
      PARTITION BY missing_wrong_direction.vehicle_id
      ORDER BY missing_wrong_direction.started_at, missing_wrong_direction.anomaly_id
    ) AS sequence_no
  FROM missing_wrong_direction
  JOIN base_scores ON base_scores.vehicle_id = missing_wrong_direction.vehicle_id
),
scored_events AS (
  SELECT
    anomaly_id,
    vehicle_id,
    rule,
    severity,
    started_at,
    delta,
    LEAST(100, current_score + ((sequence_no - 1) * delta)) AS previous_score,
    LEAST(100, current_score + (sequence_no * delta)) AS new_score,
    sequence_no
  FROM ordered_events
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
    previous_score,
    new_score,
    jsonb_build_object(
      'source', 'migration_017_wrong_direction_backfill',
      'planned_multipliers', jsonb_build_array('repetition', 'rush_hour', 'concurrent_anomaly', 'owner_context')
    ),
    started_at
  FROM scored_events
  ON CONFLICT DO NOTHING
  RETURNING vehicle_id, anomaly_id, new_score
),
final_scores AS (
  SELECT DISTINCT ON (scored_events.vehicle_id)
    scored_events.vehicle_id,
    scored_events.new_score
  FROM scored_events
  JOIN inserted_events ON inserted_events.anomaly_id = scored_events.anomaly_id
  ORDER BY scored_events.vehicle_id, scored_events.sequence_no DESC
),
vehicle_anomaly_context AS (
  SELECT
    anomalies.vehicle_id,
    MAX(anomalies.started_at) AS last_anomaly_at,
    MAX(anomalies.started_at) FILTER (WHERE anomalies.severity IN ('HIGH', 'CRITICAL')) AS last_high_critical_at
  FROM anomalies
  JOIN final_scores ON final_scores.vehicle_id = anomalies.vehicle_id
  GROUP BY anomalies.vehicle_id
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
  final_scores.vehicle_id,
  final_scores.new_score,
  CASE
    WHEN final_scores.new_score >= 70 THEN 'CRITICAL'
    WHEN final_scores.new_score >= 40 THEN 'HIGH'
    WHEN final_scores.new_score >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  vehicle_anomaly_context.last_anomaly_at,
  vehicle_anomaly_context.last_high_critical_at,
  now()
FROM final_scores
JOIN vehicle_anomaly_context ON vehicle_anomaly_context.vehicle_id = final_scores.vehicle_id
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
