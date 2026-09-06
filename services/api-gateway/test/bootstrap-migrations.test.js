import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");

test("Postgres bootstrap includes every database migration", async () => {
  const migrationsDir = join(repoRoot, "db/migrations");
  const bootstrapPath = join(repoRoot, "infra/docker-compose/initdb/001_bootstrap.sql");

  const [migrationFiles, bootstrapSql] = await Promise.all([
    readdir(migrationsDir),
    readFile(bootstrapPath, "utf8")
  ]);

  const migrations = migrationFiles
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => `/db/migrations/${file}`);

  const missing = migrations.filter((migration) => !bootstrapSql.includes(`\\i ${migration}`));

  assert.deepEqual(
    missing,
    [],
    `${relative(repoRoot, bootstrapPath)} is missing migrations: ${missing.join(", ")}`
  );
});
