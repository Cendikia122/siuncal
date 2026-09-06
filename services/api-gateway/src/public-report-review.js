import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import { pool, query } from "./db.js";

const QUEUE_NAME = "public-report-review";

const reviewConfig = {
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  scheduleIntervalMs: Number(process.env.PUBLIC_REPORT_REVIEW_INTERVAL_MS || 5 * 60 * 1000),
  batchSize: Number(process.env.PUBLIC_REPORT_REVIEW_BATCH_SIZE || 25),
  windowMinutes: Number(process.env.PUBLIC_REPORT_REVIEW_WINDOW_MINUTES || 15),
  recentMinutes: Number(process.env.PUBLIC_REPORT_REVIEW_RECENT_MINUTES || 30),
  maxDistanceMeters: Number(process.env.PUBLIC_REPORT_REVIEW_MAX_DISTANCE_METERS || 250),
  staleVehicleMinutes: Number(process.env.PUBLIC_REPORT_REVIEW_STALE_VEHICLE_MINUTES || 20),
  ngetemLowSpeedKmh: Number(process.env.PUBLIC_REPORT_REVIEW_NGETEM_LOW_SPEED_KMH || 3),
  ngetemMinStopMinutes: Number(process.env.PUBLIC_REPORT_REVIEW_NGETEM_MIN_STOP_MINUTES || 10),
  overspeedKmh: Number(process.env.PUBLIC_REPORT_REVIEW_OVERSPEED_KMH || 60),
  officialStopRadiusMeters: Number(process.env.PUBLIC_REPORT_REVIEW_OFFICIAL_STOP_RADIUS_METERS || 75)
};

let reviewQueue = null;
let reviewQueueConnection = null;
let reviewWorker = null;
let scheduleTimer = null;

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const compactRow = (row) => Object.fromEntries(
  Object.entries(row || {}).filter(([, value]) => value !== null && value !== undefined)
);

// --- HIGH-08: Support Redis authentication ---
const createRedisConnection = () => new IORedis({
  host: reviewConfig.redisHost,
  port: reviewConfig.redisPort,
  maxRetriesPerRequest: null,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
});

const getReviewQueue = () => {
  if (process.env.PUBLIC_REPORT_REVIEW_ENABLED === "false") return null;
  if (!reviewQueue) {
    reviewQueueConnection = createRedisConnection();
    reviewQueue = new Queue(QUEUE_NAME, { connection: reviewQueueConnection });
  }
  return reviewQueue;
};

const categoryRule = (category) => {
  if (category === "RECKLESS_DRIVING") return "OVERSPEED";
  if (category === "NGETEM") return "NGETEM";
  return category;
};

const loadReport = async (client, publicReportId) => {
  const { rows } = await client.query(
    `SELECT
        pr.*,
        v.route_id,
        v.status AS vehicle_status
     FROM public_reports pr
     LEFT JOIN vehicles v ON v.vehicle_id = pr.vehicle_id
     WHERE pr.public_report_id = $1
     FOR UPDATE OF pr`,
    [publicReportId]
  );
  return rows[0] || null;
};

const findVehicleByPlate = async (client, plateNo) => {
  const { rows } = await client.query(
    `SELECT vehicle_id, plate_no, route_id, status AS vehicle_status
     FROM vehicles
     WHERE upper(plate_no) = upper($1)
     ORDER BY created_at DESC
     LIMIT 2`,
    [plateNo]
  );
  if (rows.length !== 1) return null;
  return rows[0];
};

