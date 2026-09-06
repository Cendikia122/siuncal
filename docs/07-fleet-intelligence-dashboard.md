# Dashboard Intelijen Operasional Armada

## Tujuan

Dokumen ini mendefinisikan rancangan dashboard intelijen operasional untuk sistem monitoring angkot. Fokus dashboard ini adalah membantu pemerintah atau operator pengawasan internal mendeteksi pola pelanggaran, prioritas investigasi, dan risiko kepatuhan pada level kendaraan, trayek, device, dan pemilik armada.

Dokumen ini tidak membahas pengawasan warga umum. Seluruh analitik diarahkan pada pengawasan operasional armada angkot yang terdaftar.

## Sasaran Dashboard

Dashboard harus mampu:

- menampilkan situasi risiko operasional secara real-time,
- membantu operator menemukan kasus prioritas tinggi lebih cepat,
- menampilkan pola lintas kendaraan dan lintas pemilik armada,
- mendukung investigasi berbasis evidence telemetry, anomaly, incident, dan sanction history,
- mempermudah pengambilan keputusan pembinaan, teguran, atau penindakan administratif.

## Pengguna Utama

- `Operator Monitoring`
- `Supervisor Pengawasan`
- `Admin Dishub`

## Prinsip Desain

- `real-time first`: informasi kritis muncul tanpa perlu banyak klik.
- `investigation ready`: setiap kartu atau chart harus bisa ditelusuri ke evidence.
- `prioritized`: fokus ke anomali yang paling berisiko, bukan sekadar volume notifikasi.
- `multi-level`: operator bisa berpindah dari city view ke trayek, pemilik, kendaraan, lalu incident.
- `auditable`: setiap insight harus dapat dijelaskan asal datanya.

## Struktur Dashboard

Dashboard disarankan dibagi menjadi 5 area utama:

1. ringkasan situasi saat ini,
2. peta operasional dan anomali,
3. intelijen armada dan pemilik,
4. fraud analytics perangkat,
5. investigasi dan tindakan.

## 1. Ringkasan Situasi

Bagian ini berada di area paling atas dan menampilkan indikator prioritas.

### KPI Cards

- `Angkot Aktif Saat Ini`
- `Angkot Offline Saat Ini`
- `High-Risk Vehicles`
- `Open Incidents`
- `Pemilik Armada Prioritas Tinggi`
- `Collective Anomalies Hari Ini`

### Alert Banner Prioritas

Banner ini muncul bila ada kondisi kritis seperti:

- offline massal pada satu trayek,
- pola pelanggaran terorganisir pada satu pemilik,
- lonjakan dugaan tamper device,
- banyak kendaraan keluar trayek bersamaan.

## 2. Peta Operasional dan Anomali

Peta menjadi pusat navigasi utama.

### Fungsi Peta

- menampilkan posisi real-time angkot,
- memberi warna marker berdasarkan risk level,
- menampilkan cluster kendaraan pada zoom rendah,
- menandai titik anomaly aktif,
- menyorot trayek yang sedang bermasalah.

### Interaksi Marker Kendaraan

Saat marker angkot diklik, panel detail harus menampilkan:

- foto kendaraan,
- nomor polisi,
- kode armada,
- trayek aktif,
- nama pemilik,
- alamat pemilik,
- device GPS aktif,
- status online atau offline,
- risk score,
- daftar pelanggaran terbaru,
- tombol ke playback,
- tombol ke incident history,
- tombol ke network view.

### Layer Peta yang Disarankan

- `vehicle live positions`
- `route corridors`
- `official stops and terminals`
- `active anomalies`
- `collective anomaly zones`
- `high-risk owner clusters`

## 3. Intelijen Armada dan Pemilik

Bagian ini menampilkan analisis pola, bukan hanya event individual.

### Panel Pemilik Armada Prioritas

Kolom yang direkomendasikan:

- nama pemilik,
- jumlah kendaraan aktif,
- jumlah kendaraan high-risk,
- rata-rata risk score,
- total anomaly 7 hari,
- incident terbuka,
- sanction aktif,
- status prioritas pengawasan.

### Panel Pola Pelanggaran Terorganisir

Menampilkan pemilik armada yang memiliki pola:

- banyak kendaraan dengan anomaly serupa,
- kejadian berdekatan pada waktu yang sama,
- pelanggaran konsisten pada koridor atau zona yang mirip.

Aksi yang disediakan:

- buka ringkasan kasus,
- lihat daftar kendaraan terkait,
- buka histori incident,
- tandai untuk review supervisor.

### Panel Risk Propagation

Panel ini menampilkan pemilik armada yang risikonya naik bukan karena satu kendaraan saja, tetapi karena beberapa kendaraan sekaligus.

Sinyal yang ditampilkan:

- jumlah kendaraan `high` dan `critical`,
- perubahan rata-rata risk score 7 hari,
- pola keterkaitan incident,
- status review pengawasan.

### Panel Outlier Kendaraan

Menampilkan kendaraan yang terlalu sering menyimpang dari pola trayek normal.

Contoh indikator:

