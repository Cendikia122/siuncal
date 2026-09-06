# Risk Scoring dan Aturan Anomali

## Tujuan

Dokumen ini mendefinisikan rule anomaly awal dan mekanisme risk scoring untuk sistem monitoring angkot. Fokusnya adalah rule-based detection yang realistis untuk MVP, bukan model machine learning.

## Prinsip Utama

- Mulai dari rule yang mudah dijelaskan ke operator dan pemangku kebijakan.
- Pastikan setiap skor dapat ditelusuri ke evidence telemetry.
- Pisahkan `deteksi kejadian`, `alerting`, `eskalasi incident`, dan `sanksi`.
- Gunakan formula sederhana lebih dulu, lalu tuning berdasarkan data lapangan.

## Entitas Konseptual

- `anomaly`: hasil deteksi kejadian tertentu.
- `alert`: notifikasi operasional yang muncul akibat anomaly.
- `incident`: kasus yang butuh tindak lanjut formal.
- `risk score`: skor kumulatif kendaraan.
- `owner context`: konteks pemilik armada yang dipakai untuk analisis kepatuhan lintas kendaraan dalam satu kepemilikan.

## Definisi Anomali Awal

### 1. Ngetem di Luar Zona Resmi

Definisi:

- kendaraan bergerak sangat lambat atau berhenti,
- durasi melebihi ambang tertentu,
- lokasi tidak berada dalam geofence terminal atau zona stop resmi.

Ambang awal:

- `speed <= 3 kph`
- durasi `> 10 menit`

### 2. Keluar Trayek

Definisi:

- posisi kendaraan berada di luar corridor trayek melebihi toleransi meter yang ditetapkan pada route.

Ambang awal:

- `distance to route corridor > corridor_tolerance_meters`
- bertahan selama minimal `2-3 titik telemetry` untuk mengurangi false positive akibat noise GPS

### 3. GPS Offline Mendadak

Definisi:

- perangkat berhenti mengirim data pada jam operasional aktif tanpa alasan yang dapat dijelaskan.

Ambang awal:

- tidak ada telemetry `> 3 menit` pada jam operasi
- severity meningkat bila `> 10 menit`

### 4. Dugaan GPS Tamper atau Dicabut

Definisi:

- pola perangkat menunjukkan putus daya, kehilangan sinyal tidak wajar, atau berhenti total secara tiba-tiba setelah sebelumnya normal.

Sinyal pendukung:

- `power_connected = false` mendadak,
- `battery_voltage` anomali,
- `satellite_count` jatuh tidak wajar,
- offline berkepanjangan setelah pola daya berubah.

### 5. Kecepatan Tidak Wajar

Definisi:

- kendaraan bergerak di atas batas yang wajar untuk konteks angkot perkotaan.

Ambang awal:

- `speed_kph > 80` selama beberapa titik berturut-turut

### 6. Putar Balik Tidak Normal atau Terminal Tidak Tercapai

Definisi:

- kendaraan tidak mencapai terminal resmi atau berbalik sebelum titik semestinya secara berulang.

Deteksi awal:

- trip berakhir tanpa mencapai terminal,
- pola putar balik terjadi berulang dalam periode tertentu.

### 7. Berhenti Berulang di Titik Tidak Resmi

Definisi:

- kendaraan sering berhenti pada cluster lokasi yang sama di luar geofence resmi.

Deteksi awal:

- minimal `N` kejadian ngetem pendek pada radius kecil yang sama dalam satu hari.

## Rule Engine Awal

Rule engine dieksekusi berbasis event streaming dan window evaluasi pendek.

### Input

- telemetry point baru,
- snapshot status kendaraan sebelumnya,
- route corridor,
- geofence resmi,
- master data kendaraan dan pemilik armada,
- status operasi harian.

### Output

- anomaly baru,
- pembaruan risk score,
- alert operasional,
- sinyal eskalasi incident.

## Implementasi MVP Phase 5

Alur operasional sekarang dipisahkan menjadi:

```text
telemetry -> anomalies -> alerts -> incidents
```

- `anomalies` menyimpan hasil deteksi rule dan evidence telemetry.
- `alerts` menyimpan notifikasi operasional dari anomaly.
- `incidents` hanya dibuat ketika alert layak dieskalasi, bukan untuk semua anomaly.
- Alert severity `HIGH` dan `CRITICAL` dieskalasi otomatis menjadi incident.
- Alert severity `LOW` dan `MEDIUM` tetap menjadi alert, kecuali rule yang sama berulang minimal 3 kali dalam 24 jam.
- Resolve otomatis dilakukan pada anomaly dan alert ketika kondisi rule sudah normal. Incident otomatis hanya di-resolve jika masih `OPEN` dan dibuat dari alert tersebut.

