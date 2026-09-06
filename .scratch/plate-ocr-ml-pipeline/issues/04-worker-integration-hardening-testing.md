# OCR Phase 7-9: Worker integration + hardening + testing

- **Status:** needs-triage
- **Type:** feature
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** services/ocr-worker, api-gateway

## Context
Integrasikan inference OCR ke alur laporan publik async (tidak memblokir submit), lalu hardening validasi/idempotency dan QA. Bergantung pada Phase 1 & 6.

## Acceptance Criteria
- [ ] Enqueue job OCR setelah attachment metadata tersimpan; worker load model aktif, fetch MinIO, panggil Python inference service.
- [ ] Simpan crop hanya untuk `NEEDS_OPERATOR_REVIEW`/`OCR_MISMATCHED`/sampling; tulis audit job + result + latency/confidence.
- [ ] Idempotent upsert by attachment id; retry/backoff; payload schema tervalidasi; failed → `NEEDS_OPERATOR_REVIEW`.
- [ ] Test unit/integration/smoke: matched, mismatched, low-confidence, no-plate, corrupt, MinIO down.

## Verification
- `npm test` worker; queue contract test; smoke fixture MinIO.

## References
- `PLAN.md` Phase 7-9; backlog OCR-014..018
