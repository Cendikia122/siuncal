import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
const realtimeConnection = readFileSync(new URL("../src/realtime-connection.js", import.meta.url), "utf8");
const passengerLocationAccess = readFileSync(new URL("../src/passenger-location-access.js", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../../db/migrations/016_mobile_public_release.sql", import.meta.url),
  "utf8"
);

test("mobile public release migration adds account lifecycle, consent, and retention policy", () => {
  assert.match(migration, /email_verified_at/);
  assert.match(migration, /deleted_at/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS email_verification_tokens/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS password_reset_tokens/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS mobile_refresh_tokens/);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS passenger_tracking_consents/);
  assert.match(migration, /add_retention_policy\('passenger_positions', INTERVAL '30 days'/);
});

test("mobile lifecycle routes cover registration verification refresh logout and account deletion", () => {
  assert.match(server, /app\.post\("\/auth\/mobile\/register"/);
  assert.match(server, /app\.post\("\/auth\/mobile\/verify-email"/);
  assert.match(server, /app\.post\("\/auth\/mobile\/resend-verification"/);
  assert.match(server, /app\.post\("\/auth\/mobile\/forgot-password"/);
  assert.match(server, /app\.post\("\/auth\/mobile\/reset-password"/);
  assert.match(server, /app\.post\("\/auth\/mobile\/refresh"/);
  assert.match(server, /app\.post\("\/auth\/mobile\/logout"/);
  assert.match(server, /app\.delete\("\/me\/account"/);
  assert.match(server, /SELECT is_active FROM users WHERE user_id = \$1/);
});

test("passenger tracking is issued only after consent and can be revoked", () => {
  assert.match(server, /app\.post\("\/me\/passenger-tracking\/consent"/);
  assert.match(server, /app\.get\("\/me\/passenger-tracking\/status"/);
  assert.match(server, /app\.delete\("\/me\/passenger-tracking\/session"/);
  assert.match(server, /INSERT INTO passenger_tracking_consents/);
  assert.match(server, /UPDATE passenger_tracking_tokens SET revoked_at = now\(\)/);
});

test("operator passenger location access is masked and audited", () => {
  assert.match(server, /PASSENGER_LOCATION_MASK_OPERATOR_IDENTITY/);
  assert.match(server, /PASSENGER_LOCATION_REQUIRE_SCOPE_FOR_OPERATOR/);
  assert.match(passengerLocationAccess, /const serializePassengerForPrincipal/);
  assert.match(passengerLocationAccess, /identity_access: isAnalisa \|\| !maskOperatorIdentity \? "FULL" : "MASKED"/);
  assert.match(passengerLocationAccess, /email: null/);
  assert.match(passengerLocationAccess, /session_id: null/);
  assert.match(server, /PASSENGER_POSITIONS_VIEW_DENIED/);
  assert.match(realtimeConnection, /PASSENGER_REALTIME_SUBSCRIBE/);
  assert.match(server, /privacy: policy/);
});

test("public users can read their server-side report history", () => {
  assert.match(server, /app\.get\("\/me\/public-reports"/);
  assert.match(server, /app\.get\("\/me\/public-reports\/:id"/);
  assert.match(server, /reporter_user_id = \$1/);
});
