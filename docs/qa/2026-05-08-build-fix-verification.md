# Build Fix Verification - Monitoring Angkot

Tanggal: 2026-05-08

Dokumen ini menutup ulang temuan P0/P1 dari QA report sebelumnya dan mencatat browser regression setelah fix.

## Fix Summary

| Area | Perubahan | Status |
| --- | --- | --- |
| `notification-service` Docker build | Menambahkan `services/notification-service/package-lock.json` agar `npm ci` reproducible | Fixed |
| `operator-web` missing `jose` | Menambahkan dependency `jose` dan lockfile entry | Fixed |
| `operator-web` Docker install determinism | Dockerfile memakai `npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund` dan `test -x node_modules/.bin/next` | Fixed |
| Active DB schema drift | Apply `db/migrations/015_heatmap_data.sql` ke volume aktif | Fixed |
| Fresh DB bootstrap | Menambahkan migration `014` dan `015` ke `infra/docker-compose/initdb/001_bootstrap.sql` | Fixed |
| Public tracking rate limit | `/public/vehicles` dipisahkan dari global limiter dan memakai `PUBLIC_TRACKING_RATE_LIMIT_*` | Fixed |
| Map/report image CSP | Menambahkan `*.basemaps.cartocdn.com` dan API localhost image origin ke frontend CSP | Fixed |
| Lint warnings | Menghapus import label yang tidak dipakai | Fixed |

## Verification Commands

```bash
npm run lint
node --check services/api-gateway/src/server.js
docker compose -f infra/docker-compose/docker-compose.yml up -d --build
docker compose -f infra/docker-compose/docker-compose.yml ps
curl -fsS http://localhost:4000/health
curl -I -sS http://localhost:3000/auth/login
```

## Runtime Results

| Check | Result |
| --- | --- |
| Full Docker compose build | Pass |
| `api-gateway` health | `200`, healthy |
| `operator-web` start | `http://localhost:3000`, running |
| `notification-service` start | Running; health listener on `4101` |
| Heatmap status | `200`, returns generated `NGETEM_ZONE`, `SPEED_ZONE`, `STOP_DENSITY` rows |
| Operator login | Pass, redirects to `/dashboard` |
| Desktop/tablet/mobile screenshots | Captured |
| Incident action | Browser clicked `Acknowledge`; API returned `200`; incident status changed to `DITANGANI` |
| Public reports queue | Seeded QA report appears with attachment and monitoring context |
| Role navigation | Operator sees operational menu; Analisa redirects to `/dashboard/reports` and has admin/analysis navigation |
| Keyboard pass | Login controls are tabbable; focus order has an accessibility issue noted below |
| Public tracking load | 120 requests, concurrency 20, `120/120` HTTP `200` |

## Evidence Files

- `docs/qa/evidence/2026-05-08/dashboard-desktop.png`
- `docs/qa/evidence/2026-05-08/dashboard-tablet.png`
- `docs/qa/evidence/2026-05-08/dashboard-mobile.png`
- `docs/qa/evidence/2026-05-08/incident-action-after-ack.png`
- `docs/qa/evidence/2026-05-08/public-reports-queue.png`
- `docs/qa/evidence/2026-05-08/analisa-role-navigation.png`
- `docs/qa/evidence/2026-05-08/keyboard-focus-login.png`

## Remaining Issues

| Severity | Issue | Evidence | Recommendation |
| --- | --- | --- | --- |
| Medium | Next.js 16 still warns that `middleware.ts` is deprecated in favor of `proxy.ts` | Docker build warning | Migrate `apps/operator-web/src/middleware.ts` to `proxy.ts` in a follow-up while preserving JWT verification |
| Medium | Redis still logs `allkeys-lru` warning; client expects `noeviction` | API logs | Change Redis maxmemory policy or document why evictable keys are acceptable |
| Medium | Login keyboard order focuses `Lupa password?` before password input | Keyboard focus capture | Reorder DOM/tab flow so email -> password -> forgot password -> submit |
| Low | `/health` endpoint remains under global limiter | 120-request smoke returned some `429` after previous QA traffic | Accept for now or exempt health from global limiter if used by frequent probes |

## Updated QA Decision

Build and runtime blockers are fixed. The website is now suitable for continued functional QA and demo smoke testing, with the remaining issues above tracked as non-P0 follow-ups.
