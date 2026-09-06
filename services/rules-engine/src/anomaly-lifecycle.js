import {
  clampScore,
  riskLevelForScore
} from "./risk-scoring.js";

const severityRank = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4
};

const noopLogEvent = () => {};

const messageForRule = (rule, evidence) => {
  const plate = evidence.vehicle.plate_no || evidence.vehicle.vehicle_id;
  if (rule === "LOST_SIGNAL") return `${plate} tidak mengirim ping selama ${evidence.metrics.minutes_since_ping} menit`;
  if (rule === "OFF_ROUTE") return `${plate} keluar koridor trayek selama ${evidence.metrics.off_route_points} titik telemetry`;
  if (rule === "WRONG_DIRECTION") return `${plate} bergerak berlawanan arah trayek selama ${evidence.metrics.wrong_direction_points} titik telemetry`;
  if (rule === "NGETEM") return `${plate} berhenti lambat ${evidence.metrics.duration_minutes} menit di luar stop resmi`;
  if (rule === "OVERSPEED") return `${plate} melewati batas ${evidence.threshold.max_speed_kmh} km/jam berulang`;
  return `${plate} memicu rule ${rule}`;
};

const locationDescForEvidence = ({ evidence, lat, lon }) => {
  if (evidence?.location?.description) return evidence.location.description;
  if (lat !== null && lat !== undefined && lon !== null && lon !== undefined) {
    return `${Number(lat).toFixed(5)}, ${Number(lon).toFixed(5)}`;
  }
  return null;
};

const shouldEscalateAlert = async (client, { vehicleId, rule, severity, repeatEscalationCount }) => {
  if (severityRank[severity] >= severityRank.HIGH) return true;

  const { rows } = await client.query(
    `SELECT COUNT(*)::int AS total
     FROM anomalies
     WHERE vehicle_id = $1
       AND rule = $2
       AND started_at >= now() - interval '24 hours'`,
    [vehicleId, rule]
  );

  return Number(rows[0]?.total || 0) >= repeatEscalationCount;
};

export const applyRiskScoreForAnomaly = async (
  client,
  { vehicle, anomalyId, rule, severity, evidence, riskDeltas, logEvent = noopLogEvent }
) => {
  const delta = riskDeltas[rule] || 0;
  if (delta <= 0) return;

  const existingEvent = await client.query(
    `SELECT event_id
     FROM risk_score_events
     WHERE anomaly_id = $1
       AND event_type = 'ANOMALY'
     LIMIT 1`,
    [anomalyId]
  );
  if (existingEvent.rows.length) return;

  await client.query(
    `INSERT INTO risk_scores (vehicle_id, current_score, risk_level)
     VALUES ($1, 0, 'LOW')
     ON CONFLICT (vehicle_id) DO NOTHING`,
    [vehicle.vehicle_id]
  );

  const scoreResult = await client.query(
    `SELECT current_score
     FROM risk_scores
     WHERE vehicle_id = $1
     FOR UPDATE`,
    [vehicle.vehicle_id]
  );

  const previousScore = Number(scoreResult.rows[0]?.current_score || 0);
  const newScore = clampScore(previousScore + delta);
  const newLevel = riskLevelForScore(newScore);

  const inserted = await client.query(
    `INSERT INTO risk_score_events (
       vehicle_id,
       anomaly_id,
       event_type,
       rule,
       severity,
       delta,
       previous_score,
       new_score,
       metadata
     )
     VALUES ($1, $2, 'ANOMALY', $3, $4, $5, $6, $7, $8::jsonb)
     ON CONFLICT DO NOTHING
     RETURNING event_id`,
    [
      vehicle.vehicle_id,
      anomalyId,
      rule,
      severity,
      delta,
      previousScore,
      newScore,
      JSON.stringify({
        source: "anomaly_open",
        evidence,
        planned_multipliers: ["repetition", "rush_hour", "concurrent_anomaly", "owner_context"]
      })
    ]
  );

  if (!inserted.rows.length) return;

  await client.query(
    `UPDATE risk_scores
     SET current_score = $1,
         risk_level = $2,
         last_anomaly_at = now(),
         last_high_critical_at = CASE
           WHEN $3 IN ('HIGH', 'CRITICAL') THEN now()
           ELSE last_high_critical_at
         END,
         updated_at = now()
     WHERE vehicle_id = $4`,
    [newScore, newLevel, severity, vehicle.vehicle_id]
  );

  logEvent("risk_score_change", {
    vehicle_id: vehicle.vehicle_id,
    rule,
    severity,
    delta,
    previous_score: previousScore,
    new_score: newScore,
    risk_level: newLevel
  });
};

