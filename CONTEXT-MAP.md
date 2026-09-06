# CONTEXT-MAP — Sentra (Monitoring Angkot)

Repo ini **multi-context**. File ini adalah indeks: ia menunjuk ke satu `CONTEXT.md` per konteks (per app/service). Glosarium & prinsip lintas-sistem ada di `CONTEXT.md` root. Aturan cara skill mengonsumsi dokumen domain ada di `docs/agents/domain.md`.

> Per-context `CONTEXT.md` dibuat **lazily** oleh `grill-with-docs` saat istilah/keputusan konteks itu benar-benar diperlukan. Jika sebuah file belum ada, lanjutkan diam-diam (jangan tandai sebagai kekurangan).

## Root
- `CONTEXT.md` — glosarium & prinsip domain lintas-sistem.
- `docs/adr/` — Architecture Decision Records skala sistem.

## Konteks

| Konteks | Path | CONTEXT.md | ADR konteks | Ringkas |
|---|---|---|---|---|
| Operator Web | `apps/operator-web/` | `apps/operator-web/CONTEXT.md` _(belum ada)_ | `apps/operator-web/docs/adr/` _(belum ada)_ | Dashboard operator Next.js: peta realtime, incident center, analytics, master data, review laporan. |
| Passenger Mobile | `apps/passenger-mobile/` | `apps/passenger-mobile/CONTEXT.md` _(belum ada)_ | `apps/passenger-mobile/docs/adr/` _(belum ada)_ | App Flutter masyarakat: tracking publik, submit laporan, SOS, passenger telemetry. |
| API Gateway | `services/api-gateway/` | `services/api-gateway/CONTEXT.md` _(belum ada)_ | `services/api-gateway/docs/adr/` _(belum ada)_ | Express + WebSocket `/realtime`, auth/RBAC/CSRF, public report + review worker, OCR, heatmap, emergency, telemetry quality. |
| Telemetry Ingestion | `services/telemetry-ingestion/` | `services/telemetry-ingestion/CONTEXT.md` _(belum ada)_ | `services/telemetry-ingestion/docs/adr/` _(belum ada)_ | Ingest GPS + simulator; validasi kontrak telemetry; map-matching. |
| Rules Engine | `services/rules-engine/` | `services/rules-engine/CONTEXT.md` _(belum ada)_ | `services/rules-engine/docs/adr/` _(belum ada)_ | Deteksi anomali (NGETEM/OFF_ROUTE/OVERSPEED/LOST_SIGNAL/WRONG_DIRECTION), risk scoring, collective anomaly. |
| Notification Service | `services/notification-service/` | `services/notification-service/CONTEXT.md` _(belum ada)_ | `services/notification-service/docs/adr/` _(belum ada)_ | Notifikasi in-app (nyata); gateway eksternal WA/SMS/email masih log-only. |
| Database | `db/` | `db/CONTEXT.md` _(belum ada)_ | — | Migration 001-015, seed; Postgres + PostGIS + TimescaleDB. |
| Infra | `infra/` | `infra/CONTEXT.md` _(belum ada)_ | — | docker-compose, Caddy, PgBouncer, monitoring, k8s (path terdokumentasi). |

## Catatan
- Layout multi-context ini adalah keputusan ADR-0007.
- Untuk overview fitur & status implementasi, lihat `.scratch/FEATURE-STATUS.md`.
