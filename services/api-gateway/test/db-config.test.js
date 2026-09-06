import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDbPoolConfig } from "../src/db.js";

describe("api-gateway db config", () => {
  it("routes through PgBouncer when PGBOUNCER_HOST is configured", () => {
    const config = buildDbPoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://direct:secret@postgres/Sentra",
      PGBOUNCER_HOST: "pgbouncer",
      PGBOUNCER_PORT: "6432",
      DB_USER: "monitoring",
      DB_PASSWORD: "secret",
      DB_NAME: "Sentra",
      DB_POOL_MAX: "50"
    });

    assert.equal(config.connectionString, undefined);
    assert.equal(config.host, "pgbouncer");
    assert.equal(config.port, 6432);
    assert.equal(config.user, "monitoring");
    assert.equal(config.database, "Sentra");
    assert.equal(config.max, 50);
    assert.equal(config.ssl, undefined);
  });

  it("keeps strict SSL for direct production database URLs unless DB_SSL is disabled", () => {
    const sslConfig = buildDbPoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://monitoring:secret@postgres/Sentra"
    });
    assert.deepEqual(sslConfig.ssl, { rejectUnauthorized: true });

    const nonSslConfig = buildDbPoolConfig({
      NODE_ENV: "production",
      DATABASE_URL: "postgres://monitoring:secret@postgres/Sentra",
      DB_SSL: "false"
    });
    assert.equal(nonSslConfig.ssl, undefined);
  });
});
