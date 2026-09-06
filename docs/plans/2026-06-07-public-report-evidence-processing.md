# Public Report Evidence Background Processing Plan

**Goal:** Memisahkan pemrosesan evidence public report yang berat dari request upload utama, tanpa menurunkan integritas bukti. Upload tetap cepat dan aman, sementara enrichment seperti OCR, thumbnail, redaction, dan analisis visual berjalan di background worker yang idempotent dan observable.

**Current state:**
- `POST /public/reports` sudah melakukan validasi magic-byte, decode, re-encode, metadata stripping, dan upload sanitized image secara sinkron.
- Public report review sudah memakai BullMQ di `services/api-gateway/src/public-report-review.js`.
- Worker entrypoint sudah ada di `services/api-gateway/src/worker.js`.
- OCR/enrichment evidence masih planned, belum ada tabel hasil khusus dan belum ada queue evidence.

**Non-goals untuk task desain ini:**
- Tidak mengubah flow upload saat ini.
- Tidak menambah OCR dependency sekarang.
- Tidak menambah migrasi database sekarang.
- Tidak mengubah UI detail report sekarang.

---

## Recommended Architecture

### 1. Keep synchronous safety gate

Request upload tetap melakukan pekerjaan wajib sebelum report diterima:

1. Auth public user.
2. Rate limit.
3. File size/count limit.
4. Magic-byte MIME validation.
5. Decode + re-encode + metadata stripping.
6. Upload sanitized object ke MinIO.
7. Insert `public_reports` dan `public_report_attachments`.

Alasan: evidence yang masuk storage harus sudah aman. Background worker tidak boleh menjadi satu-satunya lapisan sanitasi.

### 2. Add asynchronous evidence queue

Tambahkan queue BullMQ baru:

- Queue name: `public-report-evidence`
- Job id: `evidence:${attachment_id}` untuk idempotency
- Payload minimal:
  - `public_report_id`
  - `attachment_id`
  - `bucket`
  - `object_key`
  - `content_type`
  - `checksum_sha256`

Worker membaca sanitized object dari MinIO, lalu menjalankan enrichment.

### 3. Suggested processing stages

Urutan stage awal:

1. **Thumbnail generation**
   - Output: `public-reports/.../thumbs/{attachment_id}.webp`
   - Tujuan: preview cepat di operator UI.

2. **OCR placeholder / local OCR**
   - Output: extracted text + confidence.
   - Untuk MVP, bisa pakai deterministic placeholder agar kontrak data siap sebelum dependency OCR dipilih.

3. **Evidence quality check**
   - Blur/too dark/too small heuristics.
   - Flag `LOW_QUALITY` untuk review operator.

4. **Optional redaction**
   - Untuk wajah/plat lain jika nanti wajib secara kebijakan privasi.
   - Jangan aktifkan otomatis sebelum policy jelas.

---

## Data Model Proposal

Tambahkan migration baru saat implementasi:

```sql
CREATE TABLE IF NOT EXISTS public_report_evidence_processing (
  processing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public_report_attachments(attachment_id) ON DELETE CASCADE,
  public_report_id uuid NOT NULL REFERENCES public_reports(public_report_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING',
  stage text NOT NULL DEFAULT 'QUEUED',
  attempts int NOT NULL DEFAULT 0,
  thumbnail_bucket text,
  thumbnail_object_key text,
  ocr_text text,
  ocr_confidence double precision,
  quality_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  error_code text,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_public_report_evidence_processing_report
  ON public_report_evidence_processing(public_report_id, status);
```

Status yang disarankan:

- `PENDING`
- `PROCESSING`
- `COMPLETED`
- `FAILED`
- `SKIPPED`

---

## Worker Design

### API gateway enqueue point

Setelah transaction upload commit sukses:

1. Enqueue satu job per attachment.
2. Gunakan `jobId = evidence:${attachment_id}`.
3. Jika enqueue gagal, jangan rollback report yang sudah berhasil dibuat. Catat metric `public_report_evidence_enqueue_failures` dan tampilkan di observability.

### Worker behavior

- Worker module baru: `services/api-gateway/src/public-report-evidence.js`.
- Export:
  - `enqueuePublicReportEvidenceProcessing(attachments)`
  - `startPublicReportEvidenceWorker()`
- `src/worker.js` memanggil starter worker baru.
- Retry policy:
  - attempts: 3
  - backoff: exponential, 30s awal
- Concurrency awal: 2, configurable via env.

### Idempotency

Worker harus aman dijalankan ulang:

- Upsert row processing by `attachment_id`.
- Jika checksum object berubah dari payload, mark `FAILED` dengan `CHECKSUM_MISMATCH`.
- Jika output thumbnail sudah ada dan checksum input sama, skip regenerate.

---

## Observability

Tambahkan metric:

- `public_report_evidence_jobs_queued_24h`
- `public_report_evidence_jobs_completed_24h`
- `public_report_evidence_jobs_failed_24h`
- `public_report_evidence_enqueue_failures_24h`
- `public_report_evidence_processing_p95_ms`

Expose di `/observability/summary`:

```json
{
  "evidence_processing": {
    "queued_24h": 0,
    "completed_24h": 0,
    "failed_24h": 0,
    "enqueue_failures_24h": 0,
    "status": "OK"
  }
}
```

Alert rule awal:

- `DEGRADED`: failed_24h >= 5 atau enqueue_failures_24h >= 1
- `ERROR`: failed_24h >= 20

---

## Rollout Plan

### Phase 1: Contract and storage-safe MVP

- Tambah migration table processing.
- Tambah queue + worker skeleton.
- Enqueue setelah upload commit.
- Worker hanya generate thumbnail WebP dan update status.
- Observability metric dasar.

### Phase 2: Operator UI integration

- Detail public report menampilkan processing status per attachment.
- Thumbnail digunakan untuk preview.
- Jika processing gagal, operator tetap bisa membuka sanitized original.

### Phase 3: OCR and quality enrichment

- Pilih OCR engine setelah evaluasi Docker size, akurasi Bahasa Indonesia, dan latency.
- Simpan OCR text + confidence.
- Tambahkan quality flags.

### Phase 4: Privacy policy dependent redaction

- Redaction hanya jika policy mengharuskan.
- Simpan original sanitized sebagai source of truth, derivative redacted sebagai preview.

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Worker gagal tetapi upload sukses | Evidence enrichment tidak tersedia | Upload tetap valid, worker retry, metric alert |
| OCR dependency berat | Docker image besar, build lambat | Mulai dari thumbnail MVP, OCR phase terpisah |
| Queue duplicate job | Double processing | `jobId` deterministic + unique `attachment_id` |
| Object tampering | Evidence integrity rusak | Validate checksum sebelum processing |
| PII leakage dari OCR | Privacy risk | Jangan expose OCR ke public, audit operator access |

---

## Verification Plan

- Unit test enqueue idempotency.
- Worker test dengan mocked object storage.
- Integration test: upload report, attachment row created, evidence job queued.
- Manual Docker test: worker starts with API gateway stack and processes thumbnail.
- Observability test: failed worker job updates summary status.

---

## Recommendation

Implement Phase 1 sebagai task terpisah setelah patch rolling metric/UI selesai. Jangan memindahkan sanitasi utama ke background worker, karena storage harus tetap hanya menerima evidence yang sudah aman dan metadata-stripped.