const loadEvidence = async (client, report) => {
  const rule = categoryRule(report.category);
  const reportedAt = report.reported_at;
  const vehicleId = report.vehicle_id;

  const [
    latestResult,
    telemetryResult,
    anomalyResult,
    alertResult,
    incidentResult,
    stopResult
  ] = await Promise.all([
    client.query(
      `SELECT
          vehicle_id,
          ts,
          lat,
          lon,
          speed_kmh::float AS speed_kmh,
          heading::float AS heading,
          status,
          CASE
            WHEN lat IS NOT NULL AND lon IS NOT NULL
            THEN ST_DistanceSphere(ST_MakePoint($3, $2), ST_MakePoint(lon, lat))
            ELSE NULL
          END AS distance_to_reporter_m
       FROM vehicle_latest
       WHERE vehicle_id = $1`,
      [vehicleId, report.lat, report.lon]
    ),
    client.query(
      `SELECT
          COUNT(*)::int AS point_count,
          AVG(speed_kmh)::float AS avg_speed_kmh,
          MAX(speed_kmh)::float AS max_speed_kmh,
          COUNT(*) FILTER (WHERE speed_kmh > $3)::int AS overspeed_points,
          COUNT(*) FILTER (WHERE speed_kmh <= $4)::int AS low_speed_points,
          MIN(ts) FILTER (WHERE speed_kmh <= $4) AS low_speed_started_at,
          MAX(ts) FILTER (WHERE speed_kmh <= $4) AS low_speed_ended_at,
          MIN(ts) AS first_point_at,
          MAX(ts) AS last_point_at
       FROM vehicle_positions
       WHERE vehicle_id = $1
         AND ts >= $2::timestamptz - ($5::int * interval '1 minute')
         AND ts <= $2::timestamptz + ($5::int * interval '1 minute')`,
      [
        vehicleId,
        reportedAt,
        reviewConfig.overspeedKmh,
        reviewConfig.ngetemLowSpeedKmh,
        reviewConfig.windowMinutes
      ]
    ),
    client.query(
      `SELECT anomaly_id, rule, severity, status, started_at, last_seen_at, evidence
       FROM anomalies
       WHERE vehicle_id = $1
         AND rule = $2
         AND last_seen_at >= $3::timestamptz - ($4::int * interval '1 minute')
       ORDER BY
         CASE WHEN status = 'OPEN' THEN 0 ELSE 1 END,
         last_seen_at DESC
       LIMIT 1`,
      [vehicleId, rule, reportedAt, reviewConfig.recentMinutes]
    ),
    client.query(
      `SELECT alert_id, rule, severity, status, opened_at, last_seen_at, evidence
       FROM alerts
       WHERE vehicle_id = $1
         AND rule = $2
         AND last_seen_at >= $3::timestamptz - ($4::int * interval '1 minute')
       ORDER BY
         CASE WHEN status IN ('OPEN', 'ESCALATED') THEN 0 ELSE 1 END,
         last_seen_at DESC
       LIMIT 1`,
      [vehicleId, rule, reportedAt, reviewConfig.recentMinutes]
    ),
    client.query(
      `SELECT incident_id, type, severity, status, created_at, resolved_at
       FROM incidents
       WHERE vehicle_id = $1
         AND type = $2
         AND created_at >= $3::timestamptz - ($4::int * interval '1 minute')
       ORDER BY created_at DESC
       LIMIT 1`,
      [vehicleId, rule, reportedAt, reviewConfig.recentMinutes]
    ),
    client.query(
      `WITH report_point AS (
         SELECT ST_SetSRID(ST_MakePoint($3, $2), 4326) AS geom
       ),
       nearest_stop AS (
         SELECT
           rs.stop_id::text AS id,
           rs.name,
           ST_DistanceSphere(rp.geom, rs.geom) AS distance_m
         FROM route_stops rs
         CROSS JOIN report_point rp
         WHERE rs.route_id = $1
         ORDER BY rp.geom <-> rs.geom
         LIMIT 1
       ),
       matching_geofence AS (
         SELECT geofence_id::text AS id, name, type
         FROM geofences gf
         CROSS JOIN report_point rp
         WHERE gf.route_id = $1
           AND ST_Intersects(gf.geom, rp.geom)
         ORDER BY gf.created_at DESC
         LIMIT 1
       )
       SELECT
         (SELECT row_to_json(nearest_stop) FROM nearest_stop) AS nearest_stop,
         (SELECT row_to_json(matching_geofence) FROM matching_geofence) AS matching_geofence`,
      [report.route_id, report.lat, report.lon]
    )
  ]);

  const latest = latestResult.rows[0] || null;
  const telemetry = telemetryResult.rows[0] || {};
  const lowSpeedStarted = telemetry.low_speed_started_at ? new Date(telemetry.low_speed_started_at).getTime() : null;
  const lowSpeedEnded = telemetry.low_speed_ended_at ? new Date(telemetry.low_speed_ended_at).getTime() : null;
  const lowSpeedDurationMinutes = lowSpeedStarted && lowSpeedEnded
    ? Math.max(0, Math.round((lowSpeedEnded - lowSpeedStarted) / 60000))
    : 0;
  const stop = stopResult.rows[0] || {};
  const nearestStop = stop.nearest_stop || null;
  const isNearOfficialStop = Boolean(
    stop.matching_geofence ||
    (nearestStop && toNumber(nearestStop.distance_m) !== null && toNumber(nearestStop.distance_m) <= reviewConfig.officialStopRadiusMeters)
  );

  return {
    rule,
    latest_vehicle: latest ? compactRow({
      ...latest,
      distance_to_reporter_m: toNumber(latest.distance_to_reporter_m)
    }) : null,
    telemetry_window: compactRow({
      ...telemetry,
      point_count: Number(telemetry.point_count || 0),
      overspeed_points: Number(telemetry.overspeed_points || 0),
      low_speed_points: Number(telemetry.low_speed_points || 0),
      low_speed_duration_minutes: lowSpeedDurationMinutes
    }),
    matched_anomaly: anomalyResult.rows[0] || null,
    matched_alert: alertResult.rows[0] || null,
    matched_incident: incidentResult.rows[0] || null,
    route_context: {
      nearest_stop: nearestStop,
      matching_geofence: stop.matching_geofence || null,
      is_near_official_stop: isNearOfficialStop
    }
  };
};