Evidence minimal pada setiap anomaly/alert:

- vehicle id, plate, dan status,
- route,
- rule,
- severity,
- window waktu,
- jumlah point,
- lokasi terakhir,
- threshold rule,
- metrik rule.

Threshold default untuk demo:

| Rule | Default | Catatan |
|---|---:|---|
| `LOST_SIGNAL` | 3 menit | severity `HIGH`, auto-resolve saat ping kembali |
| `LOST_SIGNAL` critical | 10 menit | severity naik menjadi `CRITICAL` |
| `OFF_ROUTE` toleransi tambahan | 30 meter | ditambah `routes.buffer_radius_m` |
| `OFF_ROUTE` grace window | 3 menit / 3 titik | mencegah drift GPS sesaat |
| `NGETEM` durasi | 10 menit | hanya kendaraan `IN_SERVICE` |
| `NGETEM` max distance | 15 meter | window berhenti/merayap |
| `NGETEM` max avg speed | 3 km/jam | tidak trigger di stop resmi |
| `OVERSPEED` | 60 km/jam | minimal 2 dari 3 titik telemetry |

## Severity Mapping

| Severity | Kriteria Umum | Dampak Operasional |
|---|---|---|
| `low` | kejadian ringan, durasi pendek, belum berulang | monitoring |
| `medium` | berdampak jelas atau mulai berulang | perlu perhatian operator |
| `high` | pelanggaran signifikan atau frekuen | layak eskalasi |
| `critical` | indikasi manipulasi berat atau risiko tinggi | incident segera |

Contoh:

- `ngetem 10-15 menit di luar zona resmi` -> `medium`
- `keluar trayek > 1 km dan berlanjut` -> `high`
- `tamper GPS terindikasi kuat` -> `critical`

## Model Skor

### Skala Skor

- Rentang awal: `0-100`
- Semakin tinggi skor, semakin tinggi risiko

### Level Risiko

| Range | Level |
|---|---|
| `0-19` | `low` |
| `20-39` | `medium` |
| `40-69` | `high` |
| `70-100` | `critical` |

### Bobot Awal per Anomali

| Anomali | Delta Skor Awal |
|---|---|
| Ngetem > 10 menit di luar zona resmi | `+8` |
| Keluar trayek | `+12` |
| GPS offline mendadak | `+10` |
| Dugaan GPS tamper | `+25` |
| Kecepatan tidak wajar | `+6` |
| Putar balik tidak normal | `+10` |
| Berhenti berulang di titik tidak resmi | `+14` |

## Penyesuaian Konteks

Delta skor dapat dikalikan faktor berikut:

- kejadian berulang di hari yang sama: `x1.25`
- terjadi pada jam sibuk: `x1.2`
- terjadi dekat terminal atau titik sensitif: `x1.15`
- terjadi bersamaan dengan anomaly lain: `x1.3`
- pemilik memiliki beberapa kendaraan lain dengan pola pelanggaran serupa: `x1.1`

Contoh:

`keluar trayek` dasar `+12` yang terjadi berulang di jam sibuk dapat menjadi:

`12 x 1.25 x 1.2 = 18`

## Decay dan Reset Logic

Skor tidak boleh terus menumpuk selamanya tanpa koreksi perilaku.

### Decay Harian

- jika tidak ada anomaly baru dalam `24 jam`, skor turun `5%` dari skor berjalan,
- minimal turun `1 poin` bila skor di atas nol.

### Decay Mingguan

- jika `7 hari` tanpa anomaly high atau critical, skor turun tambahan `10 poin`.

### Reset Parsial

- incident yang telah diselesaikan tidak otomatis mereset skor ke nol,
- reset parsial dapat dilakukan berdasarkan kebijakan pembinaan atau periode evaluasi bulanan.

## Implementasi MVP Phase 6

Risk scoring disimpan dalam dua tabel:

- `risk_scores`: score aktif per kendaraan.
- `risk_score_events`: riwayat perubahan score dari anomaly dan decay.

Implementasi awal:

- score selalu dijaga pada rentang `0-100`,
- `NGETEM +8`,
- `OFF_ROUTE +12`,
- `LOST_SIGNAL +10`,
- `OVERSPEED +6`,
- `DEVICE_TAMPER +25` disiapkan sebagai planned rule,
- multiplier untuk repetition, jam sibuk, anomaly bersamaan, dan owner context dicatat sebagai planned metadata, belum diterapkan dalam kalkulasi MVP,
- decay harian turun `5%` setelah 24 jam tanpa anomaly baru, minimal 1 poin jika score masih di atas 0,
- decay mingguan turun `10` poin jika 7 hari tanpa anomaly `HIGH` atau `CRITICAL`,
- dashboard kendaraan menampilkan risk score dan risk level jika data tersedia,
- risk score tidak dipakai untuk sanksi otomatis.

