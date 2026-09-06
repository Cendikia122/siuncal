import { clampScore, riskLevelForScore } from "./risk-scoring.js";

export const applyOwnerRiskPropagation = async ({ query, propagationDelta = 5 }) => {
  const { rows: owners } = await query(
    `SELECT v.owner_id, array_agg(DISTINCT v.vehicle_id) AS vehicle_ids
     FROM vehicles v
     JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     WHERE rs.risk_level IN ('HIGH', 'CRITICAL')
     GROUP BY v.owner_id
     HAVING COUNT(*) >= 2
     UNION
     SELECT unnest(involved_owners) AS owner_id, involved_vehicles AS vehicle_ids
     FROM collective_anomalies
     WHERE status = 'OPEN'
     UNION
     SELECT s.owner_id, array_agg(DISTINCT v2.vehicle_id) AS vehicle_ids
     FROM sanctions s
     JOIN vehicles v2 ON v2.owner_id = s.owner_id
     WHERE s.status = 'ACTIVE' AND s.owner_id IS NOT NULL
     GROUP BY s.owner_id`
  );

  for (const row of owners) {
    if (!row.owner_id || !row.vehicle_ids) continue;
    for (const vehicleId of row.vehicle_ids) {
      const { rows: recent } = await query(
        `SELECT event_id FROM risk_score_events
         WHERE vehicle_id = $1 AND event_type = 'OWNER_PROPAGATION'
           AND created_at >= now() - interval '24 hours'
         LIMIT 1`,
        [vehicleId]
      );
      if (recent.length > 0) continue;

      const { rows: scoreRows } = await query(
        `SELECT current_score FROM risk_scores WHERE vehicle_id = $1`,
        [vehicleId]
      );
      const prev = scoreRows.length > 0 ? scoreRows[0].current_score : 0;
      const newScore = clampScore(prev + propagationDelta);
      const newLevel = riskLevelForScore(newScore);

      await query(
        `INSERT INTO risk_scores (vehicle_id, current_score, risk_level, updated_at)
         VALUES ($1, $2, $3, now())
         ON CONFLICT (vehicle_id)
         DO UPDATE SET current_score = $2, risk_level = $3, updated_at = now()`,
        [vehicleId, newScore, newLevel]
      );
      await query(
        `INSERT INTO risk_score_events (vehicle_id, event_type, delta, previous_score, new_score, metadata)
         VALUES ($1, 'OWNER_PROPAGATION', $2, $3, $4, $5)`,
        [
          vehicleId,
          propagationDelta,
          prev,
          newScore,
          JSON.stringify({ owner_id: row.owner_id, reason: "owner_multi_risk_or_collective_anomaly_or_sanction" })
        ]
      );
    }
  }
};