const ensureIncident = async (client, { alertId, vehicleId, rule, severity, message, evidence, lat, lon, logEvent }) => {
  const existing = await client.query(
    `SELECT incident_id
     FROM incidents
     WHERE alert_id = $1
        OR (
          alert_id IS NULL
          AND vehicle_id = $2
          AND type = $3
          AND status IN ('OPEN', 'IN_PROGRESS')
        )
     LIMIT 1`,
    [alertId, vehicleId, rule]
  );

  if (existing.rows.length) {
    const incidentId = existing.rows[0].incident_id;
    await client.query(
      `UPDATE incidents
       SET alert_id = COALESCE(alert_id, $1)
       WHERE incident_id = $2`,
      [alertId, incidentId]
    );
    await client.query(
      `INSERT INTO notifications (incident_id, channel, status, payload)
       SELECT $1, 'BROWSER', 'PENDING', jsonb_build_object('message', $2::text, 'rule', $3::text, 'severity', $4::text)
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications WHERE incident_id = $1 AND channel = 'BROWSER'
       )`,
      [incidentId, message, rule, severity]
    );
    return incidentId;
  }

  const locationDesc = locationDescForEvidence({ evidence, lat, lon });
  const result = await client.query(
    `INSERT INTO incidents (vehicle_id, alert_id, type, severity, status, description, location_desc, lat, lon, created_at)
     VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7, $8, now())
     RETURNING incident_id`,
    [vehicleId, alertId, rule, severity, message, locationDesc, lat || null, lon || null]
  );

  await client.query(
    `INSERT INTO incident_actions (incident_id, action, notes)
     VALUES ($1, 'AUTO_OPEN', $2)`,
    [result.rows[0].incident_id, `Escalated from alert ${alertId}. Evidence: ${JSON.stringify(evidence)}`]
  );
  await client.query(
    `INSERT INTO notifications (incident_id, channel, status, payload)
     VALUES ($1, 'BROWSER', 'PENDING', jsonb_build_object('message', $2::text, 'rule', $3::text, 'severity', $4::text))`,
    [result.rows[0].incident_id, message, rule, severity]
  );

  logEvent("incident_open", { rule, severity, vehicle_id: vehicleId, alert_id: alertId, incident_id: result.rows[0].incident_id });
  return result.rows[0].incident_id;
};

