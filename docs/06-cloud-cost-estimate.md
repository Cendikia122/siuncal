# Estimasi Biaya Cloud

## Tujuan

Dokumen ini memberikan estimasi biaya cloud kasar untuk sistem monitoring angkot pada tiga skenario kapasitas:

- `pilot kecil`
- `menengah`
- `skala kota`

Estimasi ini bersifat arsitektural, bukan quotation vendor final. Nilai aktual akan bergantung pada vendor, region, pola trafik, dan strategi high availability.

## Asumsi Dasar

### Asumsi Operasional

- Fokus sistem: monitoring operasional dan kepatuhan trayek.
- Interval GPS: `5-15 detik`.
- Payload efektif per titik setelah overhead dan metadata: `300-600 byte`.
- Dashboard utama berbasis web.
- Rule anomaly dijalankan hampir real-time.

### Asumsi Skenario Armada

| Skenario | Armada Aktif | Interval Rata-Rata |
|---|---:|---:|
| Pilot kecil | 100 kendaraan | 15 detik |
| Menengah | 1.000 kendaraan | 10 detik |
| Skala kota | 5.000 kendaraan | 5 detik |

## Estimasi Volume Data

### Rumus Dasar

```text
titik_per_hari = jumlah_kendaraan x (86400 / interval_detik)
```

### Titik Telemetry per Hari

| Skenario | Estimasi Titik per Hari |
|---|---:|
| Pilot kecil | 576.000 |
| Menengah | 8.640.000 |
| Skala kota | 86.400.000 |

### Estimasi Raw Data per Hari

Dengan asumsi `300-600 byte` per titik sebelum index, replication, dan overhead database:

| Skenario | Raw per Hari | Raw per Bulan |
|---|---:|---:|
| Pilot kecil | 0,17-0,35 GB | 5-10,5 GB |
| Menengah | 2,6-5,2 GB | 78-156 GB |
| Skala kota | 25,9-51,8 GB | 777-1.554 GB |

Catatan:

- ukuran aktual di database akan lebih besar karena index, WAL, storage engine overhead, dan metadata,
- compression TimescaleDB dapat menurunkan biaya simpan data historis secara signifikan.

## Komponen Biaya

Komponen yang diperhitungkan:

- compute
- database
- cache
- broker
- object storage
- observability
- bandwidth

## Skenario 1: Pilot Kecil

### Profil

- `100` kendaraan
- `15 detik` interval
- tim operasional kecil
- HA minimum

### Kebutuhan Infrastruktur

- `2` instance aplikasi kecil untuk backend core
- `1` instance frontend kecil
- `1` PostgreSQL/TimescaleDB managed kecil-menengah
- `1` Redis kecil
- `1` broker NATS kecil
- object storage untuk export dan backup
- observability dasar

### Estimasi Bulanan

| Komponen | Estimasi per Bulan |
|---|---:|
| Compute aplikasi | USD `80-150` |
| Database managed | USD `120-250` |
| Redis | USD `20-50` |
| Broker | USD `20-60` |
| Object storage + backup | USD `10-30` |
| Observability | USD `20-80` |
| Bandwidth | USD `20-50` |
| **Total** | **USD 270-670** |

### Catatan

- Bila memakai satu VM untuk beberapa komponen non-kritis, biaya bisa lebih murah.
- Ini cocok untuk validasi pilot dan pengujian operasional awal.

## Skenario 2: Menengah

### Profil

- `1.000` kendaraan
- `10 detik` interval
- operator aktif sepanjang hari
- kebutuhan reliability mulai penting

### Kebutuhan Infrastruktur

- `3-5` instance backend
- `2` instance frontend/API gateway
- database managed lebih besar dengan storage IOPS lebih baik
- Redis dedicated
- NATS cluster kecil
- object storage untuk arsip dan export
- observability terpusat

### Estimasi Bulanan

| Komponen | Estimasi per Bulan |
|---|---:|
| Compute aplikasi | USD `300-700` |
| Database managed | USD `400-1.000` |
| Redis | USD `80-180` |
| Broker | USD `80-200` |
| Object storage + backup | USD `40-120` |
| Observability | USD `100-300` |
| Bandwidth | USD `80-250` |
| **Total** | **USD 1.080-2.750** |

