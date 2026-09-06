import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildDemoFleetVehicles,
  demoImeiOrSerial,
  demoPlateNo,
  demoVehicleCode
} from "../apps/operator-web/src/lib/demo-scenario.mjs";

describe("demo scenario vehicle identity", () => {
  it("matches the deterministic seed fleet identity format", () => {
    assert.equal(demoPlateNo("01", 1), "F 1901 AK");
    assert.equal(demoPlateNo("02", 1), "F 2001 SB");
    assert.equal(demoPlateNo("03", 1), "F 3001 BB");
    assert.equal(demoVehicleCode("01", 1), "01-DEMO-001");
    assert.equal(demoImeiOrSerial("02", 15), "86753090215");
  });

  it("builds 45 route-scoped simulator vehicles by default", () => {
    const vehicles = buildDemoFleetVehicles({
      routesById: {
        "01": [{ lat: -6.1, lon: 106.1, heading: 90 }],
        "02": [{ lat: -6.2, lon: 106.2, heading: 180 }],
        "03": [{ lat: -6.3, lon: 106.3, heading: 270 }]
      }
    });

    assert.equal(vehicles.length, 45);
    assert.deepEqual(vehicles.slice(0, 2).map((vehicle) => vehicle.plate_no), ["F 1901 AK", "F 1902 AK"]);
    assert.equal(vehicles[15].plate_no, "F 2001 SB");
    assert.equal(vehicles[30].plate_no, "F 3001 BB");
  });
});
