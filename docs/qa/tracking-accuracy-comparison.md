# Tracking Accuracy Comparison: Pre vs Post Map Matching

**Tanggal audit:** 2026-05-20  
**Auditor:** Evidence-based review via git diff, kode, Docker runtime, dan query DB  
**Branch:** production (HEAD)

---

## Commit Baseline yang Dibandingkan

| Label | Commit | Deskripsi |
|-------|--------|-----------|
| **Baseline lama** | `60b92f5` | Phase 10/11 sebelum OSRM dan map matching |
| **Seed OSRM** | `897946b` | `seed: rebuild Bogor angkot routes and geofences` |
| **Map matching full** | `a114e42` | matched storage, rules engine OFF_ROUTE/WRONG_DIRECTION, trip progress, playback raw vs matched |
| **HEAD saat ini** | `b8b9576` | security fixes (tidak mengubah matching logic) |

---

## Ringkasan Perubahan Kode

### 1. Route Geometry

| Aspek | Baseline (60b92f5) | Sekarang (HEAD) |
|-------|--------------------|-----------------|
| Buffer radius | 15 m | 8 m (OSRM-snapped) |
| Titik per direction (Route 01) | 17 outbound / 20 inbound | **978 outbound / 1002 inbound** |
| Titik per direction (Route 02) | 20 outbound / 17 inbound | **1253 outbound / 1442 inbound** |
| Titik per direction (Route 03) | 17 outbound / 20 inbound | **907 outbound / 1152 inbound** |
| Panjang Route 01 outbound | ~tidak representatif | 19.69 km |
| Panjang Route 02 outbound | ~tidak representatif | 24.50 km |
| Panjang Route 03 outbound | ~tidak representatif | 18.21 km |
| Sumber geometry | Manual/rough polyline | **OSRM road network prefetch (2026-05-09)** |

OSRM menghasilkan ~50-90x lebih banyak titik per geometry, mengikuti network jalan aktual Bogor.

### 2. Geofence

| Aspek | Baseline | Sekarang |
|-------|----------|----------|
| Total geofences | 22 (dari git: `DELETE 22` di seed 003) | **3** |
| Tipe tersedia | TERMINAL, STOP, HALTE, BASE, NGETEM, ROUTE_CORRIDOR | **ROUTE_CORRIDOR saja** |
| Pembuat | Seed manual awal | Seed 003 OSRM: `DELETE FROM geofences` lalu `INSERT ROUTE_CORRIDOR` |

**⚠ MASALAH KRITIS:** Seed 003 menghapus seluruh geofence TERMINAL/STOP/HALTE/BASE/NGETEM. Rule `NGETEM` memakai query `WHERE type IN ('TERMINAL', 'STOP', 'HALTE')` — tanpa geofence ini, exception official stop tidak akan aktif, sehingga potensi **false positive NGETEM meningkat** di terminal/halte.

### 3. Telemetry Ingestion

| Aspek | Baseline | Sekarang |
|-------|----------|----------|
| Table dipopulasi | `vehicle_positions` saja | `vehicle_positions` + `telemetry_matched_positions` |
| Response API | `{"ok": true}` | `{"ok": true, "matched_position": {...}}` |
| Auth endpoint | Tidak ada guard | `TELEMETRY_INGEST_TOKEN` wajib (503 jika tidak dikonfigurasi) |
| Storage matched | Tidak ada | `snapped_lat/lon`, `snap_distance_m`, `distance_along_route_m`, `matched_heading`, `confidence` |

### 4. OFF_ROUTE Rule

| Parameter | Baseline (60b92f5) | Sekarang |
|-----------|--------------------|----------|
| `OFF_ROUTE_METERS` default | **30** | **0** |
| `buffer_radius_m` route | **15** | **8** |
| Corridor tolerance total | **45 m** | **8 m** (namun matched → 0 m) |
| Map matching join | Tidak ada | `LEFT JOIN telemetry_matched_positions` |
| Matched point treatment | Raw GPS distance | **distance_m = 0** (tidak pernah off-route) |
| Low confidence fallback | Tidak ada | `snap_distance_m` atau raw GPS |
| `MAP_MATCHING_MIN_CONFIDENCE` | Tidak ada | 0.35 |

### 5. WRONG_DIRECTION Rule

| Aspek | Baseline | Sekarang |
|-------|----------|----------|
| Rule tersedia | **Tidak ada** | **Tersedia** |
| Grace period | - | 3 menit |
| Min points | - | 3 titik |
| Heading threshold | - | 120 derajat |
| Min speed | - | 5 km/h |
| Data source | - | `matched_heading` dari `telemetry_matched_positions` |

