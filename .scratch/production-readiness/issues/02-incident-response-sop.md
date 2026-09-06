# Incident response SOP (operasional sistem)

- **Status:** ready-for-agent
- **Type:** docs
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** infra, docs

## Context
Belum ada SOP incident response untuk insiden operasional sistem (berbeda dari emergency transport Phase 19). Dibutuhkan sebelum go-live.

## Acceptance Criteria
- [ ] Buat `docs/runbooks/incident-response-sop.md`.
- [ ] Definisikan SEV1/SEV2/SEV3, response time, escalation owner, channel komunikasi.
- [ ] Runbook: API gateway down, DB full/unavailable, Redis down, MinIO down, slow response/high CPU, WebSocket degradation.
- [ ] Prosedur rollback berbasis image/tag/commit nyata (bukan compose file yang tidak ada).
- [ ] Template post-incident review.

## Verification
- Command runbook cocok dengan layout Docker Compose saat ini (`docker compose ps`, `/health`, `/ready`).
- Dry-run command non-destruktif.

## References
- `docs/production-readiness-monitoring-angkot.md` §8
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P1 Incident Response SOP
