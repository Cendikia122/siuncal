import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import { pool } from "./db.js";

const QUEUE_NAME = "heatmap-generation";

const config = {
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  intervalMs: Number(process.env.HEATMAP_INTERVAL_MS || 3600000),
};

let heatmapQueue = null;
let heatmapQueueConnection = null;
let heatmapWorker = null;
let scheduleTimer = null;

// --- HIGH-08: Support Redis authentication ---
const createRedisConnection = () =>
  new IORedis({
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: null,
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  });

const getHeatmapQueue = () => {
  if (process.env.HEATMAP_ENABLED === "false") return null;
  if (!heatmapQueue) {
    heatmapQueueConnection = createRedisConnection();
    heatmapQueue = new Queue(QUEUE_NAME, { connection: heatmapQueueConnection });
  }
  return heatmapQueue;
};

const generateStopDensity = async (since) => {
  const { rowCount } = await pool.query(
    `INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
     SELECT
       'STOP_DENSITY',
       round(vp.lat::numeric, 3)::double precision,
       round(vp.lon::numeric, 3)::double precision,
       rs.route_id,
       tstzrange($1::timestamptz, now()),
       'stop_count',
       count(*)::double precision,
       count(DISTINCT vp.vehicle_id)::integer,
       jsonb_build_object('stop_name', rs.name, 'stop_id', rs.stop_id)
     FROM vehicle_positions vp
     JOIN route_stops rs ON ST_DWithin(vp.geom, rs.geom, 0.00045)
     WHERE vp.ts >= $1::timestamptz
       AND vp.speed_kmh < 5
     GROUP BY round(vp.lat::numeric, 3), round(vp.lon::numeric, 3), rs.route_id, rs.name, rs.stop_id`,
    [since]
  );
  return rowCount;
};

const generateNgetemZone = async (since) => {
  const { rowCount } = await pool.query(
    `INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
     SELECT
       'NGETEM_ZONE',
       round(a.lat::numeric, 3)::double precision,
       round(a.lon::numeric, 3)::double precision,
       v.route_id,
       tstzrange($1::timestamptz, now()),
       'ngetem_count',
       count(*)::double precision,
       count(DISTINCT a.vehicle_id)::integer,
       jsonb_build_object(
         'avg_duration_min',
         round(avg(EXTRACT(EPOCH FROM (COALESCE(a.resolved_at, now()) - a.started_at)) / 60)::numeric, 1)
       )
     FROM anomalies a
     JOIN vehicles v ON v.vehicle_id = a.vehicle_id
     WHERE a.rule = 'NGETEM'
       AND a.started_at >= $1::timestamptz
       AND a.lat IS NOT NULL AND a.lon IS NOT NULL
     GROUP BY round(a.lat::numeric, 3), round(a.lon::numeric, 3), v.route_id`,
    [since]
  );
  return rowCount;
};

const generateOffRouteZone = async (since) => {
  const { rowCount } = await pool.query(
    `INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
     SELECT
       'OFF_ROUTE_ZONE',
       round(a.lat::numeric, 3)::double precision,
       round(a.lon::numeric, 3)::double precision,
       v.route_id,
       tstzrange($1::timestamptz, now()),
       'off_route_count',
       count(*)::double precision,
       count(DISTINCT a.vehicle_id)::integer,
       '{}'::jsonb
     FROM anomalies a
     JOIN vehicles v ON v.vehicle_id = a.vehicle_id
     WHERE a.rule = 'OFF_ROUTE'
       AND a.started_at >= $1::timestamptz
       AND a.lat IS NOT NULL AND a.lon IS NOT NULL
     GROUP BY round(a.lat::numeric, 3), round(a.lon::numeric, 3), v.route_id`,
    [since]
  );
  return rowCount;
};

