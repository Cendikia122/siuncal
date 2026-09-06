# Postgres read replica & read/write split

- **Status:** needs-triage
- **Type:** feature
- **Scope:** backend
- **Priority:** P2
- **Doc status:** NOT-DONE
- **Component:** api-gateway, infra

## Context
PgBouncer sudah ada, read replica belum. Dibutuhkan untuk tier 500-2000 kendaraan. Perlu keputusan arsitektur apakah target deployment memang butuh replica.

## Acceptance Criteria
- [ ] Putuskan apakah skala 500-2000 kendaraan butuh read replica di target deployment saat ini.
- [ ] Dokumentasikan strategi read/write split untuk endpoint API.
- [ ] Identifikasi endpoint read-heavy yang aman diarahkan ke replica.
- [ ] Tambah env var koneksi replica bila disetujui + health/readiness check lag replica + failover behavior.
- [ ] Scale-out runbook menyatakan kapan & bagaimana replica diperkenalkan.

## References
- `docs/production-readiness-monitoring-angkot.md` §6
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P2 Read Replica
