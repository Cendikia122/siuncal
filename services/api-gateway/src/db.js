import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const parseBooleanEnv = (value, fallback = false) => {
  if (value === undefined || value === null || value === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).trim().toLowerCase());
};

const isProductionLike = (env) => ["production", "staging"].includes(env.NODE_ENV);
const usesPgBouncer = (env) => Boolean(env.PGBOUNCER_HOST);
const shouldUseSsl = (env) => {
  if (env.DB_SSL !== undefined) return parseBooleanEnv(env.DB_SSL, false);
  return isProductionLike(env) && !usesPgBouncer(env);
};

export const buildDbPoolConfig = (env = process.env) => {
  const common = {
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    max: Number(env.DB_POOL_MAX || 50),
    ...(shouldUseSsl(env) ? { ssl: { rejectUnauthorized: true } } : {})
  };

  if (usesPgBouncer(env)) {
    return {
      host: env.PGBOUNCER_HOST,
      port: Number(env.PGBOUNCER_PORT || 6432),
      user: env.DB_USER || "monitoring",
      password: env.DB_PASSWORD || "monitoring",
      database: env.DB_NAME || "Sentra",
      ...common
    };
  }

  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ...common
    };
  }

  return {
    host: env.DB_HOST || "localhost",
    port: Number(env.DB_PORT || 5432),
    user: env.DB_USER || "monitoring",
    password: env.DB_PASSWORD || "monitoring",
    database: env.DB_NAME || "Sentra",
    ...common
  };
};

// --- HIGH-06: Remove hardcoded DB credentials; require env vars in production ---
if (isProductionLike(process.env)) {
  if ((!process.env.DATABASE_URL || usesPgBouncer(process.env)) && (!process.env.DB_USER || !process.env.DB_PASSWORD)) {
    throw new Error("FATAL: Database credentials (DATABASE_URL or DB_USER/DB_PASSWORD) must be set in production/staging");
  }
}

const pool = new Pool(buildDbPoolConfig());

export const query = (text, params) => pool.query(text, params);
export { pool };
