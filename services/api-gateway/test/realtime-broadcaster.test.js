import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRealtimeBroadcaster } from "../src/realtime-broadcaster.js";
import { createRealtimePayloads } from "../src/realtime-feed.js";

const createClient = ({ userId, filters, lastNotificationAt }) => ({
  readyState: 1,
  user: { user_id: userId },
  filters,
  lastNotificationAt,
  sent: [],
  send(message) {
    this.sent.push(JSON.parse(message));
  }
});

const createBroadcasterFixture = (overrides = {}) => createRealtimeBroadcaster({
  instanceId: "api-a",
  fetchOpenIncidents: async () => [],
  fetchUnreadNotificationCount: async () => 0,
  fetchNotifications: async () => [],
  fetchLatestVehicles: async () => [{ vehicle_id: "vehicle-01" }],
  fetchLatestPassengers: async () => [],
  getPassengerLocationAccessPolicy: () => ({ allowed: true }),
  serializePassengerForPrincipal: (passenger) => passenger,
  filterRealtimeIncidents: (incidents) => incidents,
  createRealtimePayloads,
  realtimeVehicleScopeKey: (scope) => JSON.stringify({
    route_id: scope.route_id,
    vehicle_status: scope.vehicle_status,
    bbox: scope.bbox
  }),
  realtimePassengerScopeKey: (scope) => JSON.stringify({
    route_id: scope.route_id,
    bbox: scope.bbox
  }),
  isClientOpen: (client) => client.readyState === 1,
  nowIso: () => "2026-06-30T00:05:00.000Z",
  ...overrides
});

describe("api-gateway realtime broadcaster", () => {
  it("broadcasts scoped realtime payloads and notifications while reusing per-scope queries", async () => {
    const calls = [];
    const bbox = { minLon: 106.7, minLat: -6.7, maxLon: 106.9, maxLat: -6.5 };
    const filters = { route_id: "01", vehicle_status: "IN_SERVICE", bbox };
    const clientA = createClient({ userId: "operator-01", filters, lastNotificationAt: "2026-06-30T00:00:00.000Z" });
    const clientB = createClient({ userId: "operator-02", filters, lastNotificationAt: "2026-06-30T00:01:00.000Z" });

    const { broadcastRealtimeTick } = createRealtimeBroadcaster({
      fetchOpenIncidents: async () => [{ id: "incident-01", route_id: "01", status: "OPEN" }],
      fetchUnreadNotificationCount: async () => 2,
      fetchNotifications: async (args) => {
        calls.push({ type: "notifications", args });
        return args.since ? [{ notification_id: `new-${args.since}` }] : [{ notification_id: "list-01" }];
      },
      fetchLatestVehicles: async (args) => {
        calls.push({ type: "vehicles", args });
        return [{ vehicle_id: "vehicle-01", route_id: "01" }];
      },
      fetchLatestPassengers: async (args) => {
        calls.push({ type: "passengers", args });
        return [{ user_id: "passenger-01", route_id: "01" }];
      },
      getPassengerLocationAccessPolicy: () => ({ allowed: true }),
      serializePassengerForPrincipal: (passenger, principal) => ({
        ...passenger,
        visible_to: principal.user_id
      }),
      filterRealtimeIncidents: (incidents, scope) => incidents.filter((incident) => incident.route_id === scope.route_id),
      createRealtimePayloads,
      realtimeVehicleScopeKey: (scope) => JSON.stringify({
        route_id: scope.route_id,
        vehicle_status: scope.vehicle_status,
        bbox: scope.bbox
      }),
      realtimePassengerScopeKey: (scope) => JSON.stringify({
        route_id: scope.route_id,
        bbox: scope.bbox
      }),
      isClientOpen: (client) => client.readyState === 1,
      nowIso: () => "2026-06-30T00:05:00.000Z"
    });

    await broadcastRealtimeTick(new Set([clientA, clientB]));

    assert.equal(calls.filter((call) => call.type === "vehicles").length, 1);
    assert.deepEqual(calls.find((call) => call.type === "vehicles").args, {
      routeId: "01",
      vehicleStatus: "IN_SERVICE",
      bbox
    });
    assert.equal(calls.filter((call) => call.type === "passengers").length, 1);
    assert.deepEqual(calls.find((call) => call.type === "passengers").args, {
      routeId: "01",
      bbox
    });
    assert.deepEqual(
      calls.filter((call) => call.type === "notifications").map((call) => call.args),
      [
        { limit: 10 },
        { limit: 10, since: "2026-06-30T00:00:00.000Z" },
        { limit: 10, since: "2026-06-30T00:01:00.000Z" }
      ]
    );

    for (const client of [clientA, clientB]) {
      assert.deepEqual(client.sent.map((payload) => payload.type), [
        "VEHICLE_LATEST",
        "PASSENGER_LATEST",
        "EVENT_NEW",
        "NOTIFICATION_LIST",
        "NOTIFICATION_NEW"
      ]);
      assert.equal(client.sent[1].passengers[0].visible_to, client.user.user_id);
      assert.deepEqual(client.sent[3], {
        type: "NOTIFICATION_LIST",
        notifications: [{ notification_id: "list-01" }],
        unread: 2
      });
      assert.equal(client.lastNotificationAt, "2026-06-30T00:05:00.000Z");
    }
  });

  it("publishes a Redis fan-out tick after local realtime broadcast", async () => {
    const published = [];
    const client = createClient({
      userId: "operator-01",
      filters: { route_id: "01" },
      lastNotificationAt: "2026-06-30T00:00:00.000Z"
    });

    const { broadcastRealtimeTick } = createBroadcasterFixture({
      publishRealtimeMessage: async (message) => {
        published.push(message);
      }
    });

    await broadcastRealtimeTick(new Set([client]));

    assert.deepEqual(published, [
      {
        type: "REALTIME_TICK",
        instanceId: "api-a",
        publishedAt: "2026-06-30T00:05:00.000Z"
      }
    ]);
  });

  it("handles remote Redis fan-out ticks without re-publishing or looping", async () => {
    const published = [];
    const client = createClient({
      userId: "operator-01",
      filters: { route_id: "01" },
      lastNotificationAt: "2026-06-30T00:00:00.000Z"
    });

    const { handleRealtimePubSubMessage } = createBroadcasterFixture({
      publishRealtimeMessage: async (message) => {
        published.push(message);
      }
    });

    assert.equal(await handleRealtimePubSubMessage({ type: "REALTIME_TICK", instanceId: "api-a" }, new Set([client])), false);
    assert.deepEqual(client.sent, []);

    assert.equal(await handleRealtimePubSubMessage({ type: "REALTIME_TICK", instanceId: "api-b" }, new Set([client])), true);

    assert.deepEqual(client.sent.map((payload) => payload.type), [
      "VEHICLE_LATEST",
      "PASSENGER_LATEST",
      "EVENT_NEW",
      "NOTIFICATION_LIST"
    ]);
    assert.deepEqual(published, []);
  });
});