### 6. Playback Dashboard

| Aspek | Baseline | Sekarang |
|-------|----------|----------|
| Fields | Raw GPS saja | `snapped_lat`, `snapped_lon`, `snap_distance_m`, `distance_along_route_m`, `matched_heading`, `match_confidence` |
| Toggle | Tidak ada | Raw GPS / Matched |
| Fallback | - | Jika tidak ada matched valid, fallback ke raw |

---

## Metrik Keseluruhan (dari runtime Docker + DB query)

Data diambil dari 40 titik telemetry yang dikirim via API (`/telemetry/vehicle`) dengan token auth yang benar.  
**Seed data (54 titik) tidak dihitung karena bypass API → tidak melewati matching pipeline.**

| Metrik | Nilai |
|--------|-------|
| Total raw telemetry (API-sent) | 40 titik |
| Total matched positions | 40 titik |
| Match rate (MATCHED status) | **80%** (32/40) |
| LOW_CONFIDENCE | **20%** (8/40) |
| Avg raw distance ke route | 737 m (termasuk 4 outlier off-route; median = 14 m) |
| p50 snap distance | 14.1 m |
| p95 snap distance | 7129 m (4 outlier off-route ~7km) |
| Avg confidence (MATCHED only) | 0.79 |
| p50 confidence | 0.82 |
| p95 confidence | 0.99 |

---

## Metrik per Route

| Route | Total pts | MATCHED | LOW_CONF | Old off-route (>45m) | New off-route (>8m eff) | p50 raw dist | p50 snap dist | Avg conf |
|-------|-----------|---------|----------|---------------------|------------------------|--------------|---------------|---------|
| 01 | 19 | 13 (68%) | 6 (32%) | **7** | **6** | 14.1 m | 14.1 m | 0.80 |
| 02 | 11 | 10 (91%) | 1 (9%) | **2** | **1** | 12.0 m | 12.0 m | 0.76 |
| 03 | 10 | 9 (90%) | 1 (10%) | **2** | **1** | 16.9 m | 16.9 m | 0.76 |
| **Total** | **40** | **32 (80%)** | **8 (20%)** | **11** | **8** | **14.1 m** | **14.1 m** | **0.79** |

---

## Perbandingan OFF_ROUTE: Old Logic vs Current Logic

### Pada telemetry via API (40 titik)

| Logic | Off-route count | Off-route % | True off-route | False positive | FP reduction |
|-------|----------------|-------------|----------------|----------------|--------------|
| Lama (raw > 45m) | **11** | 27.5% | 4 | **7** | — |
| Sekarang (matched=0; fallback >8m) | **8** | 20.0% | 4 | **4** | **43%** |

**Peningkatan:** 43% pengurangan false positive untuk telemetry yang melewati API.

### Contoh Low-Confidence Points

| Lat | Lon | Snap dist | Alasan LOW_CONFIDENCE |
|-----|-----|-----------|----------------------|
| -6.594078 | 106.790822 | 95.98 m | Stasiun Bogor: waypoint config.js 96m dari OSRM polyline |
| -6.6501 | 106.8109 | 117.69 m | Cipinang Gading: waypoint config.js 118m dari OSRM polyline |
| -6.5500 | 106.7300 | 7129 m | Intentional off-route: ~7km dari trayek (deteksi benar) |

---

## Dampak ke Rule Accuracy

### OFF_ROUTE False Positive

- **Sebelum:** GPS drift biasa (10-40m dari route) bisa memicu OFF_ROUTE jika drift > 45m threshold. Dengan route geometry kasar, banyak titik on-route yang tampak off-route.
- **Sesudah:** Titik yang ter-match dengan confidence >= 0.35 mendapat `distance_m = 0` → tidak pernah off-route karena GPS drift. Hanya titik yang benar-benar jauh atau gagal match yang dievaluasi.

### WRONG_DIRECTION

- **Sebelum:** Rule tidak ada.
- **Sesudah:** Rule aktif, butuh `matched_heading` dari `telemetry_matched_positions`. Jika tabel ini kosong (misal: seed langsung tanpa API), rule tidak pernah trigger.

### NGETEM

- **Sebelum:** Geofence TERMINAL/STOP/HALTE tersedia untuk exception. Rule tidak trigger di area stop resmi.
- **Sesudah:** **Geofence TERMINAL/STOP/HALTE dihapus oleh seed 003.** Rule masih cek `route_stops` via `ST_DWithin` (radius 120m), tapi geofence check (`WHERE type IN ('TERMINAL', 'STOP', 'HALTE')`) tidak akan hit apapun. Potensi false positive NGETEM naik di area terminal.