const classifyDescription = (description, category) => {
  const normalized = String(description || "").toLowerCase();
  if (category === "NGETEM" && /(ngetem|nunggu|berhenti|mangkal|lama)/i.test(normalized)) return "CATEGORY_CONSISTENT";
  if (category === "RECKLESS_DRIVING" && /(ugal|ngebut|kencang|bahaya|ugal-ugalan)/i.test(normalized)) return "CATEGORY_CONSISTENT";
  if (category === "SECURITY" && /(ribut|ancam|keamanan|copet|pelecehan)/i.test(normalized)) return "CATEGORY_CONSISTENT";
  if (category === "SERVICE" && /(layanan|sopir|tarif|kasar|tidak ramah)/i.test(normalized)) return "CATEGORY_CONSISTENT";
  return "NEEDS_OPERATOR_REVIEW";
};

const buildAiSummary = ({ report, verdict, confidenceScore, evidence }) => ({
  mode: "rules_assisted_summary",
  description_classification: classifyDescription(report.description, report.category),
  confidence_explanation: `${Math.round(confidenceScore * 100)}% confidence based on plate match, distance, telemetry window, and monitoring anomaly/alert evidence.`,
  summary: verdict === "CONFIRMED"
    ? `Evidence monitoring kuat untuk ${evidence.rule}; laporan layak dieskalasi otomatis.`
    : verdict === "LIKELY"
      ? `Evidence mengarah ke ${evidence.rule}, tetapi masih perlu keputusan operator.`
      : verdict === "REJECT_SUSPECTED_SPAM"
        ? "Evidence dasar tidak mendukung laporan, terutama plate/lokasi."
        : "Evidence monitoring belum cukup untuk menyimpulkan laporan.",
  planned_ocr: {
    status: "PLANNED",
    note: "OCR plat dari attachment belum menjadi dasar verdict otomatis."
  }
});

