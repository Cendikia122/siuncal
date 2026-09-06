import dotenv from "dotenv";
import { pool, query } from "../db.js";

dotenv.config();

const getJakartaDateString = (date) => {
  const jakarta = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return jakarta.toISOString().slice(0, 10);
};

const inputDate = process.env.REPORT_DATE || process.argv[2] || null;
const defaultDate = getJakartaDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));
const reportDate = inputDate || defaultDate;
const reportStartAt = new Date(`${reportDate}T00:00:00+07:00`);
if (Number.isNaN(reportStartAt.getTime())) {
  console.error(`Invalid REPORT_DATE: ${reportDate}`);
  process.exit(1);
}
const reportEndAt = new Date(reportStartAt.getTime() + 24 * 60 * 60 * 1000);
const reportWindowParams = [reportDate, reportStartAt.toISOString(), reportEndAt.toISOString()];

const run = async () => {
  console.log(`Generating reports for ${reportDate} (${reportStartAt.toISOString()}..${reportEndAt.toISOString()})`);

  await query("BEGIN");

  try {
    await query("DELETE FROM report_rit_daily WHERE report_date = $1", [reportDate]);
    await query("DELETE FROM report_kpi_daily WHERE report_date = $1", [reportDate]);

    await query(
      `WITH positions AS (
          SELECT vp.vehicle_id, v.route_id, vp.ts, vp.status
          FROM vehicle_positions vp
          JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
          WHERE vp.ts >= $2::timestamptz
            AND vp.ts < $3::timestamptz
       ),
       ordered AS (
          SELECT vehicle_id, route_id, ts, status,
            LAG(status) OVER (PARTITION BY vehicle_id ORDER BY ts) AS prev_status
          FROM positions
       ),
       rit AS (
          SELECT vehicle_id, route_id,
            SUM(CASE WHEN status = 'IN_SERVICE' AND (prev_status IS NULL OR prev_status <> 'IN_SERVICE') THEN 1 ELSE 0 END)::int AS total_rit
          FROM ordered
          GROUP BY vehicle_id, route_id
       )
       INSERT INTO report_rit_daily (report_date, vehicle_id, total_rit)
       SELECT $1, vehicle_id, total_rit
       FROM rit`,
      reportWindowParams
    );

    await query(
      `WITH positions AS (
          SELECT vp.vehicle_id, v.route_id, vp.ts, vp.speed_kmh,
            ST_SetSRID(ST_MakePoint(vp.lon, vp.lat), 4326)::geography AS geom
          FROM vehicle_positions vp
          JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
          WHERE vp.ts >= $2::timestamptz
            AND vp.ts < $3::timestamptz
       ),
       route_geom AS (
          SELECT route_id,
            ST_Buffer(
              CASE
                WHEN inbound_geom IS NULL THEN outbound_geom
                WHEN outbound_geom IS NULL THEN inbound_geom
                ELSE ST_Union(outbound_geom, inbound_geom)
              END::geography,
              buffer_radius_m
            )::geography AS corridor
          FROM routes
       ),
       onroute AS (
          SELECT p.route_id,
            AVG(CASE WHEN rg.corridor IS NULL THEN 0
                WHEN ST_DWithin(p.geom, rg.corridor, 0) THEN 1 ELSE 0 END) * 100 AS on_route_pct,
            AVG(p.speed_kmh) AS avg_speed_kmh
          FROM positions p
          LEFT JOIN route_geom rg ON rg.route_id = p.route_id
          GROUP BY p.route_id
       ),
       idle AS (
          WITH ordered AS (
            SELECT p.vehicle_id, p.route_id, p.ts, p.speed_kmh,
              LEAD(p.ts) OVER (PARTITION BY p.vehicle_id ORDER BY p.ts) AS next_ts
            FROM positions p
          ),
          idle_per_vehicle AS (
            SELECT vehicle_id, route_id,
              SUM(CASE WHEN speed_kmh <= 2 AND next_ts IS NOT NULL THEN EXTRACT(EPOCH FROM next_ts - ts) ELSE 0 END) AS idle_sec
            FROM ordered
            GROUP BY vehicle_id, route_id
          )
          SELECT route_id, AVG(idle_sec) AS avg_idle_sec
          FROM idle_per_vehicle
          GROUP BY route_id
       ),
       incidents AS (
          SELECT v.route_id, COUNT(*)::int AS incident_count
          FROM incidents i
          LEFT JOIN vehicles v ON v.vehicle_id = i.vehicle_id
          WHERE i.created_at >= $2::timestamptz
            AND i.created_at < $3::timestamptz
          GROUP BY v.route_id
       ),
       rit_avg AS (
          SELECT v.route_id, AVG(r.total_rit)::numeric AS avg_rit
          FROM report_rit_daily r
          JOIN vehicles v ON v.vehicle_id = r.vehicle_id
          WHERE r.report_date = $1
          GROUP BY v.route_id
       )
       INSERT INTO report_kpi_daily (
          report_date, route_id, on_route_pct, avg_latency_sec, incident_count,
          avg_speed_kmh, avg_rit, avg_idle_sec
       )
       SELECT
          $1,
          r.route_id,
          COALESCE(o.on_route_pct, 0),
          0,
          COALESCE(i.incident_count, 0),
          COALESCE(o.avg_speed_kmh, 0),
          COALESCE(ra.avg_rit, 0),
          COALESCE(id.avg_idle_sec, 0)
       FROM routes r
       LEFT JOIN onroute o ON o.route_id = r.route_id
       LEFT JOIN idle id ON id.route_id = r.route_id
       LEFT JOIN incidents i ON i.route_id = r.route_id
       LEFT JOIN rit_avg ra ON ra.route_id = r.route_id`,
      reportWindowParams
    );

    await query("COMMIT");
    console.log("Reports generated.");
  } catch (error) {
    await query("ROLLBACK");
    console.error("Failed generating reports", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
};

run();