---

## Status Geofence

```
Setelah seed 003:
type            | count
----------------+-------
ROUTE_CORRIDOR  |     3
```

**Yang hilang:** TERMINAL, BASE, STOP, HALTE, NGETEM (total 19 geofence dihapus).

**Dampak operasional:**
1. Dashboard overlay geofence terminal/halte tidak tampil.
2. Rule NGETEM tidak bisa exception di terminal kecuali via `route_stops`.
3. Rule `DEADHEAD_TO_BASE` tetap bekerja (memakai `owner.base_lat/lon` langsung).

---

## Masalah yang Ditemukan

### P0 - Kritis (sebelum lomba)

1. **Geofence TERMINAL/STOP/HALTE hilang.**  
   Seed 003 OSRM mengeksekusi `DELETE FROM geofences` sebelum insert ROUTE_CORRIDOR.  
   Rule NGETEM kehilangan exception geofence terminal/halte → potensi false positive.  
   **Fix:** Tambah seed ke-4 atau section di 003 yang restore geofence terminal/halte/base tanpa menghapus ROUTE_CORRIDOR.

2. **Simulator tidak mengirim auth token (sebelum fix ini).**  
   Endpoint `/telemetry/vehicle` return `503 AUTH_NOT_CONFIGURED` jika `TELEMETRY_INGEST_TOKEN` tidak dikonfigurasi.  
   **Status:** ✅ Fixed dalam sesi ini:
   - `infra/docker-compose/.env`: tambah `TELEMETRY_INGEST_TOKEN=sentra-dev-token-2026`
   - `infra/docker-compose/docker-compose.yml`: pass `TELEMETRY_INGEST_TOKEN` ke api-gateway + tambah `vehicle-simulator` service
   - `services/telemetry-ingestion/config.js`: tambah `TELEMETRY_TOKEN` field
   - `services/telemetry-ingestion/simulator.js`: kirim header `x-telemetry-token`

3. **Simulator ROUTES tidak selaras dengan OSRM geometry.**  
   Waypoint di `config.js` (misal: Stasiun Bogor -6.594078, 106.790822 dan Cipinang Gading -6.6501, 106.8109) berjarak 96-118m dari OSRM polyline → selalu LOW_CONFIDENCE (snap>80m).  
   **Fix:** Update waypoints simulator agar menggunakan koordinat yang tepat di atas OSRM polyline, atau naikkan `MAP_MATCHING_MAX_SNAP_DISTANCE_METERS` dari 80 ke 150.

### P1 - Penting (sebelum demo produksi)

4. **`telemetry_matched_positions` tidak terisi dari seed.**  
   Seed langsung ke DB tidak melewati pipeline map matching. Semua 54 titik dari seed tidak punya matched data.  
   Akibat: WRONG_DIRECTION rule tidak pernah aktif dari data seed.  
   **Rekomendasi:** Jalankan simulator via API sebelum demo (simulator profile `vehicle-simulator` sudah ditambahkan).

5. **`OFF_ROUTE_METERS` default turun dari 30 → 0.**  
   Dengan `buffer_radius_m=8` dan `OFF_ROUTE_METERS=0`, toleransi hanya 8m untuk titik LOW_CONFIDENCE/unmatched.  
   Ini sangat ketat untuk GPS consumer-grade (akurasi ±5-15m biasa).  
   **Rekomendasi:** Naikkan `OFF_ROUTE_METERS` ke 15-20 di `.env` untuk mengurangi false positive dari GPS drift pada titik yang gagal match.

### P2 - Minor

6. **Seed 003 route geometry beda coverage area vs seed 001.**  
   Seed 001 membuat routes dengan buffer 90m dan titik kasar di area Bogor.  
   Seed 003 menimpa dengan OSRM geometry yang berbeda area (lebih panjang, 19-24km vs 8-12km di seed 001).  
   Ini sudah benar secara teknis, tapi perlu dipastikan OSRM geometry sesuai trayek resmi Dishub.

7. **`declare -A` (associative array) tidak bekerja di bash 3.x (macOS default).**  
   Bukan bug di kode aplikasi, tapi script test manual perlu adjustment jika dijalankan di macOS.

---

## Rekomendasi Prioritas Sebelum Lomba

### 1. Restore geofence terminal/halte/base (P0)

Buat `db/seeds/004_restore_geofences.sql` yang menambahkan geofence penting tanpa menghapus ROUTE_CORRIDOR:

