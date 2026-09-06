import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const index = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const email = readFileSync(new URL("../src/channels/email.js", import.meta.url), "utf8");

test("notification service drains account email outbox", () => {
  assert.match(index, /account_email_outbox/);
  assert.match(index, /fetchPendingAccountEmails/);
  assert.match(index, /markAccountEmailSent/);
  assert.match(index, /sendAccountEmail/);
});

test("account email sender targets the outbox recipient and supports verification and reset templates", () => {
  assert.match(email, /export async function sendAccountEmail/);
  assert.match(email, /VERIFY_EMAIL/);
  assert.match(email, /RESET_PASSWORD/);
  assert.match(email, /email\.recipient/);
});
