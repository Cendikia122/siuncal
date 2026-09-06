# Keputusan mTLS device auth (di atas HMAC)

- **Status:** needs-triage
- **Type:** task
- **Scope:** backend
- **Priority:** P2
- **Doc status:** NOT-DONE (decision pending)
- **Component:** telemetry-ingestion, infra

## Context
Auth device saat ini token statis/HMAC. Perlu keputusan apakah produksi butuh mTLS tambahan.

## Acceptance Criteria
- [ ] Putuskan apakah mTLS diperlukan untuk auth device produksi.
- [ ] Bila ya: rencana implementasi + rotasi sertifikat. Bila tidak: catat sebagai risk-accepted dengan alasan.
- [ ] Dokumentasikan keputusan sebagai ADR di `docs/adr/`.

## References
- `docs/plans/2026-06-30-...unfinished-tasks.md` Phase 18 (mTLS decision)