const decideVerdict = (report, evidence) => {
  if (report.plate_match_status !== "MATCHED_VEHICLE" || !report.vehicle_id) {
    return {
      verdict: "REJECT_SUSPECTED_SPAM",
      confidenceScore: 0.82,
      reasonSummary: "Plate no belum match ke master data kendaraan, sehingga laporan ditahan untuk audit manual."
    };
  }

  const latest = evidence.latest_vehicle;
  const telemetry = evidence.telemetry_window;
  const distance = toNumber(latest?.distance_to_reporter_m ?? report.distance_to_vehicle_m);
  const isNearReporter = distance !== null && distance <= reviewConfig.maxDistanceMeters;
  const latestTs = latest?.ts ? new Date(latest.ts).getTime() : null;
  const isFresh = latestTs ? Date.now() - latestTs <= reviewConfig.staleVehicleMinutes * 60 * 1000 : false;
  const hasRuleSignal = Boolean(evidence.matched_anomaly || evidence.matched_alert);

  if (!latest || !isFresh) {
    return {
      verdict: "INCONCLUSIVE",
      confidenceScore: 0.35,
      reasonSummary: "GPS kendaraan belum tersedia atau terlalu lama, sehingga automation tidak bisa memastikan laporan."
    };
  }

  if (!isNearReporter) {
    return {
      verdict: "REJECT_SUSPECTED_SPAM",
      confidenceScore: 0.74,
      reasonSummary: `Lokasi pelapor berjarak ${Math.round(distance || 0)} m dari GPS kendaraan, melewati radius review otomatis.`
    };
  }

  if (report.category === "NGETEM") {
    const lowSpeedDuration = Number(telemetry.low_speed_duration_minutes || 0);
    const avgSpeed = toNumber(telemetry.avg_speed_kmh);
    const stoppedLongEnough = lowSpeedDuration >= reviewConfig.ngetemMinStopMinutes;
    const speedLow = avgSpeed !== null && avgSpeed <= reviewConfig.ngetemLowSpeedKmh;
    const outsideOfficialStop = !evidence.route_context.is_near_official_stop;

    if (outsideOfficialStop && isNearReporter && (stoppedLongEnough || hasRuleSignal) && speedLow) {
      return {
        verdict: "CONFIRMED",
        confidenceScore: hasRuleSignal ? 0.93 : 0.88,
        reasonSummary: "Plate match, pelapor dekat kendaraan, telemetry menunjukkan diam/lambat cukup lama di luar stop resmi, dan evidence monitoring mendukung NGETEM."
      };
    }

    if (isNearReporter && outsideOfficialStop && (speedLow || hasRuleSignal)) {
      return {
        verdict: "LIKELY",
        confidenceScore: 0.68,
        reasonSummary: "Konteks lokasi dan telemetry mencurigakan untuk NGETEM, tetapi durasi/evidence belum cukup untuk auto-escalate."
      };
    }
  }

  if (report.category === "RECKLESS_DRIVING") {
    const overspeedPoints = Number(telemetry.overspeed_points || 0);
    const pointCount = Number(telemetry.point_count || 0);
    const maxSpeed = toNumber(telemetry.max_speed_kmh) || 0;

    if (isNearReporter && overspeedPoints >= 2 && pointCount >= 3 && maxSpeed > reviewConfig.overspeedKmh) {
      return {
        verdict: "CONFIRMED",
        confidenceScore: hasRuleSignal ? 0.91 : 0.86,
        reasonSummary: `Telemetry window punya ${overspeedPoints} titik di atas ${reviewConfig.overspeedKmh} km/jam, sehingga tidak dianggap spike tunggal.`
      };
    }

    if (isNearReporter && (overspeedPoints >= 1 || hasRuleSignal)) {
      return {
        verdict: "LIKELY",
        confidenceScore: 0.66,
        reasonSummary: "Ada sinyal overspeed/reckless driving, tetapi belum memenuhi guard minimal 2 dari 3 titik telemetry."
      };
    }
  }

  if (hasRuleSignal && isNearReporter) {
    return {
      verdict: "LIKELY",
      confidenceScore: 0.62,
      reasonSummary: "Plate dan lokasi cocok, serta ada anomaly/alert terkait, tetapi kategori ini tetap membutuhkan review operator."
    };
  }

  return {
    verdict: "INCONCLUSIVE",
    confidenceScore: 0.42,
    reasonSummary: "Plate dan lokasi cocok, tetapi telemetry/anomaly/alert belum cukup untuk menyimpulkan validitas laporan."
  };
};

