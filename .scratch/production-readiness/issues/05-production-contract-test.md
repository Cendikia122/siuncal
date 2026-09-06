# Dedicated production contract test

- **Status:** done
- **Type:** task
- **Scope:** backend
- **Priority:** P2
- **Doc status:** DONE
- **Component:** api-gateway

## Context
Beberapa contract test sudah ada, tapi belum ada safety net kontrak produksi khusus untuk menjaga kompatibilitas API saat refactor. Live HTTP contract test kini memverifikasi response aktual saat stack tersedia dan skip secara eksplisit pada unit job tanpa API; job `api-live-integration` menjalankannya terhadap stack aktif.

## Acceptance Criteria
- [x] Buat `services/api-gateway/test/production-contract.test.js`.
- [x] Assert list endpoint konsisten `{ items, total, page, limit }`.
- [x] Assert error response `{ error: { code, message } }`.
- [x] Assert 429 menyertakan header `Retry-After`.
- [x] Assert dashboard endpoint 401 tanpa auth, 403 untuk role tidak cukup.

## Verification

- `SMOKE_BASE_URL=http://localhost:4000 node --test test/production-contract.test.js` → 4 test pass, 0 fail, 0 skip.
- `cd services/api-gateway && npm test` → 106 test pass, 0 fail, 0 skip.

## References
- `docs/production-readiness-monitoring-angkot.md` P2-4
- `docs/plans/2026-06-30-...unfinished-tasks.md` PR-P2 Production Contract Test

## Comments

- 2026-07-23 — Selesai. Kontrak pagination, error envelope, otorisasi dashboard, serta respons rate-limit diverifikasi langsung melalui HTTP dengan bucket rate-limit terisolasi per proses test.
