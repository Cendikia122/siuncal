# Public Report dan Passenger Mobile

Dokumen ini menetapkan scope post-MVP untuk menjadikan Sentra sebagai satu paket: operator web untuk Dishub, passenger mobile untuk masyarakat, satu API gateway, satu database PostgreSQL/PostGIS, dan MinIO untuk attachment bukti laporan.

## Keputusan Produk

- Passenger mobile dibuat dengan Expo React Native agar satu codebase bisa berjalan di Android dan iOS.
- Aplikasi mobile boleh dibuka tanpa login untuk melihat tracking angkot.
- Login wajib hanya untuk mengirim laporan masyarakat.
- `plate_no` wajib diinput manual oleh user saat membuat laporan.
- Lokasi foreground wajib aktif untuk submit laporan.
- Minimal satu foto bukti wajib untuk report.
- Attachment disimpan di MinIO. PostgreSQL hanya menyimpan metadata dan pointer object.
- Report masyarakat masuk review queue Dishub. Report tidak otomatis menjadi incident sebelum diverifikasi.
- GPS kendaraan tetap sumber kebenaran tracking; lokasi user adalah evidence report, bukan sumber tracking kendaraan.
- Passenger tracking 24/7 adalah fitur internal operator: mobile mengirim posisi berkala dengan token tracking khusus, lalu operator web menampilkan passenger aktif sebagai layer terbatas role `OPERATOR`/`ANALISA`.
- Phase 14E menambahkan automated review untuk membandingkan laporan masyarakat dengan telemetry, anomaly, alert, dan incident yang sudah ada.
- AI dipakai sebagai assistant untuk ringkasan, confidence explanation, dan klasifikasi deskripsi. OCR plat nomor berjalan lokal secara asynchronous sebagai evidence operator; auto-escalation tetap harus berbasis evidence monitoring yang kuat.

## User Flow Mobile

### Tracking Tanpa Login

1. User membuka aplikasi.
2. Aplikasi menampilkan daftar atau peta angkot dari endpoint publik yang aman.
3. User bisa melihat posisi, trayek, status dasar, dan last seen yang tidak sensitif.
4. Aplikasi tidak menampilkan data owner, driver, audit, atau detail internal Dishub.

### Submit Report Dengan Login

1. User membuka report screen.
2. Jika belum login, aplikasi mengarahkan user ke login/register.
3. Setelah login, aplikasi meminta permission lokasi foreground.
4. Jika permission lokasi ditolak atau lokasi mati, form submit tidak aktif.
5. User memilih kategori report.
6. User wajib mengisi `plate_no`.
7. User wajib mengambil atau memilih minimal satu foto bukti.
8. User mengisi deskripsi singkat.
9. Aplikasi mengirim metadata report dan attachment.
10. API membuat report dengan status awal `PENDING_REVIEW`.
11. User melihat status report di riwayat laporan.

## Kategori Awal Report

Kategori MVP harus sederhana agar mudah dipahami masyarakat dan mudah ditriase Dishub:

- `NGETEM`: angkot berhenti terlalu lama dan mengganggu lalu lintas.
- `RECKLESS_DRIVING`: berkendara membahayakan.
- `SECURITY`: tindak kejahatan atau situasi tidak aman.
- `SERVICE`: pelayanan buruk, tarif tidak sesuai, atau perilaku tidak pantas.
- `OTHER`: laporan lain yang tetap relevan untuk Dishub.

Kategori `SOS` sebaiknya menjadi fase setelah report MVP stabil karena membutuhkan SLA, prioritas, anti-spam, dan notifikasi yang lebih ketat.

## Data Model

### `public_reports`

Kolom minimum:

- `public_report_id uuid primary key`
- `reporter_user_id uuid not null`
- `vehicle_id uuid null`
- `incident_id uuid null`
- `plate_no text not null`
- `category text not null`
- `status text not null`
- `plate_match_status text not null`
- `description text not null`
- `lat numeric not null`
- `lon numeric not null`
- `accuracy_m numeric null`
- `reported_at timestamptz not null`
- `vehicle_last_lat numeric null`
- `vehicle_last_lon numeric null`
- `vehicle_last_seen_at timestamptz null`
- `distance_to_vehicle_m numeric null`
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `reviewed_by uuid null`
- `reviewed_at timestamptz null`
- `review_notes text null`

Status awal:

- `PENDING_REVIEW`
- `ACKNOWLEDGED`
- `REJECTED`
- `ESCALATED_TO_INCIDENT`
- `RESOLVED`

Plate match status:

- `MATCHED_VEHICLE`
- `UNMATCHED_PLATE`
- `MULTIPLE_MATCH_CANDIDATES`

### `public_report_attachments`

Kolom minimum:

- `attachment_id uuid primary key`
- `public_report_id uuid not null`
- `bucket text not null`
- `object_key text not null`
- `content_type text not null`
- `file_size_bytes integer not null`
- `checksum_sha256 text null`
- `original_filename text null`
- `uploaded_at timestamptz not null`

Binary file tidak disimpan di PostgreSQL.

### `public_report_actions`

Kolom minimum:

- `action_id uuid primary key`
- `public_report_id uuid not null`
- `actor_id uuid not null`
- `action text not null`
- `notes text null`
- `created_at timestamptz not null`

Action operator:

- `ACKNOWLEDGE`
- `REJECT`
- `ESCALATE_TO_INCIDENT`
- `RESOLVE`

### `public_report_reviews`

Kolom minimum:

- `review_id uuid primary key`
- `public_report_id uuid not null`
- `review_type text not null`
- `verdict text not null`
- `confidence_score numeric not null`
- `matched_vehicle_id uuid null`
- `matched_anomaly_id uuid null`
- `matched_alert_id uuid null`
- `matched_incident_id uuid null`
- `created_incident_id uuid null`
- `evidence_snapshot jsonb not null`
- `reason_summary text not null`
- `review_engine_version text not null`
- `model_name text null`
- `created_at timestamptz not null`

`review_type` awal:

- `AUTOMATED_RULES`
- `AI_ASSISTED`

`verdict` awal:

- `CONFIRMED`
- `LIKELY`
- `INCONCLUSIVE`
- `REJECT_SUSPECTED_SPAM`

### `passenger_tracking_tokens`

Token tracking terpisah dari JWT publik agar endpoint telemetry passenger tidak memakai cookie/session operator.

Kolom minimum:

- `token_id uuid primary key`
- `user_id uuid not null`
- `session_id uuid not null`
- `token_hash text not null`
- `issued_at timestamptz not null`
- `expires_at timestamptz not null`
- `revoked_at timestamptz null`
- `last_used_at timestamptz null`
- `user_agent text null`

### `passenger_positions`

Kolom minimum:

- `position_id bigserial`
- `user_id uuid not null`
- `session_id uuid not null`
- `token_id uuid null`
- `ts timestamptz not null`
- `lat double precision not null`
- `lon double precision not null`
- `accuracy numeric null`
- `battery_level numeric null`
- `app_state text null`
- `geom geometry(Point, 4326)`
- `created_at timestamptz not null`

Data tidak dibatasi otomatis pada fase ini; retensi/arsip harus diputuskan sebagai kebijakan operasional sebelum production.

## Attachment Storage

MinIO menjadi storage evidence report.

Rekomendasi bucket awal:

```text
public-report-evidence
```

Object key disusun agar mudah diaudit tanpa mengekspos data sensitif:

```text
public-reports/{yyyy}/{mm}/{public_report_id}/{attachment_id}.{ext}
```

Aturan awal:

- tipe file: JPEG, PNG, WebP;
- minimal satu attachment untuk submit report;
- ukuran maksimal per file ditentukan di env, misalnya `PUBLIC_REPORT_MAX_ATTACHMENT_MB`;
- attachment dibaca operator web lewat endpoint API gateway yang mengecek token/session dan role internal;
- tidak memakai URL publik permanen untuk bukti laporan.

## API Contract Awal

### Public Tracking

Endpoint tracking boleh diakses tanpa login, tetapi datanya harus dibatasi.

```text
GET /public/vehicles
GET /public/vehicles/:id
```

Data yang boleh keluar:

- vehicle id publik atau internal jika aman;
- plate no;
- route id/name;
- latest lat/lon;
- status operasional dasar;
- last seen.

Data yang tidak boleh keluar:

- owner detail;
- driver identity;
- device IMEI/serial;
- audit/internal notes;
- risk score sensitif jika belum diputuskan aman.

### Auth Mobile

Endpoint auth mobile bisa memakai auth service yang sama dengan operator, tetapi role harus dipisah.

Role minimum:

- `PUBLIC_USER`
- `OPERATOR`
- `ANALISA`