## Formula Contoh

### Formula Dasar

```text
new_score = clamp(0, 100, current_score + weighted_delta - decay)
```

### Formula Delta

```text
weighted_delta = base_delta x repetition_factor x operational_factor x correlation_factor
```

## Contoh Kasus

### Kasus 1: Ngetem > 10 Menit

Kondisi:

- kendaraan berhenti `14 menit`,
- lokasi di luar geofence resmi,
- speed mayoritas `0-2 kph`.

Keputusan:

- buat `anomaly` tipe `idling_outside_zone`,
- severity `medium`,
- tambah skor `+8`,
- buat `alert` untuk operator.

### Kasus 2: Keluar Trayek

Kondisi:

- kendaraan berada `400 meter` di luar corridor,
- terjadi selama `5 menit`.

Keputusan:

- buat `anomaly` tipe `out_of_route`,
- severity `high`,
- tambah skor `+12`,
- bila kejadian berulang `>= 3 kali` per hari, buka `incident`.

### Kasus 3: GPS Tamper

Kondisi:

- `power_connected` mendadak `false`,
- lalu telemetry berhenti,
- kejadian berulang pada perangkat yang sama.

Keputusan:

- buat `anomaly` tipe `device_tamper_suspected`,
- severity `critical`,
- tambah skor `+25`,
- buka `incident` otomatis,
- flag perangkat dan kendaraan untuk inspeksi.

### Kasus 4: Offline Mendadak

Kondisi:

- kendaraan aktif pada jam operasi,
- telemetry hilang `6 menit`.

Keputusan:

- buat `anomaly` tipe `device_offline`,
- severity `medium`,
- tambah skor `+10`,
- bila pulih cepat, cukup alert,
- bila melebihi `10 menit`, tingkatkan severity ke `high`.

### Kasus 5: Berhenti Berulang di Titik Tidak Resmi

Kondisi:

- satu kendaraan berhenti pendek 5 kali di lokasi yang sama dalam sehari,
- lokasi di luar zona resmi.

Keputusan:

- buat `anomaly` agregat `repeated_unofficial_stop`,
- severity `high`,
- tambah skor `+14`,
- masukkan ke review operasional.

## Mekanisme Alert

Alert dibuat ketika:

- anomaly severity `medium` ke atas,
- atau anomaly `low` berulang melewati ambang frekuensi.

Atribut minimum alert:

- tipe,
- severity,
- kendaraan,
- pemilik kendaraan,
- timestamp,
- lokasi,
- ringkasan evidence.

## Analisis Kepatuhan per Pemilik Armada

Walau risk score utama melekat ke kendaraan, sistem tetap perlu menyusun ringkasan kepatuhan per pemilik armada untuk kebutuhan pengawasan.

Ringkasan yang direkomendasikan:

- jumlah kendaraan aktif milik pemilik,
- jumlah kendaraan berisiko tinggi,
- total anomaly dalam periode tertentu,
- incident terbuka per pemilik,
- kendaraan dengan skor tertinggi dalam satu kepemilikan.

Analisis ini dipakai untuk:

- identifikasi pemilik dengan pola kepatuhan buruk,
- prioritas pembinaan atau teguran administratif,
- penelusuran apakah pelanggaran bersifat kasus tunggal atau pola armada.

## Analitik Lanjutan yang Direkomendasikan

### 1. Deteksi Pola Pelanggaran Terorganisir pada Satu Pemilik Armada

Deteksi ini mencari pola ketika beberapa kendaraan milik pemilik yang sama menunjukkan jenis pelanggaran yang mirip pada rentang waktu berdekatan.

Sinyal yang dicari:

- banyak kendaraan dari pemilik yang sama mengalami `out_of_route`,
- banyak kendaraan dari pemilik yang sama melakukan `idling_outside_zone`,
- kejadian berulang pada jam dan area yang konsisten.

Hasilnya:

- buka `fleet_pattern_case`,
- tingkatkan prioritas pengawasan pemilik,
- tambahkan faktor `risk propagation`.

### 2. Deteksi Kolusi Operasional

Deteksi ini mencari pola ketika beberapa kendaraan secara kolektif menyimpang dari distribusi layanan normal.

Contoh:

- beberapa kendaraan sengaja meninggalkan koridor tertentu,
- lalu berkumpul pada titik tertentu di luar perilaku normal trayek.

Sinyal yang dicari:

- penurunan mendadak kepadatan kendaraan pada segmen trayek,
- lonjakan cluster kendaraan pada lokasi tidak resmi,
- kendaraan yang terlibat berasal dari trayek atau pemilik yang sama.

