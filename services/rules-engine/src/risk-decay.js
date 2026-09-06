import { clampScore, riskLevelForScore } from "./risk-scoring.js";

const noopLogEvent = () => {};

export const applyRiskScoreDecay = async ({
  pool,
  dailyDecayPercent,
  weeklyDecayPoints,
  logEvent = noopLogEvent
}) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const dailyCandidates = await client.query(
      `SELECT vehicle_id, current_score
       FROM risk_scores
       WHERE current_score > 0
         AND (last_anomaly_at IS NULL OR last_anomaly_at <= now() - interval '24 hours')
         AND (last_decay_at IS NULL OR last_decay_at <= now() - interval '24 hours')
       FOR UPDATE`
    );

    for (const row of dailyCandidates.rows) {
      const previousScore = Number(row.current_score || 0);
      const decay = Math.max(1, Math.ceil(previousScore * (dailyDecayPercent / 100)));
      const newScore = clampScore(previousScore - decay);
      await client.query(
        `INSERT INTO risk_score_events (
           vehicle_id,
           event_type,
           delta,
           previous_score,
           new_score,
           metadata
         )
         VALUES ($1, 'DAILY_DECAY', $2, $3, $4, $5::jsonb)`,
        [
          row.vehicle_id,
          -decay,
          previousScore,
          newScore,
          JSON.stringify({ reason: "24h_without_new_anomaly", daily_decay_percent: dailyDecayPercent })
        ]
      );
      await client.query(
        `UPDATE risk_scores
         SET current_score = $1,
             risk_level = $2,
             last_decay_at = now(),
             updated_at = now()
         WHERE vehicle_id = $3`,
        [newScore, riskLevelForScore(newScore), row.vehicle_id]
      );
      logEvent("risk_score_decay", {
        vehicle_id: row.vehicle_id,
        event_type: "DAILY_DECAY",
        delta: -decay,
        previous_score: previousScore,
        new_score: newScore
      });
    }

    const weeklyCandidates = await client.query(
      `SELECT vehicle_id, current_score
       FROM risk_scores
       WHERE current_score > 0
         AND (last_anomaly_at IS NULL OR last_anomaly_at <= now() - interval '7 days')
         AND (last_high_critical_at IS NULL OR last_high_critical_at <= now() - interval '7 days')
         AND (last_decay_at IS NULL OR last_decay_at <= now() - interval '7 days')
         AND NOT EXISTS (
           SELECT 1
           FROM risk_score_events e
           WHERE e.vehicle_id = risk_scores.vehicle_id
             AND e.event_type = 'WEEKLY_DECAY'
             AND e.created_at >= now() - interval '7 days'
         )
       FOR UPDATE`
    );

    for (const row of weeklyCandidates.rows) {
      const previousScore = Number(row.current_score || 0);
      const newScore = clampScore(previousScore - weeklyDecayPoints);
      if (newScore === previousScore) continue;
      await client.query(
        `INSERT INTO risk_score_events (
           vehicle_id,
           event_type,
           delta,
           previous_score,
           new_score,
           metadata
         )
         VALUES ($1, 'WEEKLY_DECAY', $2, $3, $4, $5::jsonb)`,
        [
          row.vehicle_id,
          -(previousScore - newScore),
          previousScore,
          newScore,
          JSON.stringify({ reason: "7d_without_high_or_critical_anomaly", weekly_decay_points: weeklyDecayPoints })
        ]
      );
      await client.query(
        `UPDATE risk_scores
         SET current_score = $1,
             risk_level = $2,
             last_decay_at = now(),
             updated_at = now()
         WHERE vehicle_id = $3`,
        [newScore, riskLevelForScore(newScore), row.vehicle_id]
      );
      logEvent("risk_score_decay", {
        vehicle_id: row.vehicle_id,
        event_type: "WEEKLY_DECAY",
        delta: -(previousScore - newScore),
        previous_score: previousScore,
        new_score: newScore
      });
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};
