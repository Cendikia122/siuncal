# MVP Core dan Rules Strategy

Dokumen ini menetapkan keputusan scope project setelah membandingkan `doc1/` sebagai dokumen asli project dan `docs/` sebagai referensi teknis monitoring angkot lain.

## Keputusan Utama

- Product scope MVP diambil dari `doc1`.
- Rules, scoring, dan model evidence diambil dari `docs`.
- Fitur intelligence lanjutan tetap dicatat, tetapi tidak masuk MVP awal.
- Passenger mobile dan public report dipromosikan menjadi Phase 14 post-MVP aktif: tracking publik boleh tanpa login, tetapi submit laporan wajib login.
- Stack saat ini tetap dipakai dulu: Next.js, Node.js services, PostgreSQL/PostGIS/TimescaleDB.
- Ide arsitektur besar seperti NATS, Redis penuh, Go services, fraud analytics, dan network view diposisikan sebagai fase lanjutan.

## MVP Core

MVP awal tetap fokus pada operasional harian pemerintah/operator. Setelah pondasi operator stabil, Phase 14 menambahkan fitur publik terarah untuk tracking angkot dan laporan masyarakat.

### 1. Monitoring Angkot Bogor

Sistem menampilkan posisi armada angkot Bogor pada peta, terutama trayek awal 01/02/03.

Minimal harus ada:

- live map armada,
- marker kendaraan,
- filter trayek,
- filter status kendaraan,
- route corridor,
- official stops/terminal/base bila data tersedia.

### 2. Operator Pemerintah

Pengguna utama MVP adalah operator pemerintah/Dishub.

Minimal harus ada:

- login operator,
- dashboard pemantauan,
- panel detail kendaraan,
- daftar alert/incident,
- action penanganan incident.

Fitur masyarakat tidak masuk MVP awal. Untuk Phase 14, fitur masyarakat dibatasi ke tracking publik dan public report yang masuk review queue Dishub.

### 3. GPS Kendaraan

Sumber kebenaran lokasi adalah GPS kendaraan, bukan lokasi penumpang.

Minimal harus ada:

- endpoint telemetry kendaraan,
- simulator GPS kendaraan,
- penyimpanan posisi historis,
- latest position untuk dashboard,
- status last seen/online/offline.

Untuk Phase 14, tracking publik di mobile tetap memakai GPS kendaraan sebagai sumber kebenaran. Lokasi user hanya dipakai sebagai evidence saat user mengirim laporan.

### 4. Route Compliance

Sistem menghitung kepatuhan kendaraan terhadap trayek.

Minimal harus ada:

- route polyline/geometry,
- corridor buffer,
- official stop/terminal geofence,
- pengecekan on-route/off-route,
- pengecualian untuk mode non-operasional seperti `DEADHEAD_TO_BASE`.

### 5. Incident Center

Incident center dipakai untuk kasus yang perlu tindak lanjut formal.

Minimal harus ada:

- incident list,
- incident detail,
- acknowledge,
- assign,
- resolve,
- false alarm,
- action history.

### 6. Reporting Dasar

Reporting MVP cukup untuk evaluasi operasional dasar.

Minimal harus ada:

- rit harian,
- kepatuhan trayek,
- durasi ngetem,
- jumlah lost signal/off-route,
- export CSV/PDF.

### 7. RBAC Operator/Analisa

Role MVP tetap dua:

- `OPERATOR`: monitoring, alert/incident handling, playback.
- `ANALISA`: master data, reporting, audit log, konfigurasi rule, data sensitif.

Aturan:

- Operator tidak boleh mengubah master data inti.
- Operator hanya melihat identitas pemilik secara ringkas.
- Analisa boleh melihat data sensitif dan semua akses sensitif harus diaudit.

### 8. Passenger Mobile dan Public Report Phase 14

Phase 14 membuat project menjadi satu paket web + mobile, tetapi tetap menjaga batas akses.

Aturan:

- passenger mobile aktif memakai Flutter untuk Android dan iOS; versi Expo React Native lama hanya arsip;
- tracking angkot bisa dibuka tanpa login;
- submit laporan wajib login sebagai user masyarakat;
- `plate_no` wajib diinput manual;
- lokasi wajib aktif untuk submit laporan;
- minimal satu foto bukti wajib;
- attachment disimpan di MinIO;
- PostgreSQL menyimpan metadata attachment, bucket, object key, content type, dan ukuran file;
- report masyarakat masuk review Dishub sebelum menjadi incident.