### 3. Analisis Anomali Kolektif

Deteksi ini mencari kejadian yang tidak masuk akal bila dilihat pada level grup.

Contoh:

- banyak kendaraan pada trayek yang sama offline bersamaan,
- banyak kendaraan pada pemilik yang sama berhenti mengirim data dalam window sempit.

Sinyal ini penting karena bisa menunjukkan:

- gangguan jaringan,
- sabotase operasional,
- manipulasi perangkat,
- atau tindakan terkoordinasi.

### 4. Network View Investigasi

Sistem sebaiknya dapat memvisualisasikan hubungan berikut:

- pemilik armada -> kendaraan,
- kendaraan -> GPS device,
- kendaraan -> anomaly -> incident -> sanction,
- pemilik armada -> ringkasan kepatuhan dan kasus pola.

Tujuannya:

- mempermudah investigasi pola berulang,
- melihat kendaraan mana yang paling sering terhubung ke incident,
- memahami apakah pola pelanggaran terpusat pada pemilik, trayek, atau device tertentu.

### 5. Fraud Analytics untuk Device

Fraud analytics difokuskan pada integritas perangkat GPS.

Sinyal yang dicari:

- GPS device terlalu sering berpindah kendaraan,
- IMEI dan identitas perangkat tidak konsisten,
- fingerprint perangkat berubah tanpa histori instalasi yang masuk akal,
- device aktif pada dua konteks kendaraan yang tidak mungkin secara waktu.

### 6. Outlier Detection terhadap Pola Trayek Normal

Outlier detection membandingkan perilaku kendaraan terhadap baseline trayek normal.

Contoh outlier:

- kendaraan terlalu sering lolos dari pola ngetem normal trayek,
- kendaraan terlalu sering muncul di luar corridor tetapi tidak pernah mencapai terminal,
- distribusi jam operasi sangat berbeda dari armada lain pada trayek yang sama.

### 7. Risk Propagation

Risk propagation menaikkan prioritas pengawasan ketika risiko tidak lagi bersifat individual.

Aturan awal yang direkomendasikan:

- jika satu pemilik memiliki `>= 2` kendaraan `high-risk`, buat sinyal `owner_risk_propagation`,
- jika satu pemilik memiliki kombinasi `high-risk vehicle + collective anomaly`, naikkan severity review,
- jika pemilik yang sama memiliki histori sanction sebelumnya, tambahkan faktor eskalasi.

Tujuan utamanya adalah memastikan pengawasan tidak berhenti pada satu kendaraan, tetapi dapat naik ke pola kepemilikan.

## Data yang Ditampilkan pada Detail Kendaraan

Saat operator mengklik marker angkot pada peta, panel detail minimal perlu menampilkan:

- foto kendaraan,
- nomor polisi,
- nama pemilik,
- alamat pemilik,
- trayek aktif,
- status online atau offline,
- risk score saat ini,
- riwayat anomali terbaru seperti `ngetem`, `keluar trayek`, `offline`, dan `tamper`.

## Mekanisme Eskalasi ke Incident

Incident dibuat bila salah satu kondisi terpenuhi:

- anomaly `critical`,
- anomaly `high` berulang `>= 3 kali` dalam `7 hari`,
- skor risiko melewati ambang `70`,
- operator menandai alert tertentu sebagai perlu investigasi formal.

## Mekanisme Warning dan Sanksi

Rekomendasi kebijakan awal:

1. `Warning`
   - untuk kejadian pertama atau severity menengah.
2. `Pembinaan`
   - untuk pelanggaran berulang.
3. `Sanksi administratif`
   - untuk pelanggaran berat atau tamper.

Contoh pemetaan:

- skor `20-39`: warning dan monitoring
- skor `40-69`: pembinaan dan evaluasi
- skor `>= 70`: review sanksi atau investigasi formal

## Pengendalian False Positive

Untuk menjaga kredibilitas sistem:

- gunakan toleransi beberapa titik telemetry sebelum menandai keluar trayek,
- abaikan kecepatan ekstrem tunggal yang jelas noise,
- perhitungkan kualitas sinyal GPS,
- evaluasi anomaly tertentu berbasis window, bukan satu titik.

## Roadmap Evolusi Rule

Tahap lanjutan yang bisa ditambahkan:

- score terpisah per kategori risiko,
- pembobotan berbeda per trayek atau zona,
- baseline perilaku historis per kendaraan,
- model prediktif untuk early warning.

## Ringkasan

Rule anomaly dan risk scoring awal harus transparan, mudah diaudit, dan cukup tegas untuk kebutuhan operasional. Pendekatan ini cocok sebagai fondasi MVP sebelum sistem berkembang ke analitik yang lebih canggih.