- terlalu sering keluar trayek,
- terlalu sering ngetem di luar zona resmi,
- terlalu sering gagal mencapai terminal,
- pola jam operasi yang sangat berbeda dari kendaraan lain pada trayek yang sama.

## 4. Analisis Anomali Kolektif

Bagian ini fokus pada pola kelompok.

### Tipe Collective Anomaly

- `mass_offline`
- `corridor_emptying`
- `abnormal_clustering`
- `simultaneous_out_of_route`
- `owner_pattern_spike`

### Widget yang Disarankan

- `Trayek dengan Offline Kolektif`
- `Trayek dengan Penurunan Armada Mendadak`
- `Titik Penumpukan Tidak Wajar`
- `Pemilik dengan Lonjakan Pelanggaran Bersamaan`

### Detail Collective Case

Saat dibuka, operator harus melihat:

- jenis anomali kolektif,
- waktu mulai dan durasi,
- trayek terkait,
- kendaraan yang terlibat,
- pemilik yang terlibat,
- lokasi utama pada peta,
- evidence ringkas,
- incident atau case yang terkait.

## 5. Fraud Analytics Device

Bagian ini fokus ke integritas perangkat GPS.

### Indikator Utama

- device yang terlalu sering berpindah kendaraan,
- IMEI mismatch,
- fingerprint device berubah,
- device aktif pada pola yang tidak konsisten,
- lonjakan tamper pada model device tertentu.

### Widget yang Disarankan

- `Most Suspicious Devices`
- `Recent Device Identity Events`
- `Frequent Device Reassignments`
- `Device Fraud Trend`

### Detail Device

Saat device dipilih, tampilkan:

- IMEI,
- model device,
- kendaraan aktif saat ini,
- histori pemasangan,
- jumlah perpindahan kendaraan,
- anomaly terkait device,
- incident terkait device,
- status fraud risk.

## 6. Network View

`Network view` dipakai untuk investigasi hubungan antar entitas.

### Node Utama

- `fleet_owner`
- `vehicle`
- `gps_device`
- `incident`
- `sanction`

### Relasi Utama

- pemilik -> kendaraan,
- kendaraan -> device,
- kendaraan -> incident,
- incident -> sanction,
- pemilik -> kasus pola armada.

### Kegunaan

- melihat konsentrasi masalah pada satu pemilik,
- menemukan device yang muncul pada banyak kendaraan,
- melihat kendaraan mana yang paling sering terhubung dengan incident,
- memahami apakah pola masalah berbasis trayek, device, atau pemilik.

## 7. Investigasi dan Tindakan

Dashboard tidak cukup hanya memberi insight. Harus ada jalur tindakan.

### Action Panel

Operator harus bisa:

- acknowledge alert,
- eskalasi ke incident,
- membuka case pola armada,
- menandai device untuk inspeksi,
- menambahkan catatan investigasi,
- merekomendasikan teguran atau pembinaan,
- meneruskan ke supervisor.

### Timeline Investigasi

Setiap kendaraan, pemilik, atau case harus memiliki timeline:

- telemetry terkait,
- anomaly,
- alert,
- incident,
- sanction,
- catatan operator.

## 8. Filter dan Pencarian

Filter minimum:

- waktu,
- trayek,
- pemilik armada,
- risk level,
- severity anomaly,
- status incident,
- status device,
- jenis collective anomaly.

Pencarian minimum:

- nomor polisi,
- kode armada,
- nama pemilik,
- IMEI device,
- ID incident.

## 9. Prioritas Tampilan

Urutan prioritas informasi:

1. insiden aktif dan risiko kritis,
2. anomali kolektif,
3. pemilik armada prioritas tinggi,
4. kendaraan high-risk,
5. fraud device,
6. ringkasan tren.

## 10. Dashboard Views yang Disarankan

### View 1: Command Center

Fokus:

- KPI real-time,
- peta utama,
- alert kritis,
- collective anomaly banner.

### View 2: Fleet Intelligence

Fokus:

- pemilik armada prioritas,
- pola pelanggaran terorganisir,
- risk propagation,
- outlier vehicles.

### View 3: Device Fraud

Fokus:

- suspicious devices,
- identity inconsistency,
- device reassignment pattern,
- tamper trend.

### View 4: Investigation Desk

Fokus:

- network view,
- timeline case,
- evidence panel,
- action panel.

## 11. Rekomendasi Implementasi Bertahap

### Tahap 1

- marker kendaraan dengan detail panel,
- KPI cards dasar,
- daftar high-risk vehicles,
- daftar pemilik prioritas,
- alert dashboard.

### Tahap 2

- collective anomaly widgets,
- risk propagation panel,
- outlier vehicle panel,
- suspicious device panel.

### Tahap 3

- network view,
- fleet pattern cases,
- advanced investigation workflow,
- fraud trend analytics.

## 12. Ringkasan

Dashboard intelijen operasional ini dirancang untuk membantu pemerintah melihat sistem monitoring angkot bukan hanya sebagai peta posisi kendaraan, tetapi sebagai alat pengawasan kepatuhan armada, deteksi pola kolektif, investigasi fraud device, dan prioritisasi tindakan administratif.
