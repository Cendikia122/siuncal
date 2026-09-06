/**
 * Console notification channel — logs all notifications to stdout.
 * Used as fallback/default when no external provider is configured.
 */
export async function sendViaConsole(notification, incident) {
  console.log(
    JSON.stringify({
      channel: "console",
      ts: new Date().toISOString(),
      notification: {
        id: notification.notification_id,
        userId: notification.user_id,
        title: notification.title,
        body: notification.body,
        type: notification.notification_type,
      },
      incident: incident
        ? {
            id: incident.incident_id,
            type: incident.type,
            severity: incident.severity,
            status: incident.status,
            vehicleId: incident.vehicle_id,
          }
        : null,
    })
  );
  return { success: true, channel: "console" };
}