export const openRuleLifecycle = async ({
  pool,
  vehicle,
  rule,
  severity,
  evidence,
  lat,
  lon,
  config,
  logEvent = noopLogEvent
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const existingAnomaly = await client.query(
      `SELECT anomaly_id
       FROM anomalies
       WHERE vehicle_id = $1
         AND rule = $2
         AND status = 'OPEN'
       LIMIT 1`,
      [vehicle.vehicle_id, rule]
    );

    let anomalyId;
    let anomalyOpened = false;
    if (existingAnomaly.rows.length) {
      anomalyId = existingAnomaly.rows[0].anomaly_id;
      await client.query(
        `UPDATE anomalies
         SET route_id = $1,
             severity = $2,
             last_seen_at = now(),
             lat = $3,
             lon = $4,
             evidence = $5::jsonb,
             updated_at = now()
         WHERE anomaly_id = $6`,
        [vehicle.route_id || null, severity, lat || null, lon || null, JSON.stringify(evidence), anomalyId]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO anomalies (vehicle_id, route_id, rule, severity, status, lat, lon, evidence)
         VALUES ($1, $2, $3, $4, 'OPEN', $5, $6, $7::jsonb)
         RETURNING anomaly_id`,
        [vehicle.vehicle_id, vehicle.route_id || null, rule, severity, lat || null, lon || null, JSON.stringify(evidence)]
      );
      anomalyId = inserted.rows[0].anomaly_id;
      anomalyOpened = true;
      logEvent("anomaly_open", { rule, severity, vehicle_id: vehicle.vehicle_id, anomaly_id: anomalyId });
      await applyRiskScoreForAnomaly(client, { vehicle, anomalyId, rule, severity, evidence, riskDeltas: config.riskDeltas, logEvent });
    }

    const message = messageForRule(rule, evidence);
    const existingAlert = await client.query(
      `SELECT alert_id, status
       FROM alerts
       WHERE anomaly_id = $1
         AND status IN ('OPEN', 'ESCALATED')
       LIMIT 1`,
      [anomalyId]
    );

    let alertId;
    let alertStatus = "OPEN";
    if (existingAlert.rows.length) {
      alertId = existingAlert.rows[0].alert_id;
      alertStatus = existingAlert.rows[0].status;
      await client.query(
        `UPDATE alerts
         SET route_id = $1,
             severity = $2,
             message = $3,
             last_seen_at = now(),
             evidence = $4::jsonb,
             updated_at = now()
         WHERE alert_id = $5`,
        [vehicle.route_id || null, severity, message, JSON.stringify(evidence), alertId]
      );
    } else {
      const inserted = await client.query(
        `INSERT INTO alerts (anomaly_id, vehicle_id, route_id, rule, severity, status, message, evidence)
         VALUES ($1, $2, $3, $4, $5, 'OPEN', $6, $7::jsonb)
         RETURNING alert_id`,
        [anomalyId, vehicle.vehicle_id, vehicle.route_id || null, rule, severity, message, JSON.stringify(evidence)]
      );
      alertId = inserted.rows[0].alert_id;
      logEvent("alert_open", { rule, severity, vehicle_id: vehicle.vehicle_id, anomaly_id: anomalyId, alert_id: alertId });
    }

    if (alertStatus !== "ESCALATED" && await shouldEscalateAlert(client, {
      vehicleId: vehicle.vehicle_id,
      rule,
      severity,
      repeatEscalationCount: config.repeatEscalationCount
    })) {
      const incidentId = await ensureIncident(client, {
        alertId,
        vehicleId: vehicle.vehicle_id,
        rule,
        severity,
        message,
        evidence,
        lat,
        lon,
        logEvent
      });
      await client.query(
        `UPDATE alerts
         SET status = 'ESCALATED',
             incident_id = $1,
             updated_at = now()
         WHERE alert_id = $2`,
        [incidentId, alertId]
      );
      logEvent("alert_escalated", { rule, severity, vehicle_id: vehicle.vehicle_id, alert_id: alertId, incident_id: incidentId });
    }

    await client.query("COMMIT");
    return { anomalyOpened, anomalyId, alertId };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const resolveRuleLifecycle = async ({ pool, vehicle, rule, reason, logEvent = noopLogEvent }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const anomalies = await client.query(
      `UPDATE anomalies
       SET status = 'RESOLVED',
           resolved_at = now(),
           last_seen_at = now(),
           updated_at = now()
       WHERE vehicle_id = $1
         AND rule = $2
         AND status = 'OPEN'
       RETURNING anomaly_id`,
      [vehicle.vehicle_id, rule]
    );

    for (const anomaly of anomalies.rows) {
      const alerts = await client.query(
        `UPDATE alerts
         SET status = 'RESOLVED',
             resolved_at = now(),
             last_seen_at = now(),
             updated_at = now()
         WHERE anomaly_id = $1
           AND status IN ('OPEN', 'ESCALATED')
         RETURNING alert_id, incident_id`,
        [anomaly.anomaly_id]
      );

      for (const alert of alerts.rows) {
        if (alert.incident_id) {
          const resolvedIncident = await client.query(
            `UPDATE incidents
             SET status = 'RESOLVED',
                 resolved_at = now()
             WHERE incident_id = $1
               AND status IN ('OPEN', 'IN_PROGRESS')
             RETURNING incident_id`,
            [alert.incident_id]
          );

          if (resolvedIncident.rows.length) {
            await client.query(
              `INSERT INTO incident_actions (incident_id, action, notes)
               VALUES ($1, 'AUTO_RESOLVE', $2)`,
              [alert.incident_id, reason]
            );
            logEvent("incident_resolve", { rule, vehicle_id: vehicle.vehicle_id, alert_id: alert.alert_id, incident_id: alert.incident_id });
          }
        }

        logEvent("alert_resolve", { rule, vehicle_id: vehicle.vehicle_id, anomaly_id: anomaly.anomaly_id, alert_id: alert.alert_id, reason });
      }

      logEvent("anomaly_resolve", { rule, vehicle_id: vehicle.vehicle_id, anomaly_id: anomaly.anomaly_id, reason });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
