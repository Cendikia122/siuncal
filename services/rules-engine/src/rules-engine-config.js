const numberFromEnv = (env, name, fallback) => Number(env[name] || fallback);
const minOneFromEnv = (env, name, fallback) => Math.max(1, numberFromEnv(env, name, fallback));
const booleanFromEnv = (env, name, fallback = false) => {
  if (env[name] === undefined || env[name] === null || env[name] === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(env[name]).trim().toLowerCase());
};

const usesPgBouncer = (env) => Boolean(env.PGBOUNCER_HOST);
const databaseHost = (env) => env.PGBOUNCER_HOST || env.DB_HOST || "127.0.0.1";
const databasePort = (env) => usesPgBouncer(env)
  ? numberFromEnv(env, "PGBOUNCER_PORT", 6432)
  : numberFromEnv(env, "DB_PORT", 5432);
const databaseSsl = (env) => {
  if (env.DB_SSL !== undefined) return booleanFromEnv(env, "DB_SSL", false);
  return ["production", "staging"].includes(env.NODE_ENV) && !usesPgBouncer(env);
};

export const buildRulesEngineConfig = (env = process.env) => {
  const isProductionLike = ["production", "staging"].includes(env.NODE_ENV);
  if (isProductionLike && (!env.DB_USER || !env.DB_PASSWORD)) {
    throw new Error("FATAL: DB_USER and DB_PASSWORD must be set in production/staging");
  }

  const ruleEvaluationConcurrency = minOneFromEnv(env, "RULE_EVALUATION_CONCURRENCY", 1);
  const database = {
    host: databaseHost(env),
    port: databasePort(env),
    user: env.DB_USER || "monitoring",
    password: env.DB_PASSWORD || "monitoring",
    database: env.DB_NAME || "Sentra",
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: minOneFromEnv(env, "DB_POOL_MAX", 10),
    ...(databaseSsl(env) ? { ssl: { rejectUnauthorized: true } } : {})
  };

  return {
    database,
    runtime: {
      intervalMs: numberFromEnv(env, "RULE_INTERVAL_MS", 60000),
      ruleBatchSize: minOneFromEnv(env, "RULE_BATCH_SIZE", 100),
      ruleEvaluationConcurrency,
      healthPort: numberFromEnv(env, "HEALTH_PORT", 4100),
      collectiveIntervalMs: numberFromEnv(env, "COLLECTIVE_INTERVAL_MS", 3600000)
    },
    ruleEvaluation: {
      ruleEvaluationConcurrency,
      overspeedThreshold: numberFromEnv(env, "OVERSPEED_KMH", 60),
      overspeedWindowPoints: numberFromEnv(env, "OVERSPEED_WINDOW_POINTS", 3),
      overspeedMinPoints: numberFromEnv(env, "OVERSPEED_MIN_POINTS", 2),
      lostSignalMinutes: numberFromEnv(env, "LOST_SIGNAL_MINUTES", 3),
      lostSignalCriticalMinutes: numberFromEnv(env, "LOST_SIGNAL_CRITICAL_MINUTES", 10),
      offRouteMeters: numberFromEnv(env, "OFF_ROUTE_METERS", 0),
      offRouteGraceMinutes: numberFromEnv(env, "OFF_ROUTE_GRACE_MINUTES", 3),
      offRouteMinPoints: numberFromEnv(env, "OFF_ROUTE_MIN_POINTS", 3),
      mapMatchingMinConfidence: numberFromEnv(env, "MAP_MATCHING_MIN_CONFIDENCE", 0.35),
      wrongDirectionGraceMinutes: numberFromEnv(env, "WRONG_DIRECTION_GRACE_MINUTES", 3),
      wrongDirectionMinPoints: numberFromEnv(env, "WRONG_DIRECTION_MIN_POINTS", 3),
      wrongDirectionHeadingDiffDegrees: numberFromEnv(env, "WRONG_DIRECTION_HEADING_DIFF_DEGREES", 120),
      wrongDirectionMinSpeedKmh: numberFromEnv(env, "WRONG_DIRECTION_MIN_SPEED_KMH", 5),
      ngetemMinutes: numberFromEnv(env, "NGETEM_MINUTES", 10),
      ngetemMaxDistanceMeters: numberFromEnv(env, "NGETEM_MAX_DISTANCE_METERS", 15),
      ngetemMaxAvgSpeed: numberFromEnv(env, "NGETEM_MAX_AVG_SPEED", 3),
      officialStopRadiusMeters: numberFromEnv(env, "OFFICIAL_STOP_RADIUS_METERS", 120),
      baseRadiusMeters: numberFromEnv(env, "BASE_RADIUS_METERS", 150)
    },
    risk: {
      repeatEscalationCount: numberFromEnv(env, "REPEAT_ESCALATION_COUNT", 3),
      dailyDecayPercent: numberFromEnv(env, "RISK_DAILY_DECAY_PERCENT", 5),
      weeklyDecayPoints: numberFromEnv(env, "RISK_WEEKLY_DECAY_POINTS", 10)
    }
  };
};