const autoEscalateConfirmedReport = async (client, report, evidence, reasonSummary) => {
  const existingIncidentId = report.incident_id || evidence.matched_incident?.incident_id || null;
  if (existingIncidentId) {
    await client.query(
      `UPDATE public_reports
       SET status = 'ESCALATED_TO_INCIDENT',
           incident_id = $2,
           review_notes = $3,
           reviewed_at = now(),
           updated_at = now()
       WHERE public_report_id = $1`,
      [report.public_report_id, existingIncidentId, reasonSummary]
    );
    return existingIncidentId;
  }

  const incidentType = evidence.rule;
  const incidentResult = await client.query(
    `INSERT INTO incidents (vehicle_id, type, severity, status, description, location_desc, lat, lon)
     VALUES ($1, $2, $3, 'OPEN', $4, $5, $6, $7)
     RETURNING incident_id`,
    [
      report.vehicle_id,
      incidentType,
      incidentType === "OVERSPEED" ? "HIGH" : "MEDIUM",
      `Auto-escalated public report ${report.plate_no}: ${report.description}`,
      "Automated public report review",
      report.lat,
      report.lon
    ]
  );
  const incidentId = incidentResult.rows[0].incident_id;

  await client.query(
    `INSERT INTO incident_actions (incident_id, action, actor_id, notes)
     VALUES ($1, 'ASSIGN', NULL, $2)`,
    [incidentId, `Auto-escalated from public report: ${reasonSummary}`]
  );
  await client.query(
    `INSERT INTO notifications (incident_id, channel, status, payload)
     VALUES ($1, 'OPERATOR_DASHBOARD', 'PENDING', $2)`,
    [
      incidentId,
      JSON.stringify({
        type: "PUBLIC_REPORT_AUTO_ESCALATED",
        message: `Public report ${report.plate_no} confirmed by automated review`,
        public_report_id: report.public_report_id,
        verdict: "CONFIRMED"
      })
    ]
  );
  await client.query(
    `UPDATE public_reports
     SET status = 'ESCALATED_TO_INCIDENT',
         incident_id = $2,
         review_notes = $3,
         reviewed_at = now(),
         updated_at = now()
     WHERE public_report_id = $1`,
    [report.public_report_id, incidentId, reasonSummary]
  );

  return incidentId;
};