## Rules dan Scoring

Rules strategy diambil dari dokumen teknis `docs/04-risk-scoring-and-anomaly-rules.md`, tetapi dipangkas agar cocok dengan codebase saat ini.

## Model Event

Gunakan model bertingkat:

```text
telemetry -> anomaly -> alert -> incident
```

Definisi:

- `telemetry`: titik GPS mentah/ternormalisasi dari kendaraan.
- `anomaly`: kejadian terdeteksi oleh rules engine berdasarkan window telemetry.
- `alert`: notifikasi operasional yang muncul dari anomaly aktif atau penting.
- `incident`: kasus formal yang perlu ditangani operator.

Alasan:

- tidak semua anomaly harus langsung menjadi incident,
- alert bisa dipakai untuk noise control,
- incident hanya untuk kasus yang perlu tindakan dan riwayat formal,
- evidence telemetry tetap bisa dilacak dari anomaly.

## Anomaly MVP

### 1. NGETEM

Kondisi awal:

- speed mayoritas `<= 3 km/h`,
- durasi berhenti `> 10 menit`,
- lokasi di luar stop resmi, terminal, atau pool/base yang valid.

Severity:

- `LOW`: berhenti 5-10 menit di luar zona resmi.
- `MEDIUM`: berhenti > 10 menit di luar zona resmi.
- `HIGH`: berhenti > 15 menit dan berulang pada hari yang sama.

### 2. OFF_ROUTE

Kondisi awal:

- kendaraan berada di luar corridor trayek,
- status kendaraan `IN_SERVICE`,
- bertahan minimal `2-3 telemetry point` atau lebih dari grace period.

False alarm guard:

- jangan raise dari satu titik GPS saja,
- jangan raise jika mode `DEADHEAD_TO_BASE`,
- jangan raise jika kendaraan menuju base/pool terdaftar pada window waktu wajar.

Severity:

- `MEDIUM`: keluar corridor setelah grace period.
- `HIGH`: jauh dari corridor atau durasi > 5 menit.

### 3. LOST_SIGNAL

Kondisi awal:

- tidak ada telemetry lebih dari `3 menit` saat jam operasi.

Severity:

- `LOW`: offline 3-10 menit.
- `MEDIUM`: offline > 10 menit.
- `HIGH`: offline berulang atau terjadi bersamaan dengan indikasi device bermasalah.

### 4. OVERSPEED

Kondisi awal:

- speed melebihi threshold segmen atau default kota,
- bertahan beberapa telemetry point agar tidak trigger karena spike GPS.

Default MVP:

- `speed_kmh > 60` sebagai threshold awal bila belum ada speed limit per segment.

Severity:

- `MEDIUM`: overspeed terkonfirmasi.
- `HIGH`: overspeed berulang dalam window pendek.

### 5. DEVICE_TAMPER

Fitur ini planned, bukan wajib MVP awal.

Sinyal yang nanti dipakai:

- `power_connected = false`,
- battery voltage anomali,
- satellite count turun tidak wajar,
- device offline setelah power event,
- device sering berpindah kendaraan.

## Risk Score

Risk score dipakai untuk membantu prioritas pengawasan, bukan untuk sanksi otomatis.

Skala:

- minimum `0`,
- maksimum `100`,
- makin tinggi berarti makin berisiko.

Level:

| Score | Level |
| --- | --- |
| 0-19 | LOW |
| 20-39 | MEDIUM |
| 40-69 | HIGH |
| 70-100 | CRITICAL |

Delta awal:

| Anomaly | Delta |
| --- | --- |
| NGETEM > 10 menit di luar zona resmi | +8 |
| OFF_ROUTE | +12 |
| LOST_SIGNAL | +10 |
| OVERSPEED | +6 |
| DEVICE_TAMPER | +25 |

Multiplier planned:

- kejadian berulang di hari yang sama: `x1.25`,
- jam sibuk: `x1.2`,
- terjadi bersama anomaly lain: `x1.3`,
- owner punya beberapa kendaraan bermasalah: `x1.1`.

## Decay Score

Risk score tidak boleh naik terus tanpa pemulihan.

Aturan awal:

- jika tidak ada anomaly baru selama 24 jam, score turun 5%,
- minimal turun 1 poin jika score di atas 0,
- jika 7 hari tanpa anomaly `HIGH` atau `CRITICAL`, score turun tambahan 10 poin.

## Evidence Telemetry

