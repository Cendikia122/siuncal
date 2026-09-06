# Public-report evidence processing worker (thumbnail/quality)

- **Status:** ready-for-agent
- **Type:** feature
- **Scope:** backend
- **Priority:** P2
- **Doc status:** NOT-DONE
- **Component:** api-gateway, db

## Context
Pemrosesan evidence latar belakang (thumbnail, quality check, enrichment) untuk laporan publik masih planned. Non-goal awal: belum ada queue/migration baru sampai fase implementasi.

## Acceptance Criteria
- [ ] Baca desain di `docs/plans/2026-06-07-public-report-evidence-processing.md`.
- [ ] Tambah migration `public_report_evidence_processing` saat implementasi.
- [ ] Worker menghasilkan thumbnail/quality signal dari attachment MinIO tanpa memblokir submit.
- [ ] Idempotent per attachment; retry/backoff; status terekam.
- [ ] Test unit/contract untuk sukses/gagal.

## References
- `docs/plans/2026-06-07-public-report-evidence-processing.md`