export const processPublicReportReview = async (publicReportId) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const report = await loadReport(client, publicReportId);
    if (!report) {
      await client.query("ROLLBACK");
      return { skipped: true, reason: "REPORT_NOT_FOUND" };
    }
    if (report.status !== "PENDING_REVIEW") {
      await client.query("ROLLBACK");
      return { skipped: true, reason: "REPORT_NOT_PENDING" };
    }

    if (!report.vehicle_id) {
      const vehicle = await findVehicleByPlate(client, report.plate_no);
      if (vehicle) {
        report.vehicle_id = vehicle.vehicle_id;
        report.route_id = vehicle.route_id;
        report.vehicle_status = vehicle.vehicle_status;
        report.plate_match_status = "MATCHED_VEHICLE";
        await client.query(
          `UPDATE public_reports
           SET vehicle_id = $2,
               plate_match_status = 'MATCHED_VEHICLE',
               updated_at = now()
           WHERE public_report_id = $1`,
          [report.public_report_id, vehicle.vehicle_id]
        );
      }
    }

    const evidence = report.vehicle_id
      ? await loadEvidence(client, report)
      : {
        rule: categoryRule(report.category),
        latest_vehicle: null,
        telemetry_window: { point_count: 0 },
        matched_anomaly: null,
        matched_alert: null,
        matched_incident: null,
        route_context: { is_near_official_stop: false }
      };
    const decision = decideVerdict(report, evidence);
    let matchedIncidentId = evidence.matched_incident?.incident_id || null;
    let autoEscalated = false;

    if (decision.verdict === "CONFIRMED") {
      matchedIncidentId = await autoEscalateConfirmedReport(client, report, evidence, decision.reasonSummary);
      autoEscalated = true;
    }

    const aiSummary = buildAiSummary({
      report,
      verdict: decision.verdict,
      confidenceScore: decision.confidenceScore,
      evidence
    });
    const evidenceSnapshot = {
      report: compactRow({
        public_report_id: report.public_report_id,
        plate_no: report.plate_no,
        category: report.category,
        reported_at: report.reported_at,
        lat: report.lat,
        lon: report.lon,
        accuracy_m: report.accuracy_m,
        plate_match_status: report.plate_match_status,
        vehicle_id: report.vehicle_id
      }),
      monitoring: evidence,
      policy: {
        max_distance_meters: reviewConfig.maxDistanceMeters,
        telemetry_window_minutes: reviewConfig.windowMinutes,
        ngetem_low_speed_kmh: reviewConfig.ngetemLowSpeedKmh,
        ngetem_min_stop_minutes: reviewConfig.ngetemMinStopMinutes,
        overspeed_kmh: reviewConfig.overspeedKmh,
        official_stop_radius_meters: reviewConfig.officialStopRadiusMeters
      }
    };

    const reviewResult = await client.query(
      `INSERT INTO public_report_reviews (
         public_report_id,
         verdict,
         confidence_score,
         reason_summary,
         evidence_snapshot,
         ai_summary,
         matched_anomaly_id,
         matched_alert_id,
         matched_incident_id,
         auto_escalated
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING review_id`,
      [
        report.public_report_id,
        decision.verdict,
        decision.confidenceScore,
        decision.reasonSummary,
        JSON.stringify(evidenceSnapshot),
        JSON.stringify(aiSummary),
        evidence.matched_anomaly?.anomaly_id || null,
        evidence.matched_alert?.alert_id || null,
        matchedIncidentId,
        autoEscalated
      ]
    );

    if (decision.verdict === "LIKELY") {
      await client.query(
        `UPDATE public_reports
         SET review_notes = $2,
             updated_at = now()
         WHERE public_report_id = $1`,
        [report.public_report_id, `PRIORITY_REVIEW: ${decision.reasonSummary}`]
      );
    }

    await client.query("COMMIT");
    return {
      public_report_id: report.public_report_id,
      review_id: reviewResult.rows[0].review_id,
      verdict: decision.verdict,
      confidence_score: decision.confidenceScore,
      auto_escalated: autoEscalated,
      incident_id: matchedIncidentId
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const enqueuePublicReportReviewBatch = async ({ limit = reviewConfig.batchSize } = {}) => {
  const queue = getReviewQueue();
  if (!queue) return { queued: 0, disabled: true };
  const { rows } = await query(
    `SELECT pr.public_report_id
     FROM public_reports pr
     WHERE pr.status = 'PENDING_REVIEW'
       AND NOT EXISTS (
         SELECT 1
         FROM public_report_reviews prr
         WHERE prr.public_report_id = pr.public_report_id
           AND prr.created_at >= now() - ($2::int * interval '1 minute')
       )
     ORDER BY pr.created_at
     LIMIT $1`,
    [limit, reviewConfig.recentMinutes]
  );

  await Promise.all(rows.map(async (row) => {
    const jobId = `public-report-review-${row.public_report_id}`;
    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === "failed" || state === "completed") {
        await existingJob.remove();
      }
    }

    return queue.add(
      "review-public-report",
      { public_report_id: row.public_report_id },
      {
        jobId,
        attempts: 3,
        backoff: { type: "fixed", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: true
      }
    );
  }));

  return { queued: rows.length };
};

export const startPublicReportReviewWorker = () => {
  if (process.env.PUBLIC_REPORT_REVIEW_ENABLED === "false") {
    console.log("public-report-review worker disabled");
    return null;
  }
  const queue = getReviewQueue();
  if (!queue) return null;
  if (reviewWorker) return { queue, worker: reviewWorker };

  const workerConnection = createRedisConnection();
  reviewWorker = new Worker(
    QUEUE_NAME,
    async (job) => processPublicReportReview(job.data.public_report_id),
    {
      connection: workerConnection,
      concurrency: Number(process.env.PUBLIC_REPORT_REVIEW_CONCURRENCY || 3)
    }
  );

  reviewWorker.on("completed", (job, result) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), job: job.name, result }));
  });
  reviewWorker.on("failed", (job, error) => {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      job: job?.name || "public-report-review",
      public_report_id: job?.data?.public_report_id,
      error: error.message
    }));
  });

  const schedule = () => enqueuePublicReportReviewBatch().catch((error) => {
    console.error(JSON.stringify({ ts: new Date().toISOString(), job: "public-report-review-schedule", error: error.message }));
  });
  schedule();
  scheduleTimer = setInterval(schedule, reviewConfig.scheduleIntervalMs);

  const shutdown = async () => {
    if (scheduleTimer) clearInterval(scheduleTimer);
    await Promise.allSettled([
      reviewWorker?.close(),
      reviewQueue?.close(),
      reviewQueueConnection?.quit(),
      workerConnection.quit()
    ]);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return { queue, worker: reviewWorker };
};
