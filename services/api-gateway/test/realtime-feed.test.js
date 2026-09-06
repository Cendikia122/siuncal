import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createRealtimeFilters,
  createRealtimePayloads,
  filterRealtimeIncidents,
  realtimePassengerScopeKey,
  realtimeVehicleScopeKey
} from "../src/realtime-feed.js";

describe("realtime feed filters", () => {
  it("accepts valid scoped reads and rejects invalid viewport bbox", () => {
    const valid = createRealtimeFilters(new URLSearchParams({
      route_id: "02",
      vehicle_status: "IN_SERVICE",
      incident_status: "OPEN",
      bbox: "106.70,-6.70,106.90,-6.50"
    }));

    assert.deepEqual(valid, {
      filters: {
        route_id: "02",
        vehicle_status: "IN_SERVICE",
        incident_status: "OPEN",
        incident_severity: null,
        incident_type: null,
        bbox: {
          minLon: 106.70,
          minLat: -6.70,
          maxLon: 106.90,
          maxLat: -6.50
        }
      }
    });
    assert.equal(
      realtimeVehicleScopeKey(valid.filters),
      JSON.stringify({
        route_id: "02",
        vehicle_status: "IN_SERVICE",
        bbox: valid.filters.bbox
      })
    );
    assert.equal(
      realtimePassengerScopeKey(valid.filters),
      JSON.stringify({
        route_id: "02",
        bbox: valid.filters.bbox
      })
    );

    const invalid = createRealtimeFilters(new URLSearchParams({
      bbox: "106.90,-6.50,106.70,-6.70"
    }));

    assert.deepEqual(invalid, {
      error: "bbox di luar rentang koordinat yang valid"
    });
  });

  it("keeps realtime payload names stable while filtering incident scope", () => {
    const incidents = [
      { id: "incident-01", route_id: "01", status: "OPEN", severity: "HIGH", type: "NGETEM" },
      { id: "incident-02", route_id: "02", status: "OPEN", severity: "CRITICAL", type: "OFF_ROUTE" },
      { id: "incident-03", route_id: "02", status: "RESOLVED", severity: "LOW", type: "NGETEM" }
    ];

    const filters = {
      route_id: "02",
      incident_status: "OPEN",
      incident_severity: "CRITICAL",
      incident_type: "OFF_ROUTE"
    };

    const scopedIncidents = filterRealtimeIncidents(incidents, filters);

    assert.deepEqual(scopedIncidents, [incidents[1]]);
    assert.deepEqual(createRealtimePayloads({
      vehicles: [{ vehicle_id: "vehicle-01" }],
      passengers: [{ user_id: "passenger-01" }],
      incidents: scopedIncidents
    }), [
      { type: "VEHICLE_LATEST", vehicles: [{ vehicle_id: "vehicle-01" }] },
      { type: "PASSENGER_LATEST", passengers: [{ user_id: "passenger-01" }] },
      { type: "EVENT_NEW", incidents: [incidents[1]] }
    ]);
  });
});
