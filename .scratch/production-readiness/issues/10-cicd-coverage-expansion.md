# CI/CD coverage expansion

- **Status:** done
- **Type:** task
- **Scope:** parallel
- **Priority:** P2
- **Doc status:** DONE
- **Component:** infra (.github/workflows), all services

## Context
Issue awal dibuat ketika `.github/workflows/ci.yml` baru mencakup baseline P0 dan API live integration. Audit 2026-07-23 menemukan seluruh perluasan job sudah committed sejak `e3f5c98`; gap runtime yang tersisa adalah plain `npm ci` operator-web gagal karena dependency React 18 yang tidak digunakan serta lockfile legacy. Dependency mati tersebut dihapus dan lockfile dinormalisasi untuk Node 20.

## Acceptance Criteria
- [x] Job `service-unit-tests` matrix untuk api-gateway, rules-engine, notification-service (`npm ci` + `npm test`).
- [x] Job `operator-web-quality` (`npm ci` + lint + build).
- [x] Job `readiness-assessment` (`node --test scripts/readiness-assessment.test.mjs` + `readiness-assessment.mjs --json`).
- [x] Job `operator-web-e2e` (manual/conditional dulu via `workflow_dispatch`).
- [x] Job `passenger-mobile-test` bila Flutter tersedia di CI.
- [x] Jangan hapus Docker Compose validation & API live integration yang sudah ada; jangan commit secret.

## Verification

- Docker Compose config dengan `.env.example` → exit `0`.
- Readiness assessment → 10 test pass; render JSON → exit `0`.
- Service matrix setelah `npm ci`: api-gateway 102 pass, rules-engine 45 pass, notification-service 2 pass.
- Operator web: plain `npm ci` lulus di Node 20; lint dan production build lulus.
- Passenger mobile: `flutter pub get` dan 28 test lulus dengan Flutter stable.
- Playwright config menemukan 1 smoke spec; job `operator-web-e2e` tetap manual melalui `workflow_dispatch`, memasang Chromium, dan bergantung pada web quality + API live integration.
- Workflow mempertahankan Docker Compose validation dan API live integration; tidak ada secret produksi ditambahkan.

## References
- `docs/production-readiness-monitoring-angkot.md` P0-2

## Comments

- 2026-07-23 — Selesai. Workflow expansion existing diverifikasi; blocker `npm ci` operator-web diperbaiki dengan menghapus `react-leaflet-cluster` yang tidak dipakai dan memperbarui lockfile tanpa mengubah stack UI.
