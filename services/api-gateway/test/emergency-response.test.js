import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

import { buildEmergencyIncident, deriveEmergencyEscalation } from "../src/emergency-response.js";
import { driverPanicSchema, sosEmergencySchema } from "../src/validation.js";

const migration = readFileSync(
  new URL("../../../db/migrations/022_phase19_emergency_response.sql", import.meta.url),
  "utf8",
);
const bootstrap = readFileSync(
  new URL("../../../infra/docker-compose/initdb/001_bootstrap.sql", import.meta.url),
  "utf8",
);
const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

describe("api-gateway emergency response", () => {
  it("turns passenger SOS into a critical emergency incident with SLA and audit context", () => {
    const now = new Date("2026-07-01T10:00:00.000Z");

    const result = buildEmergencyIncident({
      source: "PASSENGER_APP",
      user: {
        user_id: "11111111-1111-4111-8111-111111111111",
        roles: ["PUBLIC_USER"],
      },
      body: {
        lat: -6.5944,
        lon: 106.7891,
        accuracy_m: 12,
        category: "SECURITY",
        message: "Penumpang merasa tidak aman di dalam angkot.",
        session_id: "22222222-2222-4222-8222-222222222222",
        vehicle_id: "33333333-3333-4333-8333-333333333333",
      },
      now,
      ackSlaSeconds: 60,
      assignmentSlaSeconds: 180,
    });

    assert.deepEqual(result.incident, {
      type: "EMERGENCY",
      severity: "CRITICAL",
      status: "OPEN",
      description: "SOS SECURITY: Penumpang merasa tidak aman di dalam angkot.",
      location_desc: "SOS penumpang",
      lat: -6.5944,
      lon: 106.7891,
      vehicle_id: "33333333-3333-4333-8333-333333333333",
      reporter_user_id: "11111111-1111-4111-8111-111111111111",
      reporter_session_id: "22222222-2222-4222-8222-222222222222",
      source: "PASSENGER_APP",
      emergency_category: "SECURITY",
      trust_level: "HIGH",
      escalation_state: "ON_TRACK",
      ack_due_at: "2026-07-01T10:01:00.000Z",
      assignment_due_at: "2026-07-01T10:03:00.000Z",
    });
    assert.deepEqual(result.action, {
      action: "SOS_RECEIVED",
      notes: "Passenger SOS received with trust HIGH",
      metadata: {
        source: "PASSENGER_APP",
        category: "SECURITY",
        accuracy_m: 12,
        trust_signal: "TRACKING_SESSION_MATCH",
        manual_override: false,
      },
    });
  });

  it("marks emergency acknowledge and assignment SLA breaches for escalation", () => {
    const createdAt = "2026-07-01T10:00:00.000Z";

    assert.deepEqual(
      deriveEmergencyEscalation({
        status: "OPEN",
        createdAt,
        now: new Date("2026-07-01T10:01:30.000Z"),
        ackSlaSeconds: 60,
        assignmentSlaSeconds: 180,
      }),
      { state: "ACK_OVERDUE", target: "SUPERVISOR", breached_seconds: 30 },
    );

    assert.deepEqual(
      deriveEmergencyEscalation({
        status: "IN_PROGRESS",
        createdAt,
        acknowledgedAt: "2026-07-01T10:00:45.000Z",
        now: new Date("2026-07-01T10:04:20.000Z"),
        ackSlaSeconds: 60,
        assignmentSlaSeconds: 180,
      }),
      { state: "ASSIGNMENT_OVERDUE", target: "KOORDINATOR_LAPANGAN", breached_seconds: 80 },
    );

    assert.deepEqual(
      deriveEmergencyEscalation({
        status: "RESOLVED",
        createdAt,
        resolvedAt: "2026-07-01T10:02:00.000Z",
        now: new Date("2026-07-01T10:05:00.000Z"),
      }),
      { state: "CLOSED", target: null, breached_seconds: 0 },
    );
  });

  it("adds the database contract required by the emergency workflow", () => {
    for (const column of [
      "reporter_user_id",
      "reporter_session_id",
      "source",
      "emergency_category",
      "trust_level",
      "escalation_state",
      "ack_due_at",
      "assignment_due_at",
    ]) {
      assert.match(migration, new RegExp(`ADD COLUMN IF NOT EXISTS ${column}`));
    }
    assert.match(migration, /ALTER TABLE incident_actions/);
    assert.match(migration, /ADD COLUMN IF NOT EXISTS metadata jsonb/);
    assert.match(migration, /idx_incidents_emergency_open/);
    assert.match(bootstrap, /022_phase19_emergency_response\.sql/);
  });

  it("validates passenger SOS and driver panic API payloads", () => {
    assert.equal(sosEmergencySchema.safeParse({
      lat: "-6.5944",
      lon: 106.7891,
      accuracy_m: "12",
      category: "SECURITY",
      message: "Penumpang merasa tidak aman di dalam angkot.",
      session_id: "22222222-2222-4222-8222-222222222222",
      vehicle_id: "33333333-3333-4333-8333-333333333333",
    }).success, true);

    assert.equal(sosEmergencySchema.safeParse({
      lat: -6.5944,
      lon: 106.7891,
      category: "SECURITY",
      message: "pendek",
    }).success, false);

    assert.equal(driverPanicSchema.safeParse({
      imei_or_serial: "86753090001",
      lat: -6.5944,
      lon: 106.7891,
      timestamp: "2026-07-01T10:00:00.000Z",
    }).success, true);
  });

  it("exposes emergency API routes and field-officer assignment workflow", () => {
    assert.match(server, /sosEmergencySchema/);
    assert.match(server, /driverPanicSchema/);
    assert.match(server, /app\.post\("\/me\/sos", auth, requireRole\(\["PUBLIC_USER"\]\), rateLimitEmergencySos, validate\(sosEmergencySchema\)/);
    assert.match(server, /app\.post\("\/telemetry\/driver-panic", rateLimitTelemetry, verifyTelemetryAuth, validate\(driverPanicSchema\)/);
    assert.match(server, /app\.get\("\/emergencies", auth, requireRole\(\["OPERATOR", "ANALISA", "PETUGAS_LAPANGAN"\]\)/);
    assert.match(server, /app\.post\("\/incidents\/:id\/proofs", auth, requireRole\(\["OPERATOR", "ANALISA", "PETUGAS_LAPANGAN"\]\), uploadEmergencyProof/);
    assert.match(server, /'PETUGAS_LAPANGAN' = ANY\(roles\)/);
    assert.match(server, /PROOF_UPLOAD/);
  });
});
