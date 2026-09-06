import dotenv from "dotenv";
import pg from "pg";
import { pathToFileURL } from "url";
import { createRulesEngineCollectiveRuntime } from "./rules-engine-collective-runtime.js";
import { createRulesEngineEvaluators } from "./rules-engine-evaluators.js";
import { createRulesEngineLifecycle } from "./rules-engine-lifecycle.js";
import { createRulesEngineRunner } from "./rules-engine-runner.js";
import { createRulesEngineBootstrap } from "./rules-engine-bootstrap.js";
import { buildRulesEngineConfig } from "./rules-engine-config.js";

dotenv.config();

const { Pool } = pg;
const config = buildRulesEngineConfig(process.env);

const pool = new Pool(config.database);

export const query = (text, params) => pool.query(text, params);

const logEvent = (event, payload) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: "rules-engine", event, ...payload }));
};

const lifecycle = createRulesEngineLifecycle({
  pool,
  config,
  logEvent
});

export const openRule = lifecycle.openRule;
export const resolveRule = lifecycle.resolveRule;
export const applyRuleDecision = lifecycle.applyRuleDecision;
const applyRiskDecay = lifecycle.applyRiskDecay;

export const {
  evaluateLostSignal,
  evaluateOverspeed,
  evaluateOffRoute,
  evaluateWrongDirection,
  evaluateNgetem,
  evaluateLostSignalBatch,
  evaluateOverspeedBatch,
  evaluateOffRouteBatch,
  evaluateWrongDirectionBatch,
  evaluateNgetemBatch
} = createRulesEngineEvaluators({
  query,
  applyRuleDecision,
  config
});

export const { runRules } = createRulesEngineRunner({
  query,
  evaluateLostSignalBatch,
  evaluateOverspeedBatch,
  evaluateOffRouteBatch,
  evaluateWrongDirectionBatch,
  evaluateNgetemBatch,
  applyRiskDecay,
  config
});

const { runCollectiveAnomalyDetection } = createRulesEngineCollectiveRuntime({
  query,
  logEvent
});

export const { startRulesEngine, closeRulesEngine } = createRulesEngineBootstrap({
  query,
  runRules,
  runCollectiveAnomalyDetection,
  closePool: () => pool.end(),
  logEvent,
  config
});

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startRulesEngine();
}
