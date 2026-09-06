import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { chunkArray, groupRowsByVehicle, runWithConcurrency } from "../src/rules-runtime.js";

describe("rules runtime orchestration helpers", () => {
  it("chunks items deterministically using a minimum chunk size of one", () => {
    assert.deepEqual(chunkArray([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    assert.deepEqual(chunkArray([1, 2, 3], 0), [[1], [2], [3]]);
  });

  it("groups query rows by vehicle id while preserving row order", () => {
    const grouped = groupRowsByVehicle([
      { vehicle_id: "vehicle-01", ts: "2026-01-01T00:02:00.000Z" },
      { vehicle_id: "vehicle-02", ts: "2026-01-01T00:01:00.000Z" },
      { vehicle_id: "vehicle-01", ts: "2026-01-01T00:00:00.000Z" }
    ]);

    assert.deepEqual(grouped.get("vehicle-01").map((row) => row.ts), [
      "2026-01-01T00:02:00.000Z",
      "2026-01-01T00:00:00.000Z"
    ]);
    assert.deepEqual(grouped.get("vehicle-02").map((row) => row.ts), ["2026-01-01T00:01:00.000Z"]);
  });

  it("runs every item once while respecting the requested concurrency cap", async () => {
    const processed = [];
    let active = 0;
    let maxActive = 0;

    await runWithConcurrency([1, 2, 3, 4], 2, async (item) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      processed.push(item);
      active -= 1;
    });

    assert.deepEqual([...processed].sort((a, b) => a - b), [1, 2, 3, 4]);
    assert.equal(maxActive, 2);
  });
});
