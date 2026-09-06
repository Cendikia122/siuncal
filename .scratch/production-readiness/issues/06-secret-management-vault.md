# Production secret management decision (vault vs .env)

- **Status:** ready-for-human
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** infra

## Context
Secret masih berbasis `.env` untuk local/compose. Produksi butuh keputusan secret management (vault/managed secrets) sebelum go-live. Ini keputusan arsitektur/operasional, bukan sekadar coding — perlu input manusia.

## Acceptance Criteria
- [ ] Putuskan mekanisme secret produksi (managed secret manager vs vault vs terenkripsi CI).
- [ ] Dokumentasikan cara inject secret ke runtime tanpa menyimpannya di Git/compose.
- [ ] Buat/rotasi `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD` dari nilai default/example.
- [ ] Catat keputusan sebagai ADR di `docs/adr/`.

## References
- `docs/production-readiness-monitoring-angkot.md` §9, §11
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P1 Secret Review
