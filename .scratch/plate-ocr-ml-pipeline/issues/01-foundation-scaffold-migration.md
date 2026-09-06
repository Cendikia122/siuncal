# OCR Phase 0-1: Foundation scaffold + DB migration

- **Status:** ready-for-agent
- **Type:** feature
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** db, services (ocr-worker skeleton), infra

## Context
Fondasi modul OCR sebelum kerja data/model: env non-secret, migration DB metadata OCR, CI placeholder, bucket MinIO model/metrics. Scope evidence-only ditegaskan (Phase 0).

## Acceptance Criteria
- [ ] Konfirmasi scope evidence-only & tidak ada OCR SaaS eksternal (Phase 0).
- [ ] Tambah nama env var non-secret (lihat PLAN §10) ke `.env.example`.
- [ ] Migration DB untuk `public_report_ocr_results` (extend), `ocr_model_versions`, `ocr_evaluation_runs`, `ocr_jobs` + index (PLAN §5).
- [ ] Skeleton `ml/plate-ocr/` + `services/ocr-worker/` (tanpa model/data di Git).
- [ ] CI check lint/test placeholder; nama bucket model/metrics.

## Verification
- Migration contract test lulus; `docker compose ... config` valid.

## References
- `PLAN.md` Phase 0-1, §5, §10; backlog OCR-001..003
