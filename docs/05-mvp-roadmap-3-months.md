# Roadmap MVP 3 Bulan

## Tujuan

Dokumen ini mendefinisikan rencana eksekusi MVP sistem monitoring angkot selama `12 minggu`. Fokus roadmap adalah menghasilkan sistem operasional dasar yang dapat dipakai untuk pilot lapangan.

## Sasaran MVP

Pada akhir bulan ketiga, sistem minimal harus mampu:

- menerima telemetry GPS dari armada,
- menampilkan live tracking di dashboard peta,
- mendeteksi anomaly dasar,
- menampilkan alert,
- menyediakan playback perjalanan,
- menghasilkan reporting operasional sederhana.

## Ruang Lingkup MVP

### In Scope

- onboarding kendaraan, trayek, device, dan user operator
- ingestion telemetry
- live tracking
- realtime map dashboard
- route compliance dasar
- deteksi anomaly rule-based dasar
- alert dashboard
- playback perjalanan
- reporting dasar harian

### Out of Scope

- machine learning
- aplikasi mobile khusus penegak lapangan
- integrasi pembayaran atau tiket
- multi-region deployment
- engine sanksi yang sangat kompleks
- analitik BI lanjutan

## Prioritas Build

Urutan prioritas:

1. live tracking
2. realtime map dashboard
3. route compliance
4. anomaly dasar
5. playback
6. alert dashboard
7. reporting dasar

## Breakdown 12 Minggu

### Minggu 1-2: Fondasi Sistem

Target:

- bootstrap repo backend dan frontend,
- siapkan environment lokal berbasis Docker,
- siapkan PostgreSQL, PostGIS, TimescaleDB, Redis, dan NATS,
- definisikan schema inti master data,
- definisikan kontrak payload device.

Deliverable:

- skeleton service backend,
- dashboard frontend awal,
- migration database awal,
- dokumen payload telemetry,
- observability dasar lokal.

### Minggu 3-4: Ingestion dan Realtime State

Target:

- bangun ingestion service,
- validasi dan normalisasi payload GPS,
- publish event ke broker,
- simpan last known position ke Redis,
- tampilkan kendaraan di peta dasar.

Deliverable:

- endpoint atau gateway ingestion aktif,
- pipeline telemetry ke broker,
- cache state real-time,
- halaman live map awal dengan marker kendaraan.

### Minggu 5-6: Penyimpanan Historis dan Playback

Target:

- tulis telemetry ke TimescaleDB,
- siapkan query playback,
- simpan histori device dan assignment dasar,
- mulai bentuk trip summary sederhana.

Deliverable:

- tabel hypertable aktif,
- API playback,
- UI playback per kendaraan,
- retention dan compression dasar.

### Minggu 7-8: Route Compliance dan Anomaly Dasar

Target:

- implementasikan route corridor dan geofence,
- bangun rule `keluar trayek`,
- bangun rule `ngetem > 10 menit`,
- bangun rule `offline mendadak`,
- simpan anomaly dan alert.

Deliverable:

- route compliance engine awal,
- anomaly engine v1,
- tabel anomaly dan alert terpakai,
- daftar alert aktif di dashboard.

### Minggu 9-10: Risk Score dan Incident Workflow

Target:

- implementasikan risk scoring sederhana,
- tambahkan severity mapping,
- buat eskalasi alert ke incident,
- tambahkan filter dan detail investigasi operator.

Deliverable:

- skor risiko per kendaraan,
- incident workflow dasar,
- halaman detail kendaraan dan riwayat alert,
- audit log minimal untuk aksi operator.

### Minggu 11-12: Hardening dan Pilot Readiness

Target:

- rapikan performa query,
- tambah observability dan alerting infra,
- siapkan reporting dasar harian,
- lakukan UAT dan simulasi pilot,
- perbaiki bug prioritas tinggi.

Deliverable:

- dashboard reporting dasar,
- checklist pilot readiness,
- runbook operasional awal,
- build kandidat untuk pilot.

## Deliverable per Fase

### Fase 1

- data model dasar
- ingestion contract
- fondasi infra lokal

### Fase 2

- live tracking real-time
- state cache kendaraan

### Fase 3

- histori telemetry
- playback

### Fase 4

- compliance dan anomaly awal
- alert operasional

### Fase 5

- risk scoring
- incident handling dasar

### Fase 6

- pelaporan awal
- kesiapan pilot

## Tim Minimal

Komposisi minimal yang realistis:

- `1 backend engineer` berfokus pada ingestion, API, dan rule engine
- `1 frontend engineer` berfokus pada dashboard dan map UX
- `1 fullstack/platform engineer` berfokus pada database, deployment, observability, dan integrasi
- `1 product/ops analyst` paruh waktu untuk rule, data trayek, dan validasi operasional

Jika tim sangat kecil, `2 engineer + 1 product/ops analyst` masih mungkin, tetapi risiko delivery naik.

## Risiko Delivery

### Risiko Teknis

- kualitas data GPS buruk atau tidak konsisten,
- format payload device berbeda-beda,
- query geospasial dan playback lambat bila index tidak tepat,
- rule anomaly terlalu banyak false positive.

### Risiko Organisasi

- data master trayek dan geofence belum rapi,
- definisi kebijakan pelanggaran belum disepakati,
- perubahan kebutuhan dari stakeholder operasional di tengah sprint.

### Risiko Produk

- dashboard terlalu fokus ke teknis dan tidak sesuai kebutuhan operator lapangan,
- terlalu banyak fitur non-esensial ikut masuk ke MVP.

## Mitigasi Risiko

- mulai dari simulator payload sebelum integrasi device penuh,
- kunci definisi anomaly inti sejak awal,
- validasi dashboard dengan operator sesegera mungkin,
- pakai release mingguan internal,
- prioritaskan fitur observability sejak pertengahan roadmap, bukan di akhir.

## Tolok Ukur Keberhasilan MVP

MVP dianggap berhasil bila:

- data live mayoritas kendaraan muncul stabil di dashboard,
- playback perjalanan dapat dipakai untuk investigasi dasar,
- anomaly `keluar trayek`, `ngetem`, dan `offline` terdeteksi dengan noise yang masih dapat diterima,
- operator dapat menindaklanjuti alert tanpa perlu query manual ke database.

## Ringkasan

Roadmap 12 minggu ini sengaja menempatkan fondasi telemetry dan visibilitas operasional lebih dulu, baru dilanjutkan ke anomaly, risk scoring, dan pelaporan. Urutan ini paling aman untuk menghasilkan MVP yang benar-benar dapat diuji di lapangan.
