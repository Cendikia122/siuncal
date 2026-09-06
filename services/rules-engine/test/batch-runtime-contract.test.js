import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("../src/index.js", import.meta.url), "utf8");
const evaluatorSource = readFileSync(new URL("../src/rules-engine-evaluators.js", import.meta.url), "utf8");
const batchEvaluationSource = readFileSync(new URL("../src/rule-batch-evaluation.js", import.meta.url), "utf8");
const runnerSource = readFileSync(new URL("../src/rules-engine-runner.js", import.meta.url), "utf8");
const bootstrapSource = readFileSync(new URL("../src/rules-engine-bootstrap.js", import.meta.url), "utf8");
const configSource = readFileSync(new URL("../src/rules-engine-config.js", import.meta.url), "utf8");
const compose = readFileSync(new URL("../../../infra/docker-compose/docker-compose.yml", import.meta.url), "utf8");

test("rules engine uses Bogor-only batch evaluation without city workers", () => {
  assert.match(configSource, /RULE_BATCH_SIZE/);
  assert.match(configSource, /RULE_EVALUATION_CONCURRENCY/);
  assert.match(source, /createRulesEngineEvaluators/);
  assert.match(evaluatorSource, /createRuleBatchEvaluator/);
  assert.match(source, /createRulesEngineRunner/);
  assert.match(runnerSource, /from "\.\/rules-runtime\.js"/);
  assert.match(runnerSource, /chunkArray\(vehicles, config\.runtime\.ruleBatchSize\)/);
  assert.match(batchEvaluationSource, /runWithConcurrency/);
  assert.match(batchEvaluationSource, /evaluateLostSignalBatch/);
  assert.match(batchEvaluationSource, /evaluateOverspeedBatch/);
  assert.match(batchEvaluationSource, /evaluateOffRouteBatch/);
  assert.match(batchEvaluationSource, /evaluateWrongDirectionBatch/);
  assert.match(batchEvaluationSource, /evaluateNgetemBatch/);
  assert.match(runnerSource, /for \(const batch of batches\)/);
  assert.match(bootstrapSource, /rules_loop_end/);
  assert.match(bootstrapSource, /duration_ms/);
  assert.doesNotMatch(`${source}\n${evaluatorSource}\n${batchEvaluationSource}\n${runnerSource}\n${bootstrapSource}\n${configSource}`, /RULES_ENGINE_SHARD_COUNT|RULES_ENGINE_SHARD_INDEX|city_id/);
});

test("rules engine keeps queue-based evaluation deferred", () => {
  assert.doesNotMatch(source, /new Queue\(|new Worker\(|QueueEvents|BullMQ/i);
  assert.match(compose, /RULE_BATCH_SIZE: \$\{RULE_BATCH_SIZE:-100\}/);
  assert.match(compose, /RULE_EVALUATION_CONCURRENCY: \$\{RULE_EVALUATION_CONCURRENCY:-1\}/);
});
