import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildRulesEngineConfig } from "../src/rules-engine-config.js";

describe("rules engine config", () => {
  it("builds default database, runtime, and rule evaluation config", () => {
    const config = buildRulesEngineConfig({});

    assert.deepEqual(config.database, {
      host: "127.0.0.1",
      port: 5432,
      user: "monitoring",
      password: "monitoring",
      database: "Sentra",
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      max: 10
    });
    assert.equal(config.runtime.intervalMs, 60000);
    assert.equal(config.runtime.ruleBatchSize, 100);
    assert.equal(config.runtime.ruleEvaluationConcurrency, 1);
    assert.equal(config.runtime.healthPort, 4100);
    assert.equal(config.runtime.collectiveIntervalMs, 3600000);
    assert.deepEqual(config.ruleEvaluation, {
      ruleEvaluationConcurrency: 1,
      overspeedThreshold: 60,
      overspeedWindowPoints: 3,
      overspeedMinPoints: 2,
      lostSignalMinutes: 3,
      lostSignalCriticalMinutes: 10,
      offRouteMeters: 0,
      offRouteGraceMinutes: 3,
      offRouteMinPoints: 3,
      mapMatchingMinConfidence: 0.35,
      wrongDirectionGraceMinutes: 3,
      wrongDirectionMinPoints: 3,
      wrongDirectionHeadingDiffDegrees: 120,
      wrongDirectionMinSpeedKmh: 5,
      ngetemMinutes: 10,
      ngetemMaxDistanceMeters: 15,
      ngetemMaxAvgSpeed: 3,
      officialStopRadiusMeters: 120,
      baseRadiusMeters: 150
    });
    assert.deepEqual(config.risk, {
      repeatEscalationCount: 3,
      dailyDecayPercent: 5,
      weeklyDecayPoints: 10
    });
  });

  it("requires explicit credentials and enables strict SSL in production-like environments", () => {
    assert.throws(
      () => buildRulesEngineConfig({ NODE_ENV: "production", DB_USER: "monitoring" }),
      /DB_USER and DB_PASSWORD/
    );

    const config = buildRulesEngineConfig({
      NODE_ENV: "production",
      DB_HOST: "postgres",
      DB_PORT: "5432",
      DB_USER: "rules_user",
      DB_PASSWORD: "rules_password",
      DB_NAME: "monitoring_prod",
      RULE_BATCH_SIZE: "0",
      RULE_EVALUATION_CONCURRENCY: "0"
    });

    assert.deepEqual(config.database.ssl, { rejectUnauthorized: true });
    assert.equal(config.database.user, "rules_user");
    assert.equal(config.database.database, "monitoring_prod");
    assert.equal(config.runtime.ruleBatchSize, 1);
    assert.equal(config.runtime.ruleEvaluationConcurrency, 1);
  });

  it("routes through PgBouncer without forcing SSL for private Compose networking", () => {
    const config = buildRulesEngineConfig({
      NODE_ENV: "production",
      PGBOUNCER_HOST: "pgbouncer",
      PGBOUNCER_PORT: "6432",
      DB_USER: "rules_user",
      DB_PASSWORD: "rules_password",
      DB_NAME: "monitoring_prod",
      DB_POOL_MAX: "12"
    });

    assert.equal(config.database.host, "pgbouncer");
    assert.equal(config.database.port, 6432);
    assert.equal(config.database.max, 12);
    assert.equal(config.database.ssl, undefined);
  });
});
