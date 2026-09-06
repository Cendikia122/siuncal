import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");

test("audit logs endpoint uses the migration-defined audit_id column", () => {
  const migration = readFileSync(join(repoRoot, "db/migrations/004_audit_log.sql"), "utf8");
  const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");

  assert.match(migration, /audit_id uuid PRIMARY KEY/);
  assert.match(server, /audit_id/);
  assert.doesNotMatch(server, /log_id/);
});
