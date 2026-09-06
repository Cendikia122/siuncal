# Production TLS, HSTS, and security headers validation

- **Status:** ready-for-agent
- **Type:** task
- **Scope:** fullstack
- **Priority:** P2
- **Doc status:** PARTIAL
- **Component:** api-gateway, operator-web, infra

## Context
Security headers dan Caddy TLS profile sudah ada, tapi belum divalidasi pada domain produksi (HSTS, `COOKIE_SECURE`, CSP tidak memblokir asset, forwarding header Caddy).

## Acceptance Criteria
- [ ] Verifikasi domain produksi memakai HTTPS.
- [ ] Verifikasi HSTS aktif hanya saat aman di domain produksi.
- [ ] Verifikasi `COOKIE_SECURE=true` pada HTTPS produksi.
- [ ] Verifikasi CSP API dan web tidak memblokir asset produksi yang dibutuhkan.
- [ ] Verifikasi Caddy meneruskan `X-Forwarded-*`.
- [ ] Setiap pengecualian dicatat di security audit report.

## Verification
- `curl -I https://<domain>`
- Browser login smoke over HTTPS.

## References
- `docs/production-readiness-monitoring-angkot.md` §2.1, §9
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P2 TLS/HSTS