```sql
BEGIN;
-- Terminal/Halte resmi Bogor untuk exception NGETEM
INSERT INTO geofences (name, type, route_id, geom) VALUES
  ('Terminal Merdeka', 'TERMINAL', NULL,
   ST_Buffer(ST_SetSRID(ST_MakePoint(106.787778, -6.589167), 4326)::geography, 150)::geometry),
  ('Terminal Baranangsiang', 'TERMINAL', NULL,
   ST_Buffer(ST_SetSRID(ST_MakePoint(106.806157, -6.604274), 4326)::geography, 150)::geometry),
  ('Terminal Bubulak', 'TERMINAL', NULL,
   ST_Buffer(ST_SetSRID(ST_MakePoint(106.754339, -6.569672), 4326)::geography, 150)::geometry),
  ('Stasiun Bogor', 'HALTE', NULL,
   ST_Buffer(ST_SetSRID(ST_MakePoint(106.790822, -6.594078), 4326)::geography, 100)::geometry);
COMMIT;
```

### 2. Naikkan MAP_MATCHING_MAX_SNAP_DISTANCE_METERS ke 150 (P1)

Update `.env` dan `docker-compose.yml`:
```
MAP_MATCHING_MAX_SNAP_DISTANCE_METERS=150
```
Ini akan match Cipinang Gading (118m) dan Stasiun Bogor (96m) yang saat ini jadi LOW_CONFIDENCE. Match rate diperkirakan naik dari 80% ke ~90%.

### 3. Jalankan simulator sebelum demo (P1)

```bash
docker compose -f infra/docker-compose/docker-compose.yml \
  --profile simulator up vehicle-simulator -d
```
Biarkan berjalan 5-10 menit agar `telemetry_matched_positions` terisi sebelum demo.

### 4. Set OFF_ROUTE_METERS=15 di .env (P1)

Toleransi 8m terlalu ketat untuk GPS consumer-grade. 15m lebih realistis.

---

## Commands yang Dipakai untuk Verifikasi

```bash
# 1. Start Docker
docker compose -f infra/docker-compose/docker-compose.yml up -d --build

# 2. Apply seeds
docker compose -f infra/docker-compose/docker-compose.yml exec -T postgres \
  psql -U monitoring -d Sentra -f /dev/stdin < db/seeds/001_seed.sql
docker compose -f infra/docker-compose/docker-compose.yml exec -T postgres \
  psql -U monitoring -d Sentra -f /dev/stdin < db/seeds/003_osrm_snap_to_road.sql

# 3. Test telemetry endpoint
curl -s -X POST http://localhost:4000/telemetry/vehicle \
  -H "Content-Type: application/json" \
  -H "x-telemetry-token: sentra-dev-token-2026" \
  -d '{"imei_or_serial":"86753090101","ts":"2026-05-20T10:00:00.000Z",
       "lat":-6.635827,"lon":106.815472,"speed_kmh":25,"heading":90,
       "accuracy_m":8.0,"status":"IN_SERVICE"}'
# Expected: {"ok":true,"matched_position":{"match_status":"MATCHED","confidence":0.8786,...}}

# 4. Route geometry comparison
docker compose -f infra/docker-compose/docker-compose.yml exec -T postgres \
  psql -U monitoring -d Sentra -c "
  SELECT route_id, buffer_radius_m,
    ST_NPoints(outbound_geom), ST_NPoints(inbound_geom),
    ROUND(ST_Length(outbound_geom::geography)::numeric/1000,2) AS km
  FROM routes ORDER BY route_id;"

# 5. Match rate metrics
docker compose -f infra/docker-compose/docker-compose.yml exec -T postgres \
  psql -U monitoring -d Sentra -c "
  SELECT match_status, COUNT(*), ROUND(AVG(confidence)::numeric,4)
  FROM telemetry_matched_positions GROUP BY match_status;"

# 6. Geofence check
docker compose -f infra/docker-compose/docker-compose.yml exec -T postgres \
  psql -U monitoring -d Sentra -c "
  SELECT type, COUNT(*) FROM geofences GROUP BY type;"
```

---

## Perbandingan Old vs New Rules Engine Code

| Aspek | 60b92f5 | HEAD |
|-------|---------|------|
| Config DB healthcheck | Tidak ada | Ada (production guard) |
| WRONG_DIRECTION rule | **Tidak ada** | ✅ Ada |
| OFF_ROUTE join matched | Tidak ada | ✅ LEFT JOIN telemetry_matched_positions |
| OFF_ROUTE evidence | Hanya raw distance | distance + match_status + confidence + road_segment |
| NGETEM exception geofence | Geofence TERMINAL/HALTE tersedia | ⚠ Geofence dihapus oleh seed 003 |
| Risk score decay | Ada | Ada (sama) |
| Collective anomaly detection | **Tidak ada** | ✅ Ada |
