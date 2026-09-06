# Security audit report + secret review

- **Status:** ready-for-agent
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** NOT-DONE
- **Component:** api-gateway, operator-web, infra

## Context
Baseline keamanan kuat (JWT, CSRF, RBAC, rate limit, security headers) tapi belum ada laporan audit keamanan final dan secret review. Production masih mengandalkan `.env`.

## Acceptance Criteria
- [ ] Buat `docs/security-audit-report.md` yang mendaftar tiap item sebagai aman / perlu perbaikan / tidak ada.
- [ ] Verifikasi JWT/session, refresh token rotation, CSRF, RBAC, feature gate, backend authorization.
- [ ] Verifikasi TLS produksi: HTTPS domain, `COOKIE_SECURE=true`, HSTS, header reverse proxy.
- [ ] Verifikasi CORS allowlist domain produksi, DB SSL, PII masking non-ANALISA.
- [ ] Pastikan tidak ada secret yang di-log/commit/didokumentasikan.
- [ ] Setiap temuan diberi label P0/P1/P2/P3; P0/P1 punya rencana fix.

## Verification
- `cd services/api-gateway && npm test`
- `cd apps/operator-web && npm run lint && npm run build`
- Review manual `.env.example`, compose env, Caddy profile, auth/security files.

## References
- `docs/production-readiness-monitoring-angkot.md` §9
- `docs/plans/2026-06-30-advanced-government-monitoring-ai-unfinished-tasks.md` PR-P1