Submit report hanya boleh dilakukan oleh user dengan `PUBLIC_USER` aktif.

Login mobile juga mengembalikan:

- `access_token` untuk submit report;
- `passenger_tracking_token` untuk telemetry passenger;
- `passenger_tracking_session_id` untuk mengikat update lokasi ke sesi tracking.

### Passenger Telemetry

```text
POST /telemetry/passenger
```

Authentication wajib memakai `X-Passenger-Tracking-Token`, bukan cookie operator. Field wajib:

- `session_id`
- `lat`
- `lon`
- `timestamp`

Field opsional:

- `accuracy`
- `battery_level`
- `app_state`

Mobile app mengirim update background location dengan Expo `expo-location` dan foreground service Android. Interval awal dibatasi sekitar 30 detik untuk mengurangi konsumsi baterai.

### Operator Passenger Layer

```text
GET /passengers/active
WS /realtime event PASSENGER_LATEST
```

Endpoint hanya untuk role `OPERATOR` dan `ANALISA` dengan prinsip data minimization:

- `OPERATOR` tetap dapat melihat marker/lokasi passenger untuk kebutuhan monitoring/demo, tetapi identitas passenger dimasking secara default (`name` pseudonym, `email`, `session_id`, `phone`, dan foto profil tidak dikirim).
- `ANALISA` dapat melihat detail lebih lengkap untuk kebutuhan analisis/audit internal.
- Akses dicatat di `audit_logs` dengan metadata scope (`GLOBAL`, `ROUTE`, atau `BBOX`) dan mode akses identitas (`MASKED`/`FULL`).
- Untuk production, set `PASSENGER_LOCATION_REQUIRE_SCOPE_FOR_OPERATOR=true` agar akses `OPERATOR` wajib memakai scope `route_id` atau `bbox`.
- Data lokasi yang dikirim tetap meliputi lokasi terakhir, akurasi, waktu terakhir terlihat, plate no kendaraan terdekat, dan jaraknya jika bisa dihitung dari `vehicle_latest`.

### Submit Report

```text
POST /public/reports
```

Authentication wajib (`PUBLIC_USER`). Request multipart/form-data.

Field wajib:

- `plate_no`
- `category`
- `description`
- `lat`
- `lon`
- `reported_at`
- **minimal satu file pada field `attachments`** (JPEG/PNG/WebP, maks 5 MB per file)

Request ditolak jika:

- user belum login;
- `plate_no` kosong;
- lokasi tidak tersedia;
- **attachment tidak ada** — laporan teks saja tanpa foto tidak diterima;
- kategori tidak dikenal;
- user melewati rate limit.

### Riwayat Laporan Milik User

```text
GET /me/public-reports
GET /me/public-reports/:id
```

Authentication wajib (`PUBLIC_USER`). Mengembalikan laporan yang dikirim oleh user yang sedang login. Bukan endpoint publik — setiap user hanya melihat laporannya sendiri.

### Operator Review

```text
GET /operator/public-reports
GET /operator/public-reports/:id
POST /operator/public-reports/:id/actions
```

Endpoint ini hanya untuk role internal Dishub.

Saat action `ESCALATE_TO_INCIDENT`, API membuat atau menautkan row `incidents` dengan report tersebut.

### Automated Review

```text
POST /internal/public-reports/:id/review
GET /operator/public-reports/:id/reviews
```

Endpoint trigger internal dipakai oleh worker/job automation, bukan oleh mobile app.

Review otomatis berjalan setelah report dibuat dan attachment metadata tersimpan. Worker mengambil:

- report metadata;
- reporter location;
- `plate_no`;
- matched vehicle dari master data;
- latest vehicle position;
- telemetry window sekitar `reported_at`;
- anomaly dan alert aktif/recent;
- incident aktif/recent untuk kendaraan yang sama;
- route/stop/terminal geofence jika kategori butuh konteks lokasi.

Hasil review disimpan di `public_report_reviews`, lalu status/prioritas report bisa diperbarui.

## Verifikasi Ngetem

Ketika report kategori `NGETEM` masuk, sistem tidak langsung menyatakan kendaraan bersalah.

API/operator web sebaiknya menampilkan konteks:

