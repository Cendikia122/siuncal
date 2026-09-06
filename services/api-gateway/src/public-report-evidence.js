import crypto from "crypto";
import IORedis from "ioredis";
import { Queue, Worker } from "bullmq";
import sharp from "sharp";
import { query } from "./db.js";
import { getObjectBuffer, putBufferObject } from "./object-storage.js";
import { getRollingMetricCount, recordRollingMetricEvent } from "./redis.js";

const QUEUE_NAME = "public-report-evidence";
const METRIC_WINDOW_MS = 24 * 60 * 60 * 1000;
const ENQUEUE_FAILURE_METRIC = "public_report_evidence_enqueue_failures";

const evidenceConfig = {
  redisHost: process.env.REDIS_HOST || "localhost",
  redisPort: Number(process.env.REDIS_PORT || 6379),
  concurrency: Number(process.env.PUBLIC_REPORT_EVIDENCE_CONCURRENCY || 2),
  thumbnailMaxWidth: Number(process.env.PUBLIC_REPORT_EVIDENCE_THUMBNAIL_MAX_WIDTH || 480),
  thumbnailMaxHeight: Number(process.env.PUBLIC_REPORT_EVIDENCE_THUMBNAIL_MAX_HEIGHT || 480),
  thumbnailQuality: Number(process.env.PUBLIC_REPORT_EVIDENCE_THUMBNAIL_QUALITY || 80)
};

let evidenceQueue = null;
let evidenceQueueConnection = null;
let evidenceWorker = null;

const createRedisConnection = () => new IORedis({
  host: evidenceConfig.redisHost,
  port: evidenceConfig.redisPort,
  maxRetriesPerRequest: null,
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {})
});

const getEvidenceQueue = () => {
  if (process.env.PUBLIC_REPORT_EVIDENCE_PROCESSING_ENABLED === "false") return null;
  if (!evidenceQueue) {
    evidenceQueueConnection = createRedisConnection();
    evidenceQueue = new Queue(QUEUE_NAME, { connection: evidenceQueueConnection });
  }
  return evidenceQueue;
};

const buildPayload = (attachment) => ({
  public_report_id: attachment.public_report_id,
  attachment_id: attachment.attachment_id,
  bucket: attachment.bucket,
  object_key: attachment.object_key,
  content_type: attachment.content_type,
  checksum_sha256: attachment.checksum_sha256 || null
});

const validatePayload = (payload) => {
  for (const field of ["public_report_id", "attachment_id", "bucket", "object_key", "content_type"]) {
    if (!payload?.[field]) throw new Error(`Invalid public report evidence payload: missing ${field}`);
  }
};

const thumbnailKeyFor = (objectKey, attachmentId) => {
  const parts = String(objectKey || "").split("/").filter(Boolean);
  parts.pop();
  const base = parts.length ? parts.join("/") : "public-reports/unscoped";
  return `${base}/thumbs/${attachmentId}.webp`;
};

export const recordPublicReportEvidenceEnqueueFailure = () => recordRollingMetricEvent(ENQUEUE_FAILURE_METRIC, {
  windowMs: METRIC_WINDOW_MS
});

export const enqueuePublicReportEvidenceProcessing = async (attachments = []) => {
  const queue = getEvidenceQueue();
  if (!queue) return { queued: 0, disabled: true };

  const validAttachments = attachments.filter((attachment) => attachment?.attachment_id);
  await Promise.all(validAttachments.map(async (attachment) => {
    const payload = buildPayload(attachment);
    const jobId = `evidence-${attachment.attachment_id}`;
    const existingJob = await queue.getJob(jobId);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state === "failed" || state === "completed") {
        await existingJob.remove();
      }
    }

    return queue.add(
      "process-public-report-evidence",
      payload,
      {
        jobId,
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
        removeOnComplete: 100,
        removeOnFail: true
      }
    );
  }));

  return { queued: validAttachments.length };
};