const generateSpeedZone = async (since) => {
  const { rowCount } = await pool.query(
    `INSERT INTO heatmap_data (type, grid_lat, grid_lon, route_id, time_window, metric, value, vehicle_count, metadata)
     SELECT
       'SPEED_ZONE',
       round(vp.lat::numeric, 3)::double precision,
       round(vp.lon::numeric, 3)::double precision,
       v.route_id,
       tstzrange($1::timestamptz, now()),
       'avg_speed_kmh',
       round(avg(vp.speed_kmh)::numeric, 1)::double precision,
       count(DISTINCT vp.vehicle_id)::integer,
       jsonb_build_object(
         'max_speed', max(vp.speed_kmh),
         'min_speed', min(vp.speed_kmh),
         'point_count', count(*)
       )
     FROM vehicle_positions vp
     JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
     WHERE vp.ts >= $1::timestamptz
       AND vp.speed_kmh IS NOT NULL
     GROUP BY round(vp.lat::numeric, 3), round(vp.lon::numeric, 3), v.route_id`,
    [since]
  );
  return rowCount;
};

const processHeatmapGeneration = async ({ type, hours }) => {
  const since = new Date(Date.now() - hours * 3600000).toISOString();
  const results = {};

  if (type === "STOP_DENSITY" || type === "ALL") {
    results.stop_density = await generateStopDensity(since);
  }
  if (type === "NGETEM_ZONE" || type === "ALL") {
    results.ngetem_zone = await generateNgetemZone(since);
  }
  if (type === "OFF_ROUTE_ZONE" || type === "ALL") {
    results.off_route_zone = await generateOffRouteZone(since);
  }
  if (type === "SPEED_ZONE" || type === "ALL") {
    results.speed_zone = await generateSpeedZone(since);
  }

  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      job: "heatmap-generation",
      type,
      hours,
      results,
    })
  );
  return results;
};

export const enqueueHeatmapGeneration = async (type = "ALL", hours = 24) => {
  const queue = getHeatmapQueue();
  if (!queue) return { queued: false, disabled: true };
  const job = await queue.add(
    "heatmap-manual",
    { type, hours },
    { removeOnComplete: 5, removeOnFail: 3 }
  );
  return { queued: true, jobId: job.id };
};

export const startHeatmapWorker = () => {
  if (process.env.HEATMAP_ENABLED === "false") {
    console.log("heatmap-generation worker disabled");
    return null;
  }
  const queue = getHeatmapQueue();
  if (!queue) return null;
  if (heatmapWorker)
    return { queue, worker: heatmapWorker };

  const workerConnection = createRedisConnection();

  heatmapWorker = new Worker(
    QUEUE_NAME,
    async (job) => processHeatmapGeneration(job.data),
    { connection: workerConnection, concurrency: 1 }
  );

  heatmapWorker.on("completed", (job, result) => {
    console.log(
      JSON.stringify({
        ts: new Date().toISOString(),
        job: job.name,
        result,
      })
    );
  });
  heatmapWorker.on("failed", (job, error) => {
    console.error(
      JSON.stringify({
        ts: new Date().toISOString(),
        job: job?.name || "heatmap-generation",
        error: error.message,
      })
    );
  });

  const schedule = () => {
    pool
      .query(
        `DELETE FROM heatmap_data WHERE created_at < now() - interval '2 hours'`
      )
      .then(() => processHeatmapGeneration({ type: "ALL", hours: 24 }))
      .catch((error) => {
        console.error(
          JSON.stringify({
            ts: new Date().toISOString(),
            job: "heatmap-schedule",
            error: error.message,
          })
        );
      });
  };

  schedule();
  scheduleTimer = setInterval(schedule, config.intervalMs);

  const shutdown = async () => {
    if (scheduleTimer) clearInterval(scheduleTimer);
    await Promise.allSettled([
      heatmapWorker?.close(),
      heatmapQueue?.close(),
      heatmapQueueConnection?.quit(),
      workerConnection.quit(),
    ]);
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return { queue, worker: heatmapWorker };
};
