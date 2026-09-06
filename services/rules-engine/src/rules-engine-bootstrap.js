import http from "http";

export const createRulesEngineBootstrap = ({
  query,
  runRules,
  runCollectiveAnomalyDetection,
  closePool,
  logEvent,
  config,
  createServer = http.createServer,
  setTimeoutFn = setTimeout,
  consoleLog = console.log,
  consoleError = console.error
}) => {
  const healthServer = createServer(async (_req, res) => {
    try {
      await query("SELECT 1");
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, service: "rules-engine" }));
    } catch (error) {
      res.writeHead(503, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: false, service: "rules-engine", error: "db_unreachable" }));
    }
  });

  const loop = async () => {
    const startedAt = Date.now();
    try {
      await runRules();
      logEvent("rules_loop_end", {
        ok: true,
        duration_ms: Date.now() - startedAt,
        interval_ms: config.runtime.intervalMs,
        rule_batch_size: config.runtime.ruleBatchSize,
        rule_evaluation_concurrency: config.runtime.ruleEvaluationConcurrency
      });
    } catch (error) {
      logEvent("rules_loop_end", {
        ok: false,
        duration_ms: Date.now() - startedAt,
        interval_ms: config.runtime.intervalMs,
        rule_batch_size: config.runtime.ruleBatchSize,
        rule_evaluation_concurrency: config.runtime.ruleEvaluationConcurrency,
        error: error instanceof Error ? error.message : String(error)
      });
      consoleError("rules-engine error", error);
    } finally {
      setTimeoutFn(loop, config.runtime.intervalMs);
    }
  };

  const collectiveLoop = async () => {
    try {
      await runCollectiveAnomalyDetection();
    } catch (error) {
      consoleError("collective-anomaly-detection error", error);
    } finally {
      setTimeoutFn(collectiveLoop, config.runtime.collectiveIntervalMs);
    }
  };

  const startRulesEngine = () => {
    healthServer.listen(config.runtime.healthPort, () => {
      consoleLog(`rules-engine health listening on http://localhost:${config.runtime.healthPort}/health`);
    });
    consoleLog("rules-engine started");
    loop();
    setTimeoutFn(collectiveLoop, 60000);
  };

  const closeRulesEngine = async () => {
    if (healthServer.listening) {
      await new Promise((resolve, reject) => healthServer.close((error) => error ? reject(error) : resolve()));
    }
    await closePool();
  };

  return {
    startRulesEngine,
    closeRulesEngine
  };
};
