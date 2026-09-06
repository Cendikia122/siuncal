# Map Matching Feasibility and Integration

Dokumen ini mencatat hasil Phase 13A dan integrasi awal map matching untuk telemetry, rules, dan playback.

## Scope Spike

Implementasi awal memakai helper API:

- `POST /map-matching/spike`
- role: `ANALISA`
- input: `route_id`, `lat`, `lon`, dan opsional `off_route_threshold_m`
- output: titik hasil snap ke route geometry PostGIS, jarak point ke route, status threshold, rekomendasi, dan sampel dampak.

Endpoint spike tetap tersedia sebagai alat ukur/manual check untuk role `ANALISA`.

## Opsi yang Dievaluasi

### 1. Snap lokal ke geometry PostGIS

Status: implemented untuk ingestion, storage, rules, dan playback.

Kelebihan:

- tidak perlu service eksternal,
- memakai geometry route yang sudah tersimpan,
- cukup untuk mengukur GPS drift dan mengurangi false positive `OFF_ROUTE` awal,
- menyimpan snapped point, confidence, road segment, dan progress sepanjang route.

Keterbatasan:

- tidak memperhitungkan network jalan aktual,
- kualitas hasil bergantung pada akurasi polyline route.

### 2. OSRM route-prefetch untuk koridor resmi

Status: implemented untuk seed/operator dashboard corridor.

Kelebihan:

- bisa snap ke network jalan,
- lebih cocok untuk route urban yang punya banyak segmen paralel,
- tidak butuh Google Maps API berbayar,
- runtime operator-web tetap membaca geometry lokal dari API, jadi demo tidak bergantung pada request OSRM eksternal.

Keterbatasan:

- geometry OSRM diprefetch saat seed dibuat, bukan service matcher real-time,
- jika trayek resmi berubah, file seed OSRM harus diregenerasi,
- adapter berikutnya bisa mengisi tabel hasil matching dengan `provider = osrm` untuk telemetry real-time bila sudah ada OSRM lokal berbasis ekstrak OSM Bogor.

Seed `003_osrm_snap_to_road.sql` memperbarui route `01`, `02`, dan `03` dengan
polyline OSRM outbound/inbound, menghapus geofence titik lama, lalu membuat
geofence `ROUTE_CORRIDOR` dari buffer 8 meter di sekitar geometry OSRM.

## Storage Hasil Matching

Hasil matching disimpan di tabel `telemetry_matched_positions`.

Field utama:

- `vehicle_id`, `position_id`, `ts`: link ke raw telemetry.
- `route_id`, `direction`, `road_segment`: konteks segment route hasil snap.
- `provider`: default `local_postgis`.
- `match_status`: `MATCHED`, `LOW_CONFIDENCE`, atau `NO_ROUTE`.
- `confidence`: skor 0-1 dari jarak snap terhadap threshold.
- `snapped_lat`, `snapped_lon`: posisi yang sudah dirapikan.
- `snap_distance_m`: jarak raw GPS ke snapped position.
- `distance_along_route_m`: progress titik di sepanjang geometry route.
- `matched_heading`: arah geometry route di titik snap.
- `raw_lat`, `raw_lon`: koordinat raw tetap disimpan sebagai evidence.

Raw telemetry tetap disimpan di `vehicle_positions` dan tidak ditimpa.

## Rules Engine Integration

Rule `OFF_ROUTE` memakai matched data jika tersedia:

- jika `match_status = MATCHED` dan confidence memenuhi threshold, titik dianggap berada di route untuk mengurangi false positive akibat drift GPS,
- jika confidence rendah atau tidak ada matched data, rule fallback ke jarak raw GPS terhadap route geometry,
- evidence anomaly menyimpan raw distance, match confidence, road segment, dan distance along route.

Rule `WRONG_DIRECTION` ditambahkan sebagai rule berbasis matched data:

- membandingkan heading GPS dengan `matched_heading`,
- hanya aktif untuk kendaraan `IN_SERVICE`,
- butuh beberapa titik dalam grace window agar tidak trigger dari satu spike,
- evidence menyimpan raw heading, matched heading, segment, dan progress route.

Trip progress tersedia lewat `distance_along_route_m` pada playback/API dan bisa dipakai job rit/report berikutnya.

## Dashboard Playback

Endpoint `GET /vehicles/:id/playback` mengembalikan raw point dan field matched dalam setiap position.

Dashboard vehicle detail menyediakan toggle:

- `Matched`: default operator, memakai `snapped_lat/snapped_lon` jika status matched valid.
- `Raw GPS`: menampilkan koordinat asli dari `vehicle_positions` sebagai bukti/investigasi.

Jika suatu point belum memiliki matching valid, mode `Matched` fallback ke raw point agar playback tidak kosong.

## Dashboard Realtime Map

Operator dashboard memakai `GET /routes` sebagai satu sumber peta:

- `outbound` dan `inbound` digambar sebagai polyline OSRM-snapped di Leaflet,
- `corridor` dari backend adalah buffer 8 meter dari gabungan geometry outbound/inbound,
- overlay dari `/geofences` tidak lagi dicampur ke dashboard utama agar operator melihat koridor kepatuhan route, bukan geofence terminal/ngetem lama.

## Metrik Dampak

Endpoint spike mengembalikan `impact_sample`:

- `sampled_points`: jumlah telemetry route dalam sampel 24 jam terakhir,
- `off_route_points_before_snap`: point yang berada di luar threshold sebelum snap,
- `off_route_points_after_snap`: baseline hasil snap lokal, saat ini `0` karena point disnap ke route geometry,
- `avg_distance_m` dan `p95_distance_m`: jarak point ke geometry route,
- `off_route_anomalies_24h`: jumlah anomaly `OFF_ROUTE` 24 jam terakhir,
- `rit_report_rows_7d`: jumlah row rit report 7 hari untuk route tersebut.

Metrik ini dipakai untuk membandingkan apakah false positive `OFF_ROUTE` kemungkinan berasal dari GPS drift atau dari geometry route yang kurang akurat.

## Keputusan

- Gunakan geometry OSRM-prefetched sebagai koridor route MVP dan PostGIS sebagai penyimpan/query geospatial lokal.
- Gunakan matched data untuk `OFF_ROUTE`, `WRONG_DIRECTION`, dan progress playback.
- Simpan raw GPS sebagai evidence.
- OSRM real-time lokal tetap menjadi adapter lanjutan jika evaluasi lapangan membutuhkan matching telemetry ke road network per titik, bukan hanya koridor route yang sudah diprefetch.