const markFailed = async ({ payload, startedAt, errorCode, errorMessage }) => {
  await query(
    `INSERT INTO public_report_evidence_processing (
       attachment_id,
       public_report_id,
       status,
       stage,
       attempts,
       input_checksum_sha256,
       processing_duration_ms,
       error_code,
       error_message,
       started_at,
       completed_at,
       updated_at
     )
     VALUES ($1, $2, 'FAILED', $3, 1, $4, $5, $6, $7, now(), now(), now())
     ON CONFLICT (attachment_id) DO UPDATE
     SET status = 'FAILED',
         stage = EXCLUDED.stage,
         attempts = public_report_evidence_processing.attempts,
         input_checksum_sha256 = EXCLUDED.input_checksum_sha256,
         processing_duration_ms = EXCLUDED.processing_duration_ms,
         error_code = EXCLUDED.error_code,
         error_message = EXCLUDED.error_message,
         completed_at = now(),
         updated_at = now()`,
    [
      payload.attachment_id,
      payload.public_report_id,
      errorCode,
      payload.checksum_sha256,
      Date.now() - startedAt,
      errorCode,
      String(errorMessage || "Evidence processing failed").slice(0, 500)
    ]
  );
};

export const processPublicReportEvidence = async (payload) => {
  const startedAt = Date.now();
  validatePayload(payload);

  const existing = await query(
    `SELECT status, input_checksum_sha256, thumbnail_object_key
     FROM public_report_evidence_processing
     WHERE attachment_id = $1`,
    [payload.attachment_id]
  );
  const existingRow = existing.rows[0];
  if (
    existingRow?.status === "COMPLETED" &&
    existingRow.input_checksum_sha256 === payload.checksum_sha256 &&
    existingRow.thumbnail_object_key
  ) {
    return { attachment_id: payload.attachment_id, skipped: true, reason: "ALREADY_COMPLETED" };
  }

  await query(
    `INSERT INTO public_report_evidence_processing (
       attachment_id,
       public_report_id,
       status,
       stage,
       attempts,
       input_checksum_sha256,
       started_at,
       updated_at
     )
     VALUES ($1, $2, 'PROCESSING', 'THUMBNAIL', 1, $3, now(), now())
     ON CONFLICT (attachment_id) DO UPDATE
     SET status = 'PROCESSING',
         stage = 'THUMBNAIL',
         attempts = public_report_evidence_processing.attempts + 1,
         input_checksum_sha256 = EXCLUDED.input_checksum_sha256,
         error_code = NULL,
         error_message = NULL,
         started_at = now(),
         completed_at = NULL,
         updated_at = now()`,
    [payload.attachment_id, payload.public_report_id, payload.checksum_sha256]
  );

  try {
    const object = await getObjectBuffer({ bucketName: payload.bucket, key: payload.object_key });
    const actualChecksum = crypto.createHash("sha256").update(object.buffer).digest("hex");
    if (payload.checksum_sha256 && actualChecksum !== payload.checksum_sha256) {
      await markFailed({
        payload,
        startedAt,
        errorCode: "CHECKSUM_MISMATCH",
        errorMessage: "Evidence object checksum does not match attachment metadata"
      });
      return { attachment_id: payload.attachment_id, failed: true, error_code: "CHECKSUM_MISMATCH" };
    }

    const thumbnail = await sharp(object.buffer, { limitInputPixels: 40_000_000, failOn: "error" })
      .rotate()
      .resize({
        width: evidenceConfig.thumbnailMaxWidth,
        height: evidenceConfig.thumbnailMaxHeight,
        fit: "inside",
        withoutEnlargement: true
      })
      .webp({ quality: evidenceConfig.thumbnailQuality })
      .toBuffer();
    const thumbnailObjectKey = thumbnailKeyFor(payload.object_key, payload.attachment_id);

    await putBufferObject({
      bucketName: payload.bucket,
      key: thumbnailObjectKey,
      buffer: thumbnail,
      contentType: "image/webp",
      metadata: {
        "public-report-id": payload.public_report_id,
        "attachment-id": payload.attachment_id,
        "derivative-type": "thumbnail"
      }
    });

    await query(
      `UPDATE public_report_evidence_processing
       SET status = 'COMPLETED',
           stage = 'THUMBNAIL_GENERATED',
           thumbnail_bucket = $2,
           thumbnail_object_key = $3,
           thumbnail_content_type = 'image/webp',
           thumbnail_size_bytes = $4,
           processing_duration_ms = $5,
           error_code = NULL,
           error_message = NULL,
           completed_at = now(),
           updated_at = now()
       WHERE attachment_id = $1`,
      [payload.attachment_id, payload.bucket, thumbnailObjectKey, thumbnail.length, Date.now() - startedAt]
    );

    return {
      attachment_id: payload.attachment_id,
      status: "COMPLETED",
      thumbnail_object_key: thumbnailObjectKey,
      processing_duration_ms: Date.now() - startedAt
    };
  } catch (error) {
    await markFailed({
      payload,
      startedAt,
      errorCode: "PROCESSING_ERROR",
      errorMessage: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
};

export const getPublicReportEvidenceProcessingSummary = async () => {
  const [processingResult, enqueueFailuresCount] = await Promise.all([
    query(
      `SELECT
          COUNT(*) FILTER (WHERE queued_at >= now() - interval '24 hours')::int AS queued_24h,
          COUNT(*) FILTER (WHERE status = 'COMPLETED' AND completed_at >= now() - interval '24 hours')::int AS completed_24h,
          COUNT(*) FILTER (WHERE status = 'FAILED' AND updated_at >= now() - interval '24 hours')::int AS failed_24h,
          COALESCE(
            percentile_cont(0.95) WITHIN GROUP (ORDER BY processing_duration_ms)
              FILTER (WHERE status = 'COMPLETED' AND completed_at >= now() - interval '24 hours' AND processing_duration_ms IS NOT NULL),
            0
          )::int AS processing_p95_ms
       FROM public_report_evidence_processing`
    ),
    getRollingMetricCount(ENQUEUE_FAILURE_METRIC, { windowMs: METRIC_WINDOW_MS })
  ]);

  const row = processingResult.rows[0] || {};
  const failed24h = Number(row.failed_24h || 0);
  const enqueueFailures24h = Number(enqueueFailuresCount || 0);
  const status = failed24h >= 20
    ? "ERROR"
    : failed24h >= 5 || enqueueFailures24h >= 1
      ? "DEGRADED"
      : "OK";

  return {
    queued_24h: Number(row.queued_24h || 0),
    completed_24h: Number(row.completed_24h || 0),
    failed_24h: failed24h,
    enqueue_failures_24h: enqueueFailures24h,
    processing_p95_ms: Number(row.processing_p95_ms || 0),
    status
  };
};

export const startPublicReportEvidenceWorker = () => {
  if (process.env.PUBLIC_REPORT_EVIDENCE_PROCESSING_ENABLED === "false") {
    console.log("public-report-evidence worker disabled");
    return null;
  }
  const queue = getEvidenceQueue();
  if (!queue) return null;
  if (evidenceWorker) return { queue, worker: evidenceWorker };

  const workerConnection = createRedisConnection();
  evidenceWorker = new Worker(
    QUEUE_NAME,
    async (job) => processPublicReportEvidence(job.data),
    {
      connection: workerConnection,
      concurrency: evidenceConfig.concurrency
    }
  );

  evidenceWorker.on("completed", (job, result) => {
    console.log(JSON.stringify({ ts: new Date().toISOString(), job: job.name, result }));
  });
  evidenceWorker.on("failed", (job, error) => {
    console.error(JSON.stringify({
      ts: new Date().toISOString(),
      job: job?.name || "public-report-evidence",
      attachment_id: job?.data?.attachment_id,
      public_report_id: job?.data?.public_report_id,
      error: error.message
    }));
  });

  const shutdown = async () => {
    await evidenceWorker?.close();
    await queue?.close();
    await evidenceQueueConnection?.quit();
    await workerConnection.quit();
  };
  process.once("SIGTERM", () => shutdown().finally(() => process.exit(0)));
  process.once("SIGINT", () => shutdown().finally(() => process.exit(0)));

  return { queue, worker: evidenceWorker };
};
