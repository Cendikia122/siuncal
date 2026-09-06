import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildRealtimeFeedUrl } from "./realtime-feed.ts"

describe("operator realtime feed", () => {
  it("builds websocket URLs with the dashboard scope filters", () => {
    assert.equal(
      buildRealtimeFeedUrl("ws://localhost:4000/realtime", {
        routeId: "02",
        vehicleStatus: "IN_SERVICE",
        bbox: "106.70,-6.70,106.90,-6.50"
      }),
      "ws://localhost:4000/realtime?route_id=02&vehicle_status=IN_SERVICE&bbox=106.70%2C-6.70%2C106.90%2C-6.50"
    )

    assert.equal(
      buildRealtimeFeedUrl("ws://localhost:4000/realtime", {
        incidentStatus: "OPEN",
        incidentSeverity: "CRITICAL",
        incidentType: "OFF_ROUTE"
      }),
      "ws://localhost:4000/realtime?incident_status=OPEN&incident_severity=CRITICAL&incident_type=OFF_ROUTE"
    )
  })
})
