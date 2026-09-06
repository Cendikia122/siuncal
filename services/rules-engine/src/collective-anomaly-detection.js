const noopLogEvent = () => {};

export const detectOwnerMultiHighRisk = async ({ query, logEvent = noopLogEvent }) => {
  const { rows: owners } = await query(
    `SELECT v.owner_id, o.name AS owner_name,
            array_agg(v.vehicle_id) AS vehicle_ids,
            array_agg(v.plate_no) AS plate_nos,
            array_agg(rs.current_score) AS scores,
            array_agg(rs.risk_level) AS levels
     FROM vehicles v
     JOIN owners o ON o.owner_id = v.owner_id
     JOIN risk_scores rs ON rs.vehicle_id = v.vehicle_id
     WHERE rs.risk_level IN ('HIGH', 'CRITICAL')
     GROUP BY v.owner_id, o.name
     HAVING COUNT(*) >= 2`
  );

  const { rows: existingOpen } = await query(
    `SELECT collective_anomaly_id, involved_owners, escalation_count
     FROM collective_anomalies
     WHERE type = 'OWNER_MULTI_HIGH_RISK' AND status = 'OPEN'`
  );

  const activeOwnerIds = new Set(owners.map((row) => row.owner_id));
  const existingByOwner = new Map();
  for (const row of existingOpen) {
    for (const ownerId of (row.involved_owners || [])) {
      existingByOwner.set(ownerId, row);
    }
  }

  for (const row of owners) {
    const existing = existingByOwner.get(row.owner_id);
    const evidence = JSON.stringify({
      owner_id: row.owner_id,
      owner_name: row.owner_name,
      vehicles: row.vehicle_ids.map((vehicleId, index) => ({
        vehicle_id: vehicleId,
        plate_no: row.plate_nos[index],
        score: row.scores[index],
        level: row.levels[index]
      }))
    });

    if (existing) {
      const newSeverity = existing.escalation_count >= 2 ? "CRITICAL" : "HIGH";
      await query(
        `UPDATE collective_anomalies
         SET escalation_count = escalation_count + 1,
             severity = $1,
             evidence = $2,
             involved_vehicles = $3,
             updated_at = now()
         WHERE collective_anomaly_id = $4`,
        [newSeverity, evidence, row.vehicle_ids, existing.collective_anomaly_id]
      );
    } else {
      await query(
        `INSERT INTO collective_anomalies (type, severity, evidence, involved_vehicles, involved_owners)
         VALUES ('OWNER_MULTI_HIGH_RISK', 'HIGH', $1, $2, $3)`,
        [evidence, row.vehicle_ids, [row.owner_id]]
      );
      logEvent("collective_anomaly_opened", { type: "OWNER_MULTI_HIGH_RISK", owner_id: row.owner_id });
    }
  }

  for (const row of existingOpen) {
    const stillActive = (row.involved_owners || []).some((ownerId) => activeOwnerIds.has(ownerId));
    if (!stillActive) {
      await query(
        `UPDATE collective_anomalies SET status = 'RESOLVED', resolved_at = now(), updated_at = now() WHERE collective_anomaly_id = $1`,
        [row.collective_anomaly_id]
      );
      logEvent("collective_anomaly_resolved", { type: "OWNER_MULTI_HIGH_RISK", id: row.collective_anomaly_id });
    }
  }
};

export const detectRouteClusterViolation = async ({ query, logEvent = noopLogEvent }) => {
  const { rows: routes } = await query(
    `SELECT a.route_id, r.name AS route_name,
            array_agg(DISTINCT a.vehicle_id) AS vehicle_ids,
            COUNT(DISTINCT a.vehicle_id)::int AS vehicle_count
     FROM anomalies a
     JOIN routes r ON r.route_id = a.route_id
     WHERE a.rule = 'OFF_ROUTE'
       AND a.started_at >= now() - interval '2 hours'
       AND a.status = 'OPEN'
     GROUP BY a.route_id, r.name
     HAVING COUNT(DISTINCT a.vehicle_id) >= 3`
  );

  const { rows: existingOpen } = await query(
    `SELECT collective_anomaly_id, route_id, escalation_count
     FROM collective_anomalies
     WHERE type = 'ROUTE_CLUSTER_VIOLATION' AND status = 'OPEN'`
  );
  const existingByRoute = new Map(existingOpen.map((row) => [row.route_id, row]));
  const activeRouteIds = new Set(routes.map((row) => row.route_id));

  for (const row of routes) {
    const evidence = JSON.stringify({
      route_id: row.route_id,
      route_name: row.route_name,
      vehicle_count: row.vehicle_count,
      vehicle_ids: row.vehicle_ids
    });
    const existing = existingByRoute.get(row.route_id);

    if (existing) {
      const newSeverity = existing.escalation_count >= 2 ? "CRITICAL" : "HIGH";
      await query(
        `UPDATE collective_anomalies
         SET escalation_count = escalation_count + 1, severity = $1,
             evidence = $2, involved_vehicles = $3, updated_at = now()
         WHERE collective_anomaly_id = $4`,
        [newSeverity, evidence, row.vehicle_ids, existing.collective_anomaly_id]
      );
    } else {
      await query(
        `INSERT INTO collective_anomalies (type, severity, evidence, involved_vehicles, route_id)
         VALUES ('ROUTE_CLUSTER_VIOLATION', 'HIGH', $1, $2, $3)`,
        [evidence, row.vehicle_ids, row.route_id]
      );
      logEvent("collective_anomaly_opened", { type: "ROUTE_CLUSTER_VIOLATION", route_id: row.route_id });
    }
  }

  for (const row of existingOpen) {
    if (!activeRouteIds.has(row.route_id)) {
      await query(
        `UPDATE collective_anomalies SET status = 'RESOLVED', resolved_at = now(), updated_at = now() WHERE collective_anomaly_id = $1`,
        [row.collective_anomaly_id]
      );
    }
  }
};

