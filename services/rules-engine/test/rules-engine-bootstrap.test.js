import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createRulesEngineBootstrap } from "../src/rules-engine-bootstrap.js";

const createFakeServerFactory = () => {
  const servers = [];
  const createServer = (handler) => {
    const server = {
      handler,
      listening: false,
      port: null,
      listen(port, callback) {
        this.listening = true;
        this.port = port;
        callback?.();
      },
      close(callback) {
        this.listening = false;
        callback?.();
      }
    };
    servers.push(server);
    return server;
  };
  return { createServer, servers };
};

const createResponse = () => ({
  statusCode: null,
  headers: null,
  body: null,
  writeHead(statusCode, headers) {
    this.statusCode = statusCode;
    this.headers = headers;
  },
  end(body) {
    this.body = body;
  }
});

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

describe("rules engine bootstrap", () => {
  it("starts health checks, runs the rules loop, schedules follow-up work, and closes cleanly", async () => {
    const { createServer, servers } = createFakeServerFactory();
    const scheduled = [];
    const events = [];
    const logs = [];
    let ruleRuns = 0;
    let poolClosed = false;

    const runtime = createRulesEngineBootstrap({
      query: async () => ({ rows: [{ one: 1 }] }),
      runRules: async () => {
        ruleRuns += 1;
      },
      runCollectiveAnomalyDetection: async () => {},
      closePool: async () => {
        poolClosed = true;
      },
      logEvent: (event, payload) => events.push({ event, payload }),
      config: {
        runtime: {
          healthPort: 4100,
          intervalMs: 60000,
          collectiveIntervalMs: 3600000,
          ruleBatchSize: 100,
          ruleEvaluationConcurrency: 2
        }
      },
      createServer,
      setTimeoutFn: (callback, delay) => scheduled.push({ callback, delay }),
      consoleLog: (message) => logs.push(message),
      consoleError: () => {}
    });

    runtime.startRulesEngine();
    await flushPromises();

    assert.equal(servers[0].listening, true);
    assert.equal(servers[0].port, 4100);
    assert.equal(ruleRuns, 1);
    assert.equal(events[0].event, "rules_loop_end");
    assert.equal(events[0].payload.ok, true);
    assert.equal(events[0].payload.interval_ms, 60000);
    assert.equal(events[0].payload.rule_batch_size, 100);
    assert.equal(events[0].payload.rule_evaluation_concurrency, 2);
    assert.deepEqual(scheduled.map(({ delay }) => delay), [60000, 60000]);
    assert.deepEqual(logs, [
      "rules-engine health listening on http://localhost:4100/health",
      "rules-engine started"
    ]);

    const response = createResponse();
    await servers[0].handler({}, response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.headers, { "content-type": "application/json" });
    assert.deepEqual(JSON.parse(response.body), { ok: true, service: "rules-engine" });

    await runtime.closeRulesEngine();
    assert.equal(servers[0].listening, false);
    assert.equal(poolClosed, true);
  });
});