### Catatan

- Pada level ini, tuning schema, index, dan retention mulai sangat memengaruhi biaya.
- Continuous aggregate dan compression dapat menunda kebutuhan scale hardware.

## Skenario 3: Skala Kota

### Profil

- `5.000` kendaraan
- `5 detik` interval
- volume telemetry sangat tinggi
- butuh reliability, failover, dan operasi 24/7

### Kebutuhan Infrastruktur

- cluster aplikasi terorkestrasi, idealnya `Kubernetes`
- database high-performance dengan storage besar
- Redis HA
- NATS cluster production-grade
- observability penuh
- object storage besar untuk arsip dan export
- kemungkinan read replica atau analytical pipeline tambahan

### Estimasi Bulanan

| Komponen | Estimasi per Bulan |
|---|---:|
| Compute aplikasi | USD `1.500-4.000` |
| Database managed | USD `2.000-6.000` |
| Redis HA | USD `300-900` |
| Broker cluster | USD `250-800` |
| Object storage + backup | USD `150-500` |
| Observability | USD `400-1.500` |
| Bandwidth | USD `300-1.000` |
| **Total** | **USD 4.900-14.700** |

### Catatan

- Pada skala ini, arsitektur data dan retensi historis menjadi faktor biaya paling dominan.
- Jika butuh penyimpanan telemetry mentah sangat panjang, object storage dan strategi cold archive harus dipakai.

## Faktor yang Paling Mempengaruhi Biaya

### 1. Interval Pengiriman GPS

Perubahan dari `15 detik` ke `5 detik` dapat melipatgandakan volume data beberapa kali.

### 2. Retention Raw Telemetry

Menyimpan raw telemetry `12 bulan` jauh lebih mahal daripada:

- menyimpan raw `3-6 bulan`,
- lalu menyimpan summary dan archive terkompresi untuk jangka panjang.

### 3. Query Real-Time ke Database

Jika dashboard terlalu sering membaca telemetry mentah langsung dari database, biaya compute dan database naik. Karena itu:

- snapshot real-time sebaiknya dibaca dari `Redis`,
- query historis tetap dari `TimescaleDB`.

### 4. Observability

`Logs`, `metrics`, dan `traces` sangat membantu operasi, tetapi dapat membengkak cepat. Logging perlu dibatasi ke yang benar-benar penting.

## Saran Penghematan Biaya

### Tahap Awal

- mulai dari `Docker` dan VM/managed services sederhana,
- gunakan satu database stack terintegrasi `PostgreSQL + PostGIS + TimescaleDB`,
- batasi HA penuh sampai kebutuhan nyata muncul.

### Data Strategy

- simpan raw telemetry dengan retention terbatas,
- aktifkan compression,
- pindahkan export dan arsip ke `S3/MinIO`,
- bangun tabel summary harian agar laporan tidak membaca data mentah terus.

### Aplikasi

- cache last known position di `Redis`,
- gunakan event broker ringan seperti `NATS JetStream`,
- pisahkan workload reporting berat dari jalur live tracking.

### Operasional

- tetapkan budget alert cloud sejak awal,
- review biaya setiap kenaikan skala armada,
- ukur kebutuhan berdasarkan load test dan pilot nyata, bukan asumsi semata.

## Rekomendasi Per Tahap

### Pilot Kecil

Pilih arsitektur paling sederhana yang masih bersih secara desain. Fokus validasi produk, bukan optimasi ekstrem.

### Menengah

Mulai invest pada monitoring, retention policy, dan tuning query.

### Skala Kota

Anggap biaya database, observability, dan bandwidth sebagai tiga pos utama yang harus dikendalikan dengan disiplin.

## Ringkasan

Biaya cloud MVP masih cukup rasional untuk pilot dan skala menengah jika desain data disiplin sejak awal. Pengendali biaya terbesar bukan hanya vendor cloud, tetapi keputusan arsitektur: interval telemetry, strategi retention, pola query real-time, dan disiplin observability.
