# Deployment go-live checklist execution

- **Status:** ready-for-human
- **Type:** task
- **Scope:** backend
- **Priority:** P1
- **Doc status:** PARTIAL (operational)
- **Component:** infra

## Context
`scripts/health-check.sh` dan checklist sudah ada dan tidak lagi memakai command palsu, tapi eksekusi go-live nyata (rotasi secret produksi, TLS cert, DNS, backup, load test PASS) belum dijalankan. Butuh akses environment produksi → keputusan/operasi manusia.

## Acceptance Criteria
- [ ] Konfirmasi `MOCK_MODE=false` di runtime produksi.
- [ ] Ganti `JWT_SECRET`, `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `MINIO_ROOT_PASSWORD` dari default.
- [ ] Pasang & verifikasi SSL/HTTPS cert; konfirmasi DNS mengarah ke server produksi.
- [ ] Set Sentry DSN bila dipakai; download & verifikasi backup DB terbaru.
- [ ] Jalankan load test + lampirkan bukti PASS; jalankan `scripts/health-check.sh` pasca-deploy.
- [ ] Verifikasi WebSocket, login flow, dashboard data real, `/public/vehicles`, tidak ada error spike.

## Verification
- `./scripts/health-check.sh`; API curl smoke `/health`, `/ready`, `/public/vehicles`.

## References
- `docs/production-readiness-monitoring-angkot.md` §11
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P1 Deployment Go-Live