export const detectDeviceReassignAbuse = async ({ query, logEvent = noopLogEvent }) => {
  const { rows: devices } = await query(
    `SELECT a.device_id, d.imei_or_serial,
            array_agg(DISTINCT a.vehicle_id) AS vehicle_ids,
            COUNT(DISTINCT a.vehicle_id)::int AS vehicle_count
     FROM assignments a
     JOIN devices d ON d.device_id = a.device_id
     WHERE a.created_at >= now() - interval '7 days'
       AND a.device_id IS NOT NULL
     GROUP BY a.device_id, d.imei_or_serial
     HAVING COUNT(DISTINCT a.vehicle_id) >= 3`
  );

  for (const row of devices) {
    const { rows: existing } = await query(
      `SELECT collective_anomaly_id FROM collective_anomalies
       WHERE type = 'DEVICE_REASSIGN_ABUSE' AND status = 'OPEN'
         AND involved_vehicles && $1`,
      [row.vehicle_ids]
    );

    if (existing.length === 0) {
      await query(
        `INSERT INTO collective_anomalies (type, severity, evidence, involved_vehicles)
         VALUES ('DEVICE_REASSIGN_ABUSE', 'MEDIUM', $1, $2)`,
        [
          JSON.stringify({
            device_id: row.device_id,
            imei_or_serial: row.imei_or_serial,
            vehicle_count: row.vehicle_count,
            vehicle_ids: row.vehicle_ids
          }),
          row.vehicle_ids
        ]
      );
      logEvent("collective_anomaly_opened", { type: "DEVICE_REASSIGN_ABUSE", device_id: row.device_id });
    }
  }
};

export const detectTimingCoordination = async ({ query, logEvent = noopLogEvent }) => {
  const { rows } = await query(
    `SELECT v.owner_id, o.name AS owner_name,
            EXTRACT(HOUR FROM a.started_at)::int AS violation_hour,
            COUNT(DISTINCT DATE(a.started_at))::int AS day_count,
            COUNT(*)::int AS total_count,
            array_agg(DISTINCT a.vehicle_id) AS vehicle_ids
     FROM anomalies a
     JOIN vehicles v ON v.vehicle_id = a.vehicle_id
     JOIN owners o ON o.owner_id = v.owner_id
     WHERE a.started_at >= now() - interval '7 days'
     GROUP BY v.owner_id, o.name, EXTRACT(HOUR FROM a.started_at)
     HAVING COUNT(*) >= 3 AND COUNT(DISTINCT DATE(a.started_at)) >= 3`
  );

  for (const row of rows) {
    const { rows: existing } = await query(
      `SELECT collective_anomaly_id FROM collective_anomalies
       WHERE type = 'TIMING_COORDINATION' AND status = 'OPEN'
         AND involved_owners @> $1`,
      [[row.owner_id]]
    );

    if (existing.length === 0) {
      await query(
        `INSERT INTO collective_anomalies (type, severity, evidence, involved_vehicles, involved_owners)
         VALUES ('TIMING_COORDINATION', 'HIGH', $1, $2, $3)`,
        [
          JSON.stringify({
            owner_id: row.owner_id,
            owner_name: row.owner_name,
            violation_hour: row.violation_hour,
            day_count: row.day_count,
            total_count: row.total_count
          }),
          row.vehicle_ids,
          [row.owner_id]
        ]
      );
      logEvent("collective_anomaly_opened", { type: "TIMING_COORDINATION", owner_id: row.owner_id, hour: row.violation_hour });
    }
  }
};

export const runCollectiveAnomalyDetection = async ({
  query,
  logEvent = noopLogEvent,
  applyOwnerRiskPropagation
}) => {
  logEvent("collective_detection_start", {});
  await detectOwnerMultiHighRisk({ query, logEvent });
  await detectRouteClusterViolation({ query, logEvent });
  await detectDeviceReassignAbuse({ query, logEvent });
  await detectTimingCoordination({ query, logEvent });
  await applyOwnerRiskPropagation();
  logEvent("collective_detection_end", {});
};
