import dotenv from "dotenv";
import http from "http";
import pg from "pg";

import { sendViaConsole } from "./channels/console.js";
import { sendViaFcm } from "./channels/fcm.js";
import { sendAccountEmail, sendViaEmail } from "./channels/email.js";

dotenv.config();

const { Pool } = pg;

const parseBooleanEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const usesPgBouncer = Boolean(process.env.PGBOUNCER_HOST);
const dbSslEnabled = process.env.DB_SSL !== undefined
  ? parseBooleanEnv(process.env.DB_SSL, false)
  : ["production", "staging"].includes(process.env.NODE_ENV) && !usesPgBouncer;

// --- HIGH-06: Validate DB credentials in production ---
if (["production", "staging"].includes(process.env.NODE_ENV) && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
  throw new Error("FATAL: DB_USER and DB_PASSWORD must be set in production/staging");
}

const pool = new Pool({
  host: process.env.PGBOUNCER_HOST || process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.PGBOUNCER_PORT || process.env.DB_PORT || 5432),
  user: process.env.DB_USER || "monitoring",
  password: process.env.DB_PASSWORD || "monitoring",
  database: process.env.DB_NAME || "Sentra",
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: Number(process.env.DB_POOL_MAX || 10),
  ...(dbSslEnabled ? { ssl: { rejectUnauthorized: true } } : {}),
});

const intervalMs = Number(process.env.POLL_INTERVAL_MS || 15000);
const healthPort = Number(process.env.HEALTH_PORT || 4101);

const query = (text, params) => pool.query(text, params);

const healthServer = http.createServer(async (_req, res) => {
  try {
    await query("SELECT 1");
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "notification-service" }));
  } catch (error) {
    res.writeHead(503, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: false, service: "notification-service", error: "db_unreachable" }));
  }
});

healthServer.listen(healthPort, () => {
  console.log(`notification-service health listening on http://localhost:${healthPort}/health`);
});

// ---------------------------------------------------------------------------
// Channel router — maps channel name to sender function
// ---------------------------------------------------------------------------

const CHANNELS = {
  CONSOLE: sendViaConsole,
  FCM: sendViaFcm,
  EMAIL: sendViaEmail,
};

const getActiveChannels = () => {
  const channels = ["CONSOLE"];
  if (process.env.SMTP_HOST && process.env.NOTIFICATION_EMAIL_TO) channels.push("EMAIL");
  if (process.env.FCM_ENABLED === "true" && process.env.FCM_IMPLEMENTED === "true") channels.push("FCM");
  return channels;
};

const normalizeNotification = (notification) => {
  const payload = notification.payload || {};
  const incidentType = notification.type || payload.type || payload.rule || "INCIDENT";
  const severity = notification.severity || payload.severity || "INFO";
  const title = payload.title || `Insiden ${incidentType}`;
  const body = payload.body || payload.message || `Insiden ${incidentType} severity ${severity}`;
  return {
    ...notification,
    payload,
    title,
    body,
    notification_type: payload.notification_type || payload.type || incidentType,
  };
};

async function sendViaChannel(notif, incident) {
  const channelKey = (notif.channel || "CONSOLE").toUpperCase();
  const sender = CHANNELS[channelKey] || CHANNELS.CONSOLE;
  return sender(notif, incident);
}

// ---------------------------------------------------------------------------
// Database queries
// ---------------------------------------------------------------------------

const fetchPending = async () => {
  const { rows } = await query(
    `SELECT n.notification_id, n.incident_id, n.channel, n.payload,
            i.type, i.severity, i.status, i.vehicle_id
     FROM notifications n
     LEFT JOIN incidents i ON i.incident_id = n.incident_id
     WHERE n.status = 'PENDING'
     ORDER BY n.created_at ASC
     LIMIT 20`
  );
  return rows;
};

const markSent = async (id) => {
  await query("UPDATE notifications SET status = 'SENT' WHERE notification_id = $1", [id]);
};

const markSkipped = async (id) => {
  await query("UPDATE notifications SET status = 'SKIPPED' WHERE notification_id = $1", [id]);
};

const fetchPendingAccountEmails = async () => {
  const { rows } = await query(
    `SELECT email_id, recipient, template, payload
     FROM account_email_outbox
     WHERE status = 'PENDING'
     ORDER BY created_at ASC
     LIMIT 20`
  );
  return rows;
};

const markAccountEmailSent = async (id) => {
  await query("UPDATE account_email_outbox SET status = 'SENT', sent_at = now() WHERE email_id = $1", [id]);
};

const createNotificationsForNewIncidents = async () => {
  // Create notifications only for configured channels. CONSOLE is always active.
  const activeChannels = getActiveChannels();

  for (const channel of activeChannels) {
    await query(
      `INSERT INTO notifications (incident_id, channel, status, payload)
       SELECT i.incident_id, $1, 'PENDING',
              jsonb_build_object('message', concat('Insiden ', i.type, ' severity ', i.severity))
       FROM incidents i
       WHERE i.status IN ('OPEN', 'IN_PROGRESS')
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.incident_id = i.incident_id AND n.channel = $1
         )`,
      [channel]
    );
  }
};

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const loop = async () => {
  try {
    await createNotificationsForNewIncidents();
    const pending = await fetchPending();
    for (const rawNotif of pending) {
      const notif = normalizeNotification(rawNotif);
      const result = await sendViaChannel(notif, {
        incident_id: notif.incident_id,
        type: notif.type,
        severity: notif.severity,
        status: notif.status,
        vehicle_id: notif.vehicle_id,
      });
      if (result.success) {
        await markSent(notif.notification_id);
      } else if (result.skipped) {
        await markSkipped(notif.notification_id);
      }
    }
    const accountEmails = await fetchPendingAccountEmails();
    for (const email of accountEmails) {
      const result = await sendAccountEmail(email);
      if (result.success) await markAccountEmailSent(email.email_id);
    }
  } catch (error) {
    console.error("notification-service error", error);
  } finally {
    setTimeout(loop, intervalMs);
  }
};

console.log("notification-service started with channels:", getActiveChannels().join(", "));
loop();
