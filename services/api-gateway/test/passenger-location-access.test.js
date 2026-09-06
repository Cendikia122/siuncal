import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createPassengerLocationAccess } from "../src/passenger-location-access.js";

const passenger = {
  user_id: "00000000-0000-0000-0000-000000000123",
  session_id: "session-01",
  name: "Real Passenger",
  email: "passenger@example.com",
  phone: "+628123456789",
  profile_photo_url: "https://example.com/photo.jpg",
  route_id: "01"
};

describe("api-gateway passenger location access", () => {
  it("requires a scoped operator read when configured", () => {
    const { getPassengerLocationAccessPolicy } = createPassengerLocationAccess({
      requireScopedOperatorAccess: true,
      maskOperatorIdentity: true
    });

    assert.deepEqual(
      getPassengerLocationAccessPolicy({ roles: ["OPERATOR"] }),
      {
        scope_type: "GLOBAL",
        route_id: null,
        bbox_provided: false,
        allowed: false,
        identity_access: "MASKED",
        scope_required: true
      }
    );

    assert.deepEqual(
      getPassengerLocationAccessPolicy({ roles: ["OPERATOR"] }, { route_id: "01" }),
      {
        scope_type: "ROUTE",
        route_id: "01",
        bbox_provided: false,
        allowed: true,
        identity_access: "MASKED",
        scope_required: true
      }
    );

    assert.deepEqual(
      getPassengerLocationAccessPolicy({ roles: ["OPERATOR"] }, { bbox: { minLon: 106.7, minLat: -6.7, maxLon: 106.9, maxLat: -6.5 } }),
      {
        scope_type: "BBOX",
        route_id: null,
        bbox_provided: true,
        allowed: true,
        identity_access: "MASKED",
        scope_required: true
      }
    );
  });

  it("masks passenger identity for operators but preserves analytics access", () => {
    const { serializePassengerForPrincipal } = createPassengerLocationAccess({
      requireScopedOperatorAccess: false,
      maskOperatorIdentity: true
    });

    const masked = serializePassengerForPrincipal(passenger, { roles: ["OPERATOR"] });
    assert.notEqual(masked.user_id, passenger.user_id);
    assert.match(masked.user_id, /^passenger-[0-9a-f]{10}$/);
    assert.match(masked.name, /^Passenger [0-9A-F]{4}$/);
    assert.equal(masked.session_id, null);
    assert.equal(masked.email, null);
    assert.equal(masked.phone, null);
    assert.equal(masked.profile_photo_url, null);
    assert.equal(masked.route_id, "01");

    assert.equal(
      serializePassengerForPrincipal(passenger, { roles: ["ANALISA"] }),
      passenger
    );
  });
});
