const realtimeRoles = new Set(["OPERATOR", "ANALISA"]);

const getAccessTokenFromRequest = (req, parseCookies) => {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.replace("Bearer ", "");
  const cookies = parseCookies(req.headers.cookie || "");
  return cookies.sentra_access;
};

const sendJson = (ws, payload) => {
  ws.send(JSON.stringify(payload));
};

export const createRealtimeConnectionHandler = ({
  safeCorsOrigins,
  parseCookies,
  verifyToken,
  createRealtimeFilters,
  getPassengerLocationAccessPolicy,
  auditLog,
  fetchNotifications,
  fetchUnreadNotificationCount,
  notificationWindowMs,
  isClientOpen = (client) => client.readyState === 1,
  now = () => new Date()
}) => (ws, req) => {
  const origin = req.headers.origin;
  if (origin && !safeCorsOrigins.includes(origin)) {
    ws.close(1008, "Origin not allowed");
    return;
  }

  const wsUrl = new URL(req.url, "http://localhost");
  const queryToken = wsUrl.searchParams.get("token");
  const token = queryToken || getAccessTokenFromRequest(req, parseCookies);
  if (!token) {
    ws.close(1008, "Unauthorized");
    return;
  }

  try {
    const user = verifyToken(token);
    const roles = user?.roles || [];
    if (!roles.some((role) => realtimeRoles.has(role))) {
      ws.close(1008, "Forbidden");
      return;
    }
    ws.user = user;
  } catch {
    ws.close(1008, "Unauthorized");
    return;
  }

  const realtimeFilters = createRealtimeFilters(wsUrl.searchParams);
  if (realtimeFilters.error) {
    ws.close(1008, "Invalid bbox");
    return;
  }
  ws.filters = realtimeFilters.filters;

  const passengerPolicy = getPassengerLocationAccessPolicy(ws.user, ws.filters);
  void auditLog({ user: ws.user, ip: req.socket.remoteAddress, headers: req.headers }, {
    action: passengerPolicy.allowed ? "PASSENGER_REALTIME_SUBSCRIBE" : "PASSENGER_REALTIME_SUBSCRIBE_DENIED",
    entityType: "PASSENGER_POSITION",
    metadata: passengerPolicy
  });

  const connectedAt = now();
  ws.lastNotificationAt = new Date(connectedAt.getTime() - notificationWindowMs).toISOString();

  sendJson(ws, { type: "HELLO", ts: connectedAt.toISOString() });
  Promise.all([
    fetchNotifications({ limit: 10 }),
    fetchUnreadNotificationCount()
  ]).then(([notifications, unread]) => {
    if (isClientOpen(ws)) {
      sendJson(ws, { type: "NOTIFICATION_LIST", notifications, unread });
    }
  }).catch(() => {
    if (isClientOpen(ws)) {
      sendJson(ws, { type: "ERROR", message: "Notification fetch failed" });
    }
  });
};