- apakah `plate_no` cocok dengan master data kendaraan;
- posisi terakhir kendaraan dari GPS;
- jarak posisi pelapor ke posisi terakhir kendaraan;
- apakah kendaraan sedang bergerak rendah atau diam;
- apakah ada anomaly/alert `NGETEM` aktif atau recent;
- apakah report lain untuk plate no/lokasi yang sama muncul dalam window pendek.

Dishub tetap menjadi pihak yang memutuskan validitas laporan.

## Phase 14E - Automated Public Report Review

Automation review bertujuan mempercepat triase laporan masyarakat, bukan mengganti audit dan kontrol Dishub.

Pipeline:

```text
Public report created
  -> PENDING_REVIEW
  -> automated review worker
  -> evidence lookup dari monitoring
  -> verdict + confidence + reason_summary
  -> optional auto-escalate bila CONFIRMED
  -> operator notification
```

Implementasi saat ini:

- `api-gateway` menjalankan BullMQ queue `public-report-review` dengan Redis dari Docker Compose.
- Scheduler enqueue berjalan tiap `PUBLIC_REPORT_REVIEW_INTERVAL_MS` dan bisa dipicu manual dari operator endpoint `POST /operator/public-reports/reviews/run`.
- Worker menyimpan hasil ke tabel `public_report_reviews`.
- Evidence snapshot mengambil master vehicle, `vehicle_latest`, telemetry window dari `vehicle_positions`, anomaly, alert, incident, serta konteks `route_stops`/`geofences`.
- Latest review dikembalikan oleh endpoint operator public report list/detail dan ditampilkan sebagai panel explainable evidence di operator web.

### Policy Verdict

`CONFIRMED`:

- `plate_no` cocok dengan kendaraan master data;
- lokasi pelapor masuk radius wajar dari posisi GPS kendaraan;
- telemetry/rules membuktikan anomaly sesuai kategori;
- evidence cukup kuat untuk auto-escalate.

`LIKELY`:

- `plate_no` cocok;
- lokasi dan telemetry mencurigakan;
- threshold rule belum cukup kuat untuk auto-escalate;
- report tetap di review queue dengan prioritas tinggi.

`INCONCLUSIVE`:

- data tidak cukup;
- telemetry tidak tersedia;
- kendaraan tidak punya posisi terbaru;
- report perlu review manual.

`REJECT_SUSPECTED_SPAM`:

- plate tidak match;
- lokasi jauh dari kendaraan;
- pola report mencurigakan atau duplikat buruk;
- tetap tidak dihapus otomatis agar Dishub bisa audit.

### NGETEM Check

Untuk kategori `NGETEM`, worker mengecek:

- `plate_no` match ke `vehicle_id`;
- jarak reporter ke posisi kendaraan;
- telemetry window sekitar waktu laporan;
- avg speed rendah, misalnya `<= 3 km/jam`;
- durasi berhenti memenuhi threshold, misalnya `>= 10 menit`;
- kendaraan berada di luar stop/terminal/pool resmi;
- anomaly/alert `NGETEM` aktif atau recent.

Jika semua evidence kuat, automation bisa membuat incident dengan tipe `NGETEM` dan menautkannya ke report.

### Overspeed/Reckless Driving Check

Untuk kategori `RECKLESS_DRIVING`, worker mengecek overspeed sebagai sinyal awal:

- telemetry window sekitar waktu laporan;
- `speed_kmh > 60` sebagai threshold awal;
- minimal 2 dari 3 titik telemetry melewati threshold agar tidak trigger dari satu spike GPS;
- alert/anomaly `OVERSPEED` aktif atau recent jika ada.

Jika evidence kuat, automation bisa membuat incident `OVERSPEED` atau menandai report sebagai high-priority review.

### Peran AI

AI dipakai untuk membantu operator memahami evidence:

- merangkum alasan verdict;
- menjelaskan confidence score dalam bahasa manusia;
- mengecek konsistensi kategori dengan deskripsi user;
- OCR lokal asynchronous untuk membandingkan plat nomor pada foto dengan input `plate_no`;
- planned duplicate/spam signal dari pola laporan.

AI tidak boleh menjadi satu-satunya dasar auto-escalation. Auto-escalation harus tetap membutuhkan evidence telemetry/rules yang memenuhi policy `CONFIRMED`.

