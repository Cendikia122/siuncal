# Formal compose healthchecks (rules-engine & notification-service)

- **Status:** done
- **Type:** chore
- **Scope:** backend
- **Priority:** P2
- **Doc status:** DONE
- **Component:** infra, rules-engine, notification-service

## Context
Issue awal dibuat ketika dokumentasi QA masih menyatakan Docker Compose belum memiliki healthcheck formal untuk `rules-engine` dan `notification-service`. Audit implementasi pada 2026-07-23 menemukan healthcheck berbasis endpoint `/health` sudah ada di compose sejak 2026-06-03; gap yang tersisa adalah verifikasi runtime dan sinkronisasi tracker/dokumentasi.

## Acceptance Criteria
- [x] Tambah endpoint/`healthcheck` compose untuk rules-engine (`/health` sudah ada) dan notification-service (`/health` sudah ada).
- [x] Compose menandai service healthy/unhealthy dengan benar.
- [x] `docker compose ... config --quiet` lulus.

## Verification

- `docker compose --env-file infra/docker-compose/.env -f infra/docker-compose/docker-compose.yml config --quiet` → exit `0`.
- Stack aktif: endpoint internal kedua service mengembalikan HTTP `200` dengan `{"ok":true,...}` dan Docker melaporkan keduanya `healthy`.
- Negative-path terisolasi: container temporer dengan database sengaja tidak terjangkau ditandai `unhealthy` untuk kedua service setelah dua probe gagal (`exit 1`); container temporer kemudian dibersihkan.
- `cd services/rules-engine && npm test` → 45 test pass, 0 fail.
- `cd services/notification-service && npm test` → 2 test pass, 0 fail.

## References
- `docs/qa/final-demo-readiness.md` Resolved Since Original Audit

## Comments

- 2026-07-23 — Selesai. Implementasi compose yang sudah ada diverifikasi untuk jalur healthy dan unhealthy; tracker serta dokumentasi QA diselaraskan dengan kondisi runtime aktual.
