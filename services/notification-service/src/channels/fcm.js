/**
 * FCM (Firebase Cloud Messaging) notification channel.
 *
 * Prerequisites:
 *   1. Create a Firebase project and download service-account key as JSON.
 *   2. Set FCM_SERVICE_ACCOUNT_PATH env var to the JSON file path.
 *   3. Each user must have a device token stored (e.g. in user_devices table).
 *
 * TODO: Integrate firebase-admin when credentials are available.
 *   import admin from "firebase-admin";
 *
 *   const app = admin.initializeApp({
 *     credential: admin.credential.applicationDefault(),
 *   });
 *
 *   const response = await app.messaging().sendEachForMulticast({
 *     tokens: deviceTokens,
 *     notification: { title, body },
 *     data: { incident_id, type },
 *   });
 */

export async function sendViaFcm(notification, incident) {
  const serviceAccountPath = process.env.FCM_SERVICE_ACCOUNT_PATH;

  if (!serviceAccountPath) {
    console.warn(
      JSON.stringify({
        channel: "fcm",
        warning: "FCM not configured — set FCM_SERVICE_ACCOUNT_PATH",
        notificationId: notification.notification_id,
      })
    );
    return { success: false, channel: "fcm", skipped: true };
  }

  // Placeholder — replace with firebase-admin logic when ready.
  // Do not report success until a real FCM provider sends the message.
  console.warn(
    JSON.stringify({
      channel: "fcm",
      ts: new Date().toISOString(),
      warning: "FCM not implemented — firebase-admin SDK not yet loaded",
      notificationId: notification.notification_id,
    })
  );

  return { success: false, channel: "fcm", skipped: true, reason: "FCM_NOT_IMPLEMENTED" };
}
