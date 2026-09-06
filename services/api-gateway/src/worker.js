import http from "http";
import { startPublicReportReviewWorker } from "./public-report-review.js";
import { startPublicReportEvidenceWorker } from "./public-report-evidence.js";
import { startHeatmapWorker } from "./heatmap-worker.js";

// Dedicated worker process: runs the BullMQ workers (public-report review,
// public-report evidence processing + heatmap generation) out of the api-gateway
// request path so heavy jobs don't add API latency
// and the API can scale horizontally without duplicating the workers.
// See docs/runbooks/scale-out.md.

startPublicReportReviewWorker();
startPublicReportEvidenceWorker();
startHeatmapWorker();

const healthPort = Number(process.env.WORKER_HEALTH_PORT || 4102);
http
  .createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      return res.end(JSON.stringify({ ok: true, service: "worker" }));
    }
    res.writeHead(404);
    res.end();
  })
  .listen(healthPort, () => {
    console.log(`worker health listening on http://localhost:${healthPort}/health`);
  });

console.log("worker started: public-report-review + public-report-evidence + heatmap-generation");

const shutdown = (signal) => {
  console.log(`worker received ${signal}, exiting`);
  process.exit(0);
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
