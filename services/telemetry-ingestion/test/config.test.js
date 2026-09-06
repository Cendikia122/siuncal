import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

describe("vehicle telemetry simulator interval", () => {
  it("defaults to the 5 second pilot GPS interval end to end", async () => {
    delete process.env.INTERVAL_MS;
    const { CONFIG } = await import("../config.js?pilot-interval-default");
    const compose = readFileSync(new URL("../../../infra/docker-compose/docker-compose.yml", import.meta.url), "utf8");

    assert.equal(CONFIG.INTERVAL_MS, 5000);
    assert.match(compose, /INTERVAL_MS:\s*\$\{SIMULATOR_INTERVAL_MS:-5000\}/);
  });
});