Catatan implementasi: fase ini memakai `rules_assisted_summary` sebagai lapisan AI-assist awal untuk summary, explanation, dan klasifikasi deskripsi. OCR plat nomor diproses asynchronous oleh worker Docker lokal setelah attachment tersimpan di MinIO. OCR tidak mengubah `plate_match_status`, tidak menjadi dasar auto-escalation, dan tidak memicu sanksi otomatis. Confidence `>= 0.90` menghasilkan `OCR_MATCHED` atau `OCR_MISMATCHED`; hasil di bawah threshold, tidak terbaca, atau gagal diproses menghasilkan `NEEDS_OPERATOR_REVIEW`.

### OCR Plat Lokal

Detail desain dan kontrak implementasi OCR tersedia di
`docs/superpowers/specs/2026-05-31-public-report-local-ocr-design.md`.

- Queue BullMQ: `public-report-ocr`.
- Worker berjalan lokal dalam Docker dan tidak mengirim foto ke layanan eksternal.
- Input worker adalah object attachment dari bucket MinIO `public-report-evidence`.
- Hasil OCR disimpan di tabel `public_report_ocr_results`.
- Status proses: `PENDING`, `PROCESSING`, `COMPLETED`, atau `FAILED`.
- Hasil perbandingan: `OCR_MATCHED`, `OCR_MISMATCHED`, atau `NEEDS_OPERATOR_REVIEW`.
- OCR hanya membantu operator melakukan review.

## Operator Web

Public report dapat dibuat sebagai menu baru atau tab di Incident Center.

List view:

- status;
- kategori;
- plate no;
- waktu laporan;
- match kendaraan;
- jumlah attachment;
- indikator jarak pelapor ke kendaraan jika tersedia.

Detail view:

- foto bukti lewat endpoint API gateway yang mengambil object dari MinIO setelah cek role;
- titik lokasi pelapor;
- deskripsi;
- profile kendaraan ringkas;
- posisi GPS terakhir kendaraan;
- anomaly/alert/incident terkait;
- verdict AI/automation, confidence score, dan reason summary;
- hasil OCR lokal per attachment: raw text, kandidat plat, confidence, dan status perbandingan;
- action review.

## Passenger Mobile Experience

Design mobile harus berbeda dari dashboard operator.

Prinsip UI:

- minimalis dan cepat dipahami;
- berwarna tapi tidak ramai;
- memberi rasa aman dan dipercaya;
- report flow pendek, idealnya 3 langkah: kategori, bukti, konfirmasi;
- copywriting jelas untuk alasan lokasi wajib;
- tidak menampilkan istilah internal seperti anomaly, alert, risk score, atau RBAC.

Tone visual:

- warna dasar terang atau netral;
- warna dasar pakai warm white atau default white kalo bisa
- aksen hijau/biru untuk aman dan navigasi;
- amber untuk perhatian;
- merah hanya untuk kondisi urgent;
- microcopy harus terasa civic dan membantu, bukan menghakimi.

## Security dan Privacy

- User harus login sebelum submit laporan.
- Tracking publik harus dibatasi ke data kendaraan yang memang boleh dilihat masyarakat.
- Lokasi pelapor hanya dipakai untuk evidence report dan tidak ditampilkan ke publik.
- Attachment report tidak boleh berada di public bucket.
- Operator web membaca attachment lewat API gateway dengan token/session internal; file tetap tersimpan di MinIO dan tidak memakai URL publik permanen.
- Rate limit harus aktif untuk submit report.
- Report action operator harus masuk audit log.
- Automated review harus menyimpan evidence snapshot dan review engine version agar bisa diaudit.
- Auto-escalation hanya boleh terjadi untuk verdict `CONFIRMED` dengan evidence monitoring yang kuat.
- Export/reporting yang memuat data pelapor harus dimasking kecuali role berwenang.

## Done Definition

Phase ini dianggap selesai jika:

- mobile app Android/iOS bisa menampilkan tracking angkot tanpa login;
- submit report membutuhkan login;
- report tidak bisa dikirim tanpa plate no, lokasi aktif, dan foto bukti;
- attachment tersimpan di MinIO;
- PostgreSQL menyimpan metadata attachment dan object key;
- operator web bisa menerima, membuka, dan menindaklanjuti report;
- report valid bisa dieskalasi ke incident;
- automated review bisa memberi verdict berbasis telemetry, anomaly, alert, dan context report;
- verdict `CONFIRMED` bisa auto-escalate menjadi incident dan membuat notifikasi operator;
- data sensitif pelapor dan attachment tidak bocor ke endpoint publik.
