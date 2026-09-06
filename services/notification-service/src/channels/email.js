import { createTransport } from "nodemailer";

/**
 * SMTP email notification channel.
 *
 * Configure via env vars:
 *   SMTP_HOST=smtp.example.com
 *   SMTP_PORT=587
 *   SMTP_USER=notifications@example.com
 *   SMTP_PASS=********
 *   SMTP_FROM="Sentra Notifikasi <notifications@sentra.go.id>"
 *   NOTIFICATION_EMAIL_TO=operator@dishub.go.id
 */

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  transporter = createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

export async function sendViaEmail(notification, incident) {
  const t = getTransporter();
  if (!t) {
    console.warn(
      JSON.stringify({
        channel: "email",
        warning: "SMTP not configured — set SMTP_HOST",
        notificationId: notification.notification_id,
      })
    );
    return { success: false, channel: "email", skipped: true };
  }

  const to = process.env.NOTIFICATION_EMAIL_TO;
  if (!to) {
    console.warn(
      JSON.stringify({
        channel: "email",
        warning: "NOTIFICATION_EMAIL_TO not set",
        notificationId: notification.notification_id,
      })
    );
    return { success: false, channel: "email", skipped: true };
  }

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "sentra@localhost",
      to,
      subject: `[Sentra] ${notification.title}`,
      text: `${notification.body}\n\n— Sentra Monitoring Angkot Bogor`,
      html: `<p>${notification.body}</p><hr/><small>Sentra — Monitoring Angkot Bogor</small>`,
    });

    console.log(
      JSON.stringify({
        channel: "email",
        ts: new Date().toISOString(),
        to,
        subject: notification.title,
        notificationId: notification.notification_id,
      })
    );

    return { success: true, channel: "email" };
  } catch (err) {
    console.error(
      JSON.stringify({
        channel: "email",
        error: err.message,
        notificationId: notification.notification_id,
      })
    );
    return { success: false, channel: "email", error: err.message };
  }
}

export async function sendAccountEmail(email) {
  const t = getTransporter();
  if (!t) return { success: false, channel: "email", skipped: true };

  const token = email.payload?.token || "";
  const publicBaseUrl = process.env.PUBLIC_APP_URL || "https://sentra.example.go.id";
  const isVerification = email.template === "VERIFY_EMAIL";
  const isPasswordReset = email.template === "RESET_PASSWORD";
  if (!isVerification && !isPasswordReset) {
    return { success: false, channel: "email", skipped: true };
  }
  const actionUrl = isVerification
    ? `${publicBaseUrl}/verify-email?token=${encodeURIComponent(token)}`
    : `${publicBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
  const subject = isVerification ? "Verifikasi email Sentra Angkot" : "Reset password Sentra Angkot";
  const action = isVerification ? "verifikasi email" : "reset password";

  try {
    await t.sendMail({
      from: process.env.SMTP_FROM || "sentra@localhost",
      to: email.recipient,
      subject,
      text: `Gunakan tautan berikut untuk ${action}: ${actionUrl}`,
      html: `<p>Gunakan tautan berikut untuk ${action}:</p><p><a href="${actionUrl}">${actionUrl}</a></p>`,
    });
    return { success: true, channel: "email" };
  } catch (err) {
    return { success: false, channel: "email", error: err.message };
  }
}
