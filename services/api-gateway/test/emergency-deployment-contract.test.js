import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const runtimeScript = readFileSync(
  new URL("../../../scripts/apply-phase19-emergency-runtime.sh", import.meta.url),
  "utf8",
);
const emergencyRunbook = readFileSync(
  new URL("../../../docs/runbooks/emergency-drill.md", import.meta.url),
  "utf8",
);
const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");
const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

describe("Phase 19 emergency deployment discipline", () => {
  it("provides an explicit non-destructive runtime migration command for reused Docker volumes", () => {
    assert.match(runtimeScript, /022_phase19_emergency_response\.sql/);
    assert.match(runtimeScript, /ON_ERROR_STOP=1/);
    assert.match(runtimeScript, /psql -v ON_ERROR_STOP=1 -U "\$POSTGRES_USER" -d "\$POSTGRES_DB" "\$@"/);
    assert.match(runtimeScript, /escalation_state/);
    assert.match(runtimeScript, /incident_actions/);
    assert.doesNotMatch(runtimeScript, /down -v|TRUNCATE|DROP TABLE|RESTART IDENTITY/);
  });

  it("requires field-officer provisioning without silently seeding demo credentials in production", () => {
    assert.match(runtimeScript, /PETUGAS_LAPANGAN/);
    assert.match(runtimeScript, /SEED_DEMO_FIELD_OFFICER/);
    assert.match(runtimeScript, /lapangan@pemda\.go\.id/);
    assert.match(runtimeScript, /Field officer role missing/);
  });

  it("documents the pre-drill migration and role check for operators", () => {
    assert.match(emergencyRunbook, /apply-phase19-emergency-runtime\.sh/);
    assert.match(emergencyRunbook, /PETUGAS_LAPANGAN/);
    assert.match(readme, /Phase 19 emergency workflow tidak bisa login|Phase 19 emergency workflow gagal/);
    assert.match(readme, /apply-phase19-emergency-runtime\.sh/);
  });

  it("fails API startup clearly when reused volumes are missing Phase 19 columns", () => {
    assert.match(server, /requiredDemoColumns/);
    assert.match(server, /information_schema\.columns/);
    assert.match(server, /incidents[\s\S]*escalation_state/);
    assert.match(server, /incident_actions[\s\S]*metadata/);
    assert.match(server, /022_phase19_emergency_response\.sql/);
  });
});