Setiap anomaly harus menyimpan evidence agar keputusan bisa dijelaskan.

Evidence minimal:

- vehicle id,
- route id,
- rule type,
- severity,
- telemetry window start,
- telemetry window end,
- lokasi utama,
- jumlah telemetry point,
- speed min/max/avg bila relevan,
- jarak dari route corridor bila relevan,
- jarak dari stop resmi bila relevan,
- status/mode kendaraan,
- raw rule threshold yang dipakai.

Contoh evidence:

```json
{
  "rule": "OFF_ROUTE",
  "window_started_at": "2026-04-19T10:00:00Z",
  "window_ended_at": "2026-04-19T10:03:00Z",
  "points": 6,
  "max_distance_from_corridor_m": 420,
  "vehicle_status": "IN_SERVICE",
  "threshold": {
    "min_points": 3,
    "grace_seconds": 60
  }
}
```

## Owner-Level Context

Owner-level context tidak wajib untuk MVP awal, tetapi schema dan report sebaiknya tidak menutup kemungkinan ini.

Planned usage:

- menghitung jumlah kendaraan high-risk per pemilik,
- mendeteksi pola pelanggaran berulang pada satu pemilik,
- menaikkan prioritas pengawasan pemilik jika beberapa kendaraan bermasalah,
- membuat owner compliance snapshot harian.

Yang tidak dilakukan di MVP:

- sanction otomatis,
- network view,
- fraud analytics lanjutan,
- collective anomaly kompleks.

## Fitur Ditunda

Fitur dari `doc1` yang ditunda:

- passenger mobile app,
- Safety Trip,
- SOS masyarakat,
- passenger report,
- endpoint `/telemetry/passenger`,
- endpoint `/events/sos`,
- endpoint `/reports` untuk laporan masyarakat.

Fitur dari `docs` yang ditunda:

- Fleet Intelligence penuh,
- Device Fraud dashboard,
- Network View,
- collective anomalies,
- sanction workflow,
- NATS/Redis-heavy architecture,
- rewrite backend ke Go.

### Slice Post-MVP Terdekat

Setelah MVP dan dokumentasi dasar stabil, `doc1/task.md` menempatkan Phase 13A sebagai slice kecil sebelum backlog besar Phase 13. Scope ini bukan MVP inti, tetapi cukup dekat dengan kebutuhan operasional sehingga layak dikerjakan sebelum advanced analytics penuh:

- observability dashboard untuk status API gateway, rules engine, DB, Redis, telemetry per menit, report harian terakhir, anomaly/alert/incident aktif, dan service/job error,
- owner risk context di owner list dan owner detail, dengan detail sensitif tetap hanya untuk `ANALISA`,
- device health/fraud MVP untuk offline trend, reassignment berulang, device tanpa telemetry, dan kandidat `DEVICE_TAMPER` berstatus planned/partial,
- fleet intelligence slice untuk top high-risk vehicles, problematic routes, recurring anomaly, dan drill-down ke vehicle detail/playback/incident,
- spike map matching kecil untuk snap GPS point ke route geometry atau OSRM lokal sebelum full integration.

## Urutan Implementasi Yang Direkomendasikan

1. Stabilkan build/lint.
2. Samakan telemetry simulator dan API.
3. Pastikan realtime dashboard membaca data GPS real.
4. Tambahkan tabel/konsep `anomalies`.
5. Tambahkan tabel/konsep `alerts`.
6. Ubah rules engine agar membuat anomaly dan alert dulu.
7. Eskalasi alert tertentu menjadi incident.
8. Tambahkan risk score 0-100 per kendaraan.
9. Tambahkan decay score harian.
10. Tambahkan evidence telemetry pada setiap anomaly.
11. Perketat RBAC Operator/Analisa.
12. Rapikan reporting dasar.
13. Kerjakan Phase 13A jika MVP, docs, dan demo lokal sudah stabil.

## Definisi MVP Selesai

MVP selesai jika:

- operator bisa login,
- GPS kendaraan masuk dari simulator,
- dashboard menampilkan kendaraan real-time,
- route corridor dan stops tampil,
- rules engine membuat anomaly,
- anomaly penting membuat alert,
- alert penting bisa menjadi incident,
- operator bisa menindaklanjuti incident,
- kendaraan memiliki risk score,
- risk score bisa turun dengan decay,
- report dasar bisa diekspor,
- role Operator dan Analisa berbeda aksesnya.
