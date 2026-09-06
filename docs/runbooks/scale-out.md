# Runbook — Scale-Out (eksekusi saat trafik tumbuh)

Status: **sebagian sudah diterapkan dan local smoke lulus.** Sistem saat ini cukup untuk pilot. Item yang **sudah** diberlakukan: rate-limit & cache berbasis Redis (`redis.js`), worker terpisah (`worker.js`), PgBouncer di Docker Compose, Redis Pub/Sub trigger untuk WebSocket fan-out, dan scale override untuk Caddy/proxy mode. Ulangi smoke multi-instance sebelum setiap production rollout.

## Indikator kapan menerapkan

| Sinyal | Tindakan |
|--------|----------|
| Latensi `/public/vehicles` p95 naik / DB CPU tinggi saat jam sibuk | API multi-instance + CDN (#1, #4) |
| `vehicle_positions` tumbuh > puluhan juta baris | TimescaleDB compression + retention (#3) |
| Koneksi DB mendekati `max` | PgBouncer (#2) |
| Beban baca laporan/analitik berat | Read replica (#2) |

## 1. API multi-instance (horizontal)

Rate-limit & cache sudah konsisten lintas instance (Redis), worker sudah terpisah → API bisa di-scale:

```sh
./scripts/scale-up.sh 3
```

- Pasang **reverse proxy/LB** (Caddy, `docs/runbooks/...` / WS6) round-robin.
- Scale mode memakai `infra/docker-compose/docker-compose.scale.yml` untuk menghapus fixed host port `api-gateway`, lalu akses API lewat Caddy (`https://api.localhost` untuk smoke lokal).
- **WebSocket**: Redis Pub/Sub trigger sudah ada di `server.js`/`realtime-broadcaster.js`. Setiap instance subscribe ke `REALTIME_BROADCAST_CHANNEL` (`realtime:broadcast` default), skip event dari instance sendiri, lalu refresh broadcast lokal tanpa re-publish. Scheduled tick memakai Redis leader lock `REALTIME_BROADCAST_LOCK_KEY` supaya hanya satu instance aktif yang publish trigger per interval. Local smoke 2 replica sudah lulus; ulangi sebelum production rollout.
- Set `app.set("trust proxy", 1)` di Express (sudah ditambahkan saat memasang Caddy) agar `req.ip` = IP klien asli (X-Forwarded-For) — penting untuk rate-limit per-IP.

## 2. PgBouncer + read replica

- **PgBouncer** (transaction pooling) sudah ada di `infra/docker-compose/docker-compose.yml` dengan image `edoburu/pgbouncer:v1.25.2-p0`. Compose mengarahkan `api-gateway`, `worker`, `rules-engine`, dan `notification-service` ke `PGBOUNCER_HOST=pgbouncer` / `PGBOUNCER_PORT=6432`.
  ```ini
  [databases]
  Sentra = host=postgres port=5432 dbname=Sentra
  [pgbouncer]
  pool_mode = transaction
  max_client_conn = 500
  default_pool_size = 50
  ```
  Catatan: mode `transaction` tidak mendukung session-level features tertentu. App Node `pg` saat ini tidak memakai named prepared statement, jadi jalur ini aman untuk query yang ada.
- **Read replica**: streaming replication Postgres; arahkan query analitik/laporan berat (reports, intelligence, network) ke replica. Tambahkan pool baca terpisah di `db.js` (mis. `readPool`) dan pakai untuk endpoint read-only.

## 3. TimescaleDB: compression + retention untuk `vehicle_positions`

`vehicle_positions` adalah hypertable (`db/migrations/001_init.sql`). Ratusan tracker × ping detik = jutaan baris/hari. Aktifkan kompresi + retensi.

**Sintaks klasik (image saat ini `timescaledb-ha:pg13`):**
```sql
ALTER TABLE vehicle_positions SET (
  timescaledb.compress,
  timescaledb.compress_segmentby = 'vehicle_id',
  timescaledb.compress_orderby   = 'ts DESC'
);
-- kompres chunk yang lebih tua dari 7 hari
SELECT add_compression_policy('vehicle_positions', INTERVAL '7 days');
-- hapus data lebih tua dari 90 hari (sesuaikan kebijakan retensi Pemda)
SELECT add_retention_policy('vehicle_positions', INTERVAL '90 days');
```
Pertimbangkan **continuous aggregate** untuk laporan harian (rit/KPI) agar tak men-scan raw:
```sql
CREATE MATERIALIZED VIEW vehicle_daily WITH (timescaledb.continuous) AS
SELECT vehicle_id, time_bucket('1 day', ts) AS day,
       count(*) AS pings, avg(speed_kmh) AS avg_speed
FROM vehicle_positions GROUP BY vehicle_id, day;
SELECT add_continuous_aggregate_policy('vehicle_daily',
  start_offset => INTERVAL '3 days', end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```
> TimescaleDB 2.18+ memakai istilah *columnstore* (`ALTER TABLE ... SET (timescaledb.enable_columnstore, timescaledb.segmentby=...)` + `add_columnstore_policy`). Sintaks `compress` di atas tetap didukung. Cek versi: `SELECT extversion FROM pg_extension WHERE extname='timescaledb';`.

Terapkan via:
```sh
docker compose ... exec -T postgres psql -v ON_ERROR_STOP=1 -U monitoring -d Sentra -f /db/migrations/0XX_timescale_policies.sql
```
(buat file migration baru, jangan ubah yang lama).

## 4. CDN / cache tepi untuk `/public/vehicles`

Endpoint sudah mengirim `Cache-Control: public, max-age=3` + cache Redis. Tambah **CDN** (Cloudflare/edge) di depan domain publik agar polling warga dilayani di tepi, mengurangi beban origin. Pastikan hanya endpoint publik read-only yang di-cache CDN (jangan endpoint terotentikasi).

## 5. Observability saat scale

- Metering: ping rate, lost-signal count, latensi incident, kedalaman antrian BullMQ.
- Alert: lonjakan lost-signal, antrian worker menumpuk, lag replica, DB connection saturation.
