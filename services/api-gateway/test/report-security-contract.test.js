import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, "../../..");
const server = readFileSync(new URL("../src/server.js", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/worker.js", import.meta.url), "utf8");
const publicReportReview = readFileSync(new URL("../src/public-report-review.js", import.meta.url), "utf8");
const publicReportEvidence = readFileSync(new URL("../src/public-report-evidence.js", import.meta.url), "utf8");
const publicReportEvidenceMigration = readFileSync(join(repoRoot, "db/migrations/020_public_report_evidence_processing.sql"), "utf8");
const reportsPage = readFileSync(join(repoRoot, "apps/operator-web/src/app/dashboard/reports/page.tsx"), "utf8");

test("rit reports and exports are restricted to ANALISA and audited", () => {
  assert.match(server, /app\.get\("\/reports\/rit", auth, requireRole\(\["ANALISA"\]\)/);
  assert.match(server, /app\.get\("\/reports\/rit\/export", auth, requireRole\(\["ANALISA"\]\)/);
  assert.match(server, /action: "READ_REPORT_RIT"/);
  assert.match(server, /action: "EXPORT_REPORT_RIT"/);
});

test("reports page downloads exports from the API instead of generating client-only files", () => {
  assert.match(reportsPage, /apiDownload\(`\/reports\/rit\/export/);
  assert.doesNotMatch(reportsPage, /from "jspdf"/);
  assert.doesNotMatch(reportsPage, /jspdf-autotable/);
});

test("telemetry ingestion has rate limiting and optional device authentication", () => {
  assert.match(server, /app\.post\("\/telemetry\/vehicle", rateLimitTelemetry, verifyTelemetryAuth/);
  assert.match(server, /TELEMETRY_INGEST_TOKEN/);
  assert.match(server, /TELEMETRY_HMAC_SECRET/);
  assert.match(server, /RATE_LIMITED/);
});

test("non-dev environments cannot boot with the fallback JWT secret", () => {
  assert.match(server, /NODE_ENV/);
  assert.match(server, /JWT_SECRET must be set to a strong, non-default value/);
  assert.match(server, /process\.env\.JWT_SECRET === "dev-secret"/);
});

test("owner and vehicle detail mask sensitive fields for non-ANALISA users", () => {
  assert.match(server, /phone_primary: hasRole\(req, "ANALISA"\) \? row\.phone_primary : null/);
  assert.match(server, /READ_VEHICLE_DETAIL_SENSITIVE/);
  assert.match(server, /driver_phone: null/);
  assert.match(server, /imei_or_serial: null/);
});

test("public report submit is authenticated, rate limited, validates images, sanitizes uploads, and stores attachment metadata only", () => {
  assert.match(server, /app\.post\(\s*"\/public\/reports",\s*auth,\s*requireRole\(\["PUBLIC_USER"\]\),\s*rateLimitPublicReports,\s*uploadPublicReportAttachments/s);
  assert.match(server, /validatePublicReportEvidenceImage/);
  assert.match(server, /recordInvalidPublicReportImageRejection/);
  assert.match(server, /buffer: validation\.buffer/);
  assert.match(server, /validation\.size/);
  assert.match(server, /upload_metrics/);
  assert.match(server, /recordRollingMetricEvent/);
  assert.match(server, /getRollingMetricCount/);
  assert.match(server, /PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WINDOW_MS/);
  assert.match(server, /PUBLIC_REPORT_INVALID_IMAGE_REJECTION_WARNING_THRESHOLD/);
  assert.match(server, /PUBLIC_REPORT_INVALID_IMAGE_REJECTION_ERROR_THRESHOLD/);
  assert.match(server, /public_report_invalid_image_rejections/);
  assert.match(server, /public_report_invalid_image_rejection_window_hours/);
  assert.match(server, /public_report_upload_validation/);
  assert.match(server, /INSERT INTO public_reports/);
  assert.match(server, /INSERT INTO public_report_attachments/);
  assert.match(server, /putBufferObject/);
  assert.match(server, /createHash\("sha256"\)\.update\(validation\.buffer\)/);
  assert.match(server, /checksum_sha256/);
});

test("operator public report review and attachments are internal-only", () => {
  assert.match(server, /app\.get\("\/operator\/public-reports", auth, requireRole\(\["OPERATOR", "ANALISA"\]\)/);
  assert.match(server, /app\.get\("\/operator\/public-reports\/:id\/attachments\/:attachmentId", auth, requireRole\(\["OPERATOR", "ANALISA"\]\)/);
  assert.match(server, /getObjectBuffer/);
  assert.match(server, /PUBLIC_REPORT_\$\{actionUpper\}/);
  assert.doesNotMatch(server, /publicEndpoint.*public-report-evidence/);
});

test("automated public report review uses BullMQ and stores explainable monitoring evidence", () => {
  assert.match(server, /startPublicReportReviewWorker\(\)/);
  assert.match(server, /app\.post\("\/operator\/public-reports\/reviews\/run", auth, requireRole\(\["OPERATOR", "ANALISA"\]\)/);
  assert.match(publicReportReview, /const QUEUE_NAME = "public-report-review"/);
  assert.match(publicReportReview, /new Queue\(QUEUE_NAME/);
  assert.match(publicReportReview, /new Worker\(/);
  assert.match(publicReportReview, /INSERT INTO public_report_reviews/);
  assert.match(publicReportReview, /vehicle_latest/);
  assert.match(publicReportReview, /vehicle_positions/);
  assert.match(publicReportReview, /anomalies/);
  assert.match(publicReportReview, /alerts/);
  assert.match(publicReportReview, /autoEscalateConfirmedReport/);
  assert.match(publicReportReview, /rules_assisted_summary/);
});

test("public report evidence processing is async, idempotent, and observable", () => {
  assert.match(server, /enqueuePublicReportEvidenceProcessing\(attachments\)/);
  assert.match(server, /recordPublicReportEvidenceEnqueueFailure\(\)/);
  assert.match(server, /evidence_processing: evidenceProcessingSummary/);
  assert.match(server, /public_report_evidence_processing/);
  assert.match(worker, /startPublicReportEvidenceWorker\(\)/);
  assert.match(publicReportEvidence, /const QUEUE_NAME = "public-report-evidence"/);
  assert.match(publicReportEvidence, /jobId = `evidence-\$\{attachment\.attachment_id\}`/);
  assert.match(publicReportEvidence, /CHECKSUM_MISMATCH/);
  assert.match(publicReportEvidence, /thumbnail_object_key/);
  assert.match(publicReportEvidence, /getPublicReportEvidenceProcessingSummary/);
  assert.match(publicReportEvidenceMigration, /CREATE TABLE IF NOT EXISTS public_report_evidence_processing/);
  assert.match(publicReportEvidenceMigration, /UNIQUE \(attachment_id\)/);
  assert.match(publicReportEvidenceMigration, /input_checksum_sha256/);
});
