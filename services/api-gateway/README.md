# api-gateway

Entry point API + autentikasi + RBAC + realtime feed untuk dashboard operator.

## Menjalankan
```sh
cd services/api-gateway
cp .env.example .env
npm install
npm run dev
```

Pastikan Postgres + TimescaleDB + PostGIS sudah berjalan dari:
```sh
docker compose -f infra/docker-compose/docker-compose.yml up -d
```

## Endpoint utama
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `GET /me`
- `GET /users`
- `POST /users`
- `GET /owners`
- `GET /owners/:id`
- `POST /owners`
- `PATCH /owners/:id`
- `GET /vehicles`
- `GET /vehicles/:id`
- `GET /vehicles/:id/playback?start=&end=`
- `POST /vehicles/:id/playback/records`
- `GET /vehicles/:id/playback/records`
- `POST /vehicles`
- `PATCH /vehicles/:id`
- `POST /vehicles/:id/documents`
- `GET /incidents`
- `GET /incidents/:id`
- `POST /incidents/:id/actions`
- `GET /incidents/sla`
- `GET /notifications`
- `POST /notifications/read`
- `GET /routes`
- `POST /routes`
- `PATCH /routes/:id`
- `POST /routes/:id/corridor`
- `GET /stops`
- `POST /stops`
- `PATCH /stops/:id`
- `DELETE /stops/:id`
- `GET /geofences`
- `POST /geofences`
- `PATCH /geofences/:id`
- `DELETE /geofences/:id`
- `GET /drivers`
- `POST /drivers`
- `PATCH /drivers/:id`
- `GET /devices`
- `GET /devices/health`
- `GET /telemetry/quality`
- `GET /telemetry/quality/export`
- `POST /devices`
- `PATCH /devices/:id`
- `GET /assignments`
- `POST /assignments`
- `PATCH /assignments/:id`
- `GET /dashboard/summary`
- `GET /activities`
- `GET /audit-logs`
- `GET /reports/kpi`
- `GET /reports/rit`
- `POST /telemetry/vehicle`
- `POST /map-matching/spike` (`ANALISA`)
- `WS /realtime`
  - Params: `route_id`, `vehicle_status`, `incident_status`, `incident_severity`, `incident_type`
  - Event notifikasi: `NOTIFICATION_LIST`, `NOTIFICATION_NEW`

## Reporting job (harian)
```sh
npm run report:daily
# atau
REPORT_DATE=2026-01-25 npm run report:daily
# generate report hari ini dari data simulator
REPORT_DATE=$(TZ=Asia/Jakarta date +%F) npm run report:daily
```

Dashboard Reports memakai data real dari `report_kpi_daily` dan `report_rit_daily`. Export rit tersedia untuk role `ANALISA` lewat:
- `GET /reports/rit/export?format=csv&date=YYYY-MM-DD`
- `GET /reports/rit/export?format=pdf&date=YYYY-MM-DD`

Jika tabel laporan masih kosong, jalankan simulator telemetry dulu lalu jalankan job report untuk tanggal yang sama.

## Security notes
- `JWT_SECRET` wajib diisi dengan nilai non-dev ketika `NODE_ENV=production` atau `NODE_ENV=staging`.
- Request cookie-based selain `GET/HEAD/OPTIONS` wajib membawa header `x-csrf-token` yang sama dengan cookie `sentra_csrf`.
- `POST /telemetry/vehicle` memiliki rate limit in-memory. Atur `TELEMETRY_RATE_LIMIT_WINDOW_MS` dan `TELEMETRY_RATE_LIMIT_MAX` bila diperlukan.
- Untuk ingestion di luar lokal, set `TELEMETRY_INGEST_TOKEN` dan/atau `TELEMETRY_HMAC_SECRET`. Jika HMAC aktif, device mengirim `x-telemetry-timestamp` dan `x-telemetry-signature` berisi hex HMAC-SHA256 dari `timestamp.body_json`.

## Playback record storage
Record playback disimpan sebagai JSON ke MinIO/S3-compatible storage dan metadata disimpan di tabel `playback_records`.

`GET /vehicles/:id/playback` mengembalikan raw GPS dan field matched per point jika tersedia:
- `snapped_lat`, `snapped_lon`
- `match_status`, `match_confidence`, `match_provider`
- `road_segment`, `snap_distance_m`, `distance_along_route_m`, `matched_heading`

Raw GPS tetap berasal dari `vehicle_positions`; hasil matching disimpan terpisah di `telemetry_matched_positions`.

Environment yang diperlukan:
```sh
S3_ENDPOINT=http://localhost:9000
S3_PUBLIC_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
PLAYBACK_RECORD_BUCKET=playback-records
PLAYBACK_MAX_RANGE_HOURS=24
PLAYBACK_MAX_POINTS=5000
MAP_MATCHING_PROVIDER=local_postgis
MAP_MATCHING_MAX_SNAP_DISTANCE_METERS=80
MAP_MATCHING_MIN_CONFIDENCE=0.35
```
