import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRealtimeConnectionHandler } from "../src/realtime-connection.js";
import { createRealtimeFilters } from "../src/realtime-feed.js";

const parseCookies = (header = "") =>
  header.split(";").reduce((acc, part) => {
    const [key, ...rest] = part.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});

const createSocket = () => ({
  readyState: 1,
  closed: null,
  sent: [],
  close(code, reason) {
    this.closed = { code, reason };
  },
  send(message) {
    this.sent.push(JSON.parse(message));
  }
});

const createRequest = ({ url = "/realtime", origin = "http://localhost:3000", cookie = "", authorization = "" } = {}) => ({
  url,
  headers: {
    origin,
    cookie,
    authorization
  },
  socket: {
    remoteAddress: "127.0.0.1"
  }
});

const waitForInitialNotifications = () => new Promise((resolve) => setImmediate(resolve));

describe("api-gateway realtime connection handler", () => {
  it("accepts an authorized realtime connection and sends initial state", async () => {
    const auditEvents = [];
    const ws = createSocket();
    const req = createRequest({
      url: "/realtime?token=query-token&route_id=01&vehicle_status=IN_SERVICE&bbox=106.70,-6.70,106.90,-6.50",
      authorization: "Bearer ignored-header-token"
    });

    const handleConnection = createRealtimeConnectionHandler({
      safeCorsOrigins: ["http://localhost:3000"],
      parseCookies,
      verifyToken: (token) => {
        assert.equal(token, "query-token");
        return { user_id: "operator-01", roles: ["OPERATOR"] };
      },
      createRealtimeFilters,
      getPassengerLocationAccessPolicy: () => ({ allowed: true, scope_type: "ROUTE", route_id: "01" }),
      auditLog: async (_req, event) => {
        auditEvents.push(event);
      },
      fetchNotifications: async (args) => {
        assert.deepEqual(args, { limit: 10 });
        return [{ notification_id: "notification-01" }];
      },
      fetchUnreadNotificationCount: async () => 3,
      notificationWindowMs: 5 * 60 * 1000,
      isClientOpen: (client) => client.readyState === 1,
      now: () => new Date("2026-06-30T00:10:00.000Z")
    });

    handleConnection(ws, req);
    await waitForInitialNotifications();

    assert.equal(ws.closed, null);
    assert.deepEqual(ws.user, { user_id: "operator-01", roles: ["OPERATOR"] });
    assert.deepEqual(ws.filters, {
      route_id: "01",
      bbox: { minLon: 106.7, minLat: -6.7, maxLon: 106.9, maxLat: -6.5 },
      vehicle_status: "IN_SERVICE",
      incident_status: null,
      incident_severity: null,
      incident_type: null
    });
    assert.equal(ws.lastNotificationAt, "2026-06-30T00:05:00.000Z");
    assert.deepEqual(ws.sent, [
      { type: "HELLO", ts: "2026-06-30T00:10:00.000Z" },
      { type: "NOTIFICATION_LIST", notifications: [{ notification_id: "notification-01" }], unread: 3 }
    ]);
    assert.deepEqual(auditEvents, [{
      action: "PASSENGER_REALTIME_SUBSCRIBE",
      entityType: "PASSENGER_POSITION",
      metadata: { allowed: true, scope_type: "ROUTE", route_id: "01" }
    }]);
  });

  it("rejects unsafe origins, missing auth, forbidden roles, and invalid filters", () => {
    const handleConnection = createRealtimeConnectionHandler({
      safeCorsOrigins: ["http://localhost:3000"],
      parseCookies,
      verifyToken: (token) => token === "forbidden-token"
        ? { user_id: "viewer-01", roles: ["PUBLIC"] }
        : { user_id: "operator-01", roles: ["OPERATOR"] },
      createRealtimeFilters,
      getPassengerLocationAccessPolicy: () => ({ allowed: true }),
      auditLog: async () => {},
      fetchNotifications: async () => [],
      fetchUnreadNotificationCount: async () => 0,
      notificationWindowMs: 5 * 60 * 1000,
      isClientOpen: (client) => client.readyState === 1,
      now: () => new Date("2026-06-30T00:10:00.000Z")
    });

    const unsafeOrigin = createSocket();
    handleConnection(unsafeOrigin, createRequest({ origin: "https://evil.example" }));
    assert.deepEqual(unsafeOrigin.closed, { code: 1008, reason: "Origin not allowed" });

    const missingAuth = createSocket();
    handleConnection(missingAuth, createRequest());
    assert.deepEqual(missingAuth.closed, { code: 1008, reason: "Unauthorized" });

    const forbidden = createSocket();
    handleConnection(forbidden, createRequest({ url: "/realtime?token=forbidden-token" }));
    assert.deepEqual(forbidden.closed, { code: 1008, reason: "Forbidden" });

    const invalidFilter = createSocket();
    handleConnection(invalidFilter, createRequest({ url: "/realtime?token=allowed-token&bbox=106.90,-6.50,106.70,-6.70" }));
    assert.deepEqual(invalidFilter.closed, { code: 1008, reason: "Invalid bbox" });
  });
});
