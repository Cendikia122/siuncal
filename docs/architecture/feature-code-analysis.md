# Analisis Kode — Fitur Utama Dashboard Monitoring Angkot

Dokumen teknis untuk Pemda Bogor: bagaimana fitur inti bekerja di kode, jejak file:baris, dan catatan pustaka (versi terkini via Context7). Backend utama: `services/api-gateway/src/server.js` (Express, ~5k baris) + worker terpisah.

## Peta arsitektur singkat

```
GPS/simulator --HTTP--> api-gateway --(Postgres+PostGIS+TimescaleDB)
                             |  \--(Redis: rate-limit, cache, BullMQ)--> worker (review, heatmap)
                             |  \--(MinIO: evidence foto)
                             \--WebSocket /realtime--> operator-web (peta, panel)
rules-engine --(Postgres)--> anomalies/alerts ; notification-service --(log)
```

## 1. Realtime monitoring (peta operator)

- **WebSocket server**: `server.js` `new WebSocketServer({ server, path: "/realtime" })`. Klien (operator-web) connect, kirim filter (route/status) lewat query.
- **Loop broadcast** (`setInterval(realtimeIntervalMs=5000)`): query **sekali per tick** (`fetchLatestVehicles`, `fetchLatestPassengers`, `fetchOpenIncidents`, `fetchUnreadNotificationCount`, `fetchNotifications`) lalu broadcast ke semua klien dengan filter di memori. WS3 memperbaiki: notification list di-fetch sekali per tick (bukan per klien).
- **Sumber posisi**: `vehicle_latest` (state terakhir) + `vehicle_positions` (riwayat, **hypertable TimescaleDB** `001_init.sql`).
- **Catatan pustaka (Context7 · `ws`)**: `ws` adalah server WebSocket Node standar; v8.17.1+ menutup advisory DoS header (sudah di-`npm audit fix`). Untuk multi-instance WS perlu Redis pub/sub (lihat scale-out).

## 2. Telemetry ingestion + map-matching

- **Endpoint**: `POST /telemetry/vehicle` (`server.js`) → `rateLimitTelemetry` + `verifyTelemetryAuth` (token/HMAC).
- **Kontrak & validasi**: `telemetry-contract.js` `normalizeVehicleTelemetry` (lat/lon, speed 0–200, heading 0–360, status enum, ts ISO; dukung field legacy `heading_deg`/`mode`).
- **Resolusi kendaraan**: `vehicle_id` → `plate_no` → `imei_or_serial`/`device_id` (tabel `devices` → `assignments` aktif). Lihat `docs/runbooks/gps-gt06-integration.md`.
- **Map-matching**: `persistMatchedTelemetryPosition` menulis `telemetry_matched_positions` (snap ke koridor rute PostGIS) → dasar deteksi OFF_ROUTE/WRONG_DIRECTION. Konfigurasi `MAP_MATCHING_*`, `OFF_ROUTE_METERS`.

## 3. Rules engine (anomali operasional)

- **Service**: `services/rules-engine/src/index.js` (loop periodik, baca Postgres).
- **Aturan**: NGETEM (berhenti lama di luar stop resmi), OFF_ROUTE (keluar koridor, hanya `IN_SERVICE`), OVERSPEED, LOST_SIGNAL, WRONG_DIRECTION. Pengecualian `DEADHEAD_TO_BASE`.
- **Output**: tabel `anomalies` + `alerts` (index `(status, severity, last_seen_at)`), jadi sumber pembuatan incident.

## 4. Incident center

- **List/detail**: `GET /incidents`, `GET /incidents/:id`. **Aksi**: `POST /incidents/:id/actions` (`server.js`) — `ACKNOWLEDGE`→IN_PROGRESS, `ASSIGN` (`assigned_to`), `RESOLVE`→RESOLVED, `FALSE_ALARM`. Mutasi butuh **CSRF** (`x-csrf-token`).
- **Audit**: tiap aksi tercatat di `incident_actions` + `audit_logs` (`INCIDENT_*`). SLA via `SLA_ACK_MINUTES`/`SLA_RESOLVE_MINUTES`.
- **UI**: `apps/operator-web/.../incidents/[id]/page.tsx` (kini + pintasan keyboard A/R/F, WS4).

## 5. Public report + tinjauan otomatis (rules-assisted)

- **Submit** (mobile, login PUBLIC_USER): `POST /public/reports` multipart `attachments` → foto ke **MinIO** (`object-storage.js`) + metadata `public_report_attachments` + checksum SHA-256. Plat input warga dicocokkan → `plate_match_status` (`MATCHED_VEHICLE`/`UNMATCHED_PLATE`). Setelah upload, queue `public-report-ocr` menjalankan OCR lokal asynchronous. Hasil OCR disimpan sebagai evidence operator dan tidak mengubah `plate_match_status`.
- **Review otomatis**: `public-report-review.js` — **BullMQ worker** (`new Worker(...)`), verdict **deterministik** (`review_mode: rules_assisted_summary`, BUKAN LLM) dari bukti: jarak laporan↔kendaraan, window telemetry, anomali/alert terkait. Skor kepercayaan dapat dijelaskan. Operator tetap keputusan final.
- **Catatan pustaka (Context7 · BullMQ)**: antrian berbasis Redis; job dedup pakai `jobId` (commit review fix), `removeOnComplete/Fail`. Worker dipisah ke proses sendiri (WS3).

## 6. Heatmap, network, sanction, compliance

- **Heatmap**: `heatmap-worker.js` (BullMQ) menghasilkan zona STOP_DENSITY/NGETEM_ZONE/SPEED_ZONE dari `vehicle_positions` + PostGIS `ST_DWithin`. Endpoint `/analytics/heatmap/*`.
- **Network graph**: `/network/graph` (relasi owner-vehicle-device-incident-sanction), render `@xyflow/react` di UI.
- **Sanction & compliance**: `/sanctions/*`, `/compliance/fleet` — keputusan manual + audit; ANALISA-only.

## 7. Keamanan lintas fitur

- **RBAC**: `requireRole(["ANALISA"])`/`["OPERATOR","ANALISA"]`; data sensitif (NIK, alamat, IMEI) hanya ANALISA + `audit_logs`.
- **CSRF**: double-submit cookie `sentra_csrf` + header (`csrfGuard`).
- **Rate limit & cache**: Redis-backed (`redis.js`, WS2) — konsisten multi-instance; `/public/vehicles` di-cache 3 dtk.
- **Telemetry auth**: token statis atau HMAC (`verifyTelemetryAuth`).

## Referensi cepat (file)

| Fitur | File utama |
|-------|-----------|
| API + realtime + auth | `services/api-gateway/src/server.js` |
| Rate-limit/cache Redis | `services/api-gateway/src/redis.js` |
| Worker (review+heatmap) | `services/api-gateway/src/worker.js`, `public-report-review.js`, `heatmap-worker.js` |
| Kontrak telemetry | `services/api-gateway/src/telemetry-contract.js` |
| Rules engine | `services/rules-engine/src/index.js` |
| Skema/migration | `db/migrations/001_init.sql` … `015_heatmap_data.sql` |
| UI dashboard | `apps/operator-web/src/app/dashboard/**` |
