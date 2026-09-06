import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { createOwnerListScope, createVehicleListScope } from "../src/dashboard-list-scope.js";
import { deviceSchema, driverSchema, geofenceSchema, ownerSchema } from "../src/validation.js";

const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

test("owner schema preserves nested base payload used by operator web", () => {
  const result = ownerSchema.safeParse({
    owner_type: "PERSONAL",
    name: "Pemilik Demo",
    phone_primary: "081234567890",
    email: null,
    base: { name: "Jalan Raya Bogor", lat: null, lon: null }
  });

  assert.equal(result.success, true);
  assert.deepEqual(result.data.base, { name: "Jalan Raya Bogor", lat: null, lon: null });
});

test("driver schema accepts operator web sim_expiry payload and optional phone", () => {
  const result = driverSchema.safeParse({
    name: "Driver Demo",
    phone: "",
    sim_no: "SIM-123",
    sim_expiry: "2026-12-31"
  });

  assert.equal(result.success, true);
  assert.equal(result.data.phone, undefined);
  assert.equal(result.data.sim_expiry, "2026-12-31");
});

test("device schema accepts status while default remains handled by API", () => {
  const result = deviceSchema.safeParse({
    device_type: "GPS_IOT",
    imei_or_serial: "86753090001",
    provider: "DemoTel",
    status: "ACTIVE"
  });

  assert.equal(result.success, true);
  assert.equal(result.data.status, "ACTIVE");
});

test("geofence schema rejects OTHER and accepts only backend-supported types", () => {
  const base = { name: "Terminal Demo", route_id: null, coordinates: { type: "Polygon", coordinates: [] } };

  assert.equal(geofenceSchema.safeParse({ ...base, type: "OTHER" }).success, false);
  assert.equal(geofenceSchema.safeParse({ ...base, type: "DANGER_ZONE" }).success, true);
});

test("route deletion checks vehicle usage before deleting route stops", () => {
  assert.match(server, /ROUTE_HAS_VEHICLES/);
  assert.match(server, /COUNT\(v\.vehicle_id\)::int AS vehicle_count/);
  assert.match(server, /if \(routeUsage\.rows\[0\]\.vehicle_count > 0\)/);

  const vehicleUsageIndex = server.indexOf("COUNT(v.vehicle_id)::int AS vehicle_count");
  const deleteStopsIndex = server.indexOf("DELETE FROM route_stops WHERE route_id = $1", vehicleUsageIndex);
  assert.ok(vehicleUsageIndex >= 0);
  assert.ok(deleteStopsIndex > vehicleUsageIndex);
});

test("vehicle and owner list endpoints support opt-in server-side filtering and pagination", () => {
  assert.match(server, /app\.get\("\/vehicles", auth, requireOperatorDashboardRole/);
  assert.match(server, /app\.get\("\/owners", auth, requireOperatorDashboardRole/);

  const vehicleScope = createVehicleListScope({
    route_id: "R-01",
    owner_id: "owner-1",
    status: "in_service",
    page: "2",
    limit: "15"
  });
  assert.equal(vehicleScope.whereClause, "WHERE v.route_id = $1 AND v.status = $2 AND v.owner_id = $3");
  assert.equal(vehicleScope.paginationClause, "LIMIT $4 OFFSET $5");
  assert.deepEqual(vehicleScope.params, ["R-01", "IN_SERVICE", "owner-1", 15, 15]);
  assert.equal(vehicleScope.hasPagination, true);

  const ownerScope = createOwnerListScope(
    { search: "0812", owner_type: "koperasi", status: "active", page: "3", limit: "25" },
    { canViewSensitiveOwnerData: true }
  );
  assert.match(ownerScope.whereClause, /LOWER\(COALESCE\(o\.phone_primary, ''\)\) LIKE \$1/);
  assert.equal(ownerScope.paginationClause, "LIMIT $4 OFFSET $5");
  assert.deepEqual(ownerScope.params, ["%0812%", "KOPERASI", "ACTIVE", 25, 50]);
  assert.equal(ownerScope.hasPagination, true);
});
