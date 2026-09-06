export const createRealtimeBroadcaster = ({
  instanceId = "local",
  fetchOpenIncidents,
  fetchUnreadNotificationCount,
  fetchNotifications,
  fetchLatestVehicles,
  fetchLatestPassengers,
  getPassengerLocationAccessPolicy,
  serializePassengerForPrincipal,
  filterRealtimeIncidents,
  createRealtimePayloads,
  realtimeVehicleScopeKey,
  realtimePassengerScopeKey,
  publishRealtimeMessage = null,
  isClientOpen = (client) => client.readyState === 1,
  nowIso = () => new Date().toISOString()
}) => {
  const sendJson = (client, payload) => {
    client.send(JSON.stringify(payload));
  };

  const publishTick = async () => {
    if (!publishRealtimeMessage) return;
    try {
      await publishRealtimeMessage({
        type: "REALTIME_TICK",
        instanceId,
        publishedAt: nowIso()
      });
    } catch {
      // Local WebSocket delivery must keep working if Redis pub/sub is unavailable.
    }
  };

  const broadcastRealtimeTick = async (clients, { publish = true } = {}) => {
    const clientList = Array.from(clients);
    if (clientList.length === 0) return;

    try {
      const incidents = await fetchOpenIncidents();
      const unreadNotifications = await fetchUnreadNotificationCount();
      const notificationList = await fetchNotifications({ limit: 10 });
      const scopedVehicleCache = new Map();
      const scopedPassengerCache = new Map();

      const getScopedVehicles = async (filters) => {
        const key = realtimeVehicleScopeKey(filters);
        if (!scopedVehicleCache.has(key)) {
          scopedVehicleCache.set(key, await fetchLatestVehicles({
            routeId: filters.route_id,
            vehicleStatus: filters.vehicle_status,
            bbox: filters.bbox
          }));
        }
        return scopedVehicleCache.get(key);
      };

      const getScopedPassengers = async (filters) => {
        const key = realtimePassengerScopeKey(filters);
        if (!scopedPassengerCache.has(key)) {
          scopedPassengerCache.set(key, await fetchLatestPassengers({
            routeId: filters.route_id,
            bbox: filters.bbox
          }));
        }
        return scopedPassengerCache.get(key);
      };

      for (const client of clientList) {
        if (!isClientOpen(client)) continue;
        const filters = client.filters || {};
        const filteredVehicles = await getScopedVehicles(filters);
        const passengerPolicy = getPassengerLocationAccessPolicy(client.user, filters);
        const passengers = passengerPolicy.allowed
          ? (await getScopedPassengers(filters)).map((passenger) => serializePassengerForPrincipal(passenger, client.user))
          : [];
        if (!isClientOpen(client)) continue;

        const filteredIncidents = filterRealtimeIncidents(incidents, filters);
        for (const payload of createRealtimePayloads({ vehicles: filteredVehicles, passengers, incidents: filteredIncidents })) {
          sendJson(client, payload);
        }
        try {
          const notifications = await fetchNotifications({ limit: 10, since: client.lastNotificationAt });
          client.lastNotificationAt = nowIso();
          sendJson(client, { type: "NOTIFICATION_LIST", notifications: notificationList, unread: unreadNotifications });
          if (notifications.length > 0) {
            sendJson(client, { type: "NOTIFICATION_NEW", notifications, unread: unreadNotifications });
          }
        } catch {
          sendJson(client, { type: "ERROR", message: "Notification fetch failed" });
        }
      }
      if (publish) await publishTick();
    } catch {
      for (const client of clientList) {
        if (isClientOpen(client)) {
          sendJson(client, { type: "ERROR", message: "Realtime fetch failed" });
        }
      }
    }
  };

  const handleRealtimePubSubMessage = async (message, clients) => {
    if (!message || message.type !== "REALTIME_TICK") return false;
    if (!message.instanceId || message.instanceId === instanceId) return false;

    await broadcastRealtimeTick(clients, { publish: false });
    return true;
  };

  return {
    broadcastRealtimeTick,
    handleRealtimePubSubMessage
  };
};
