
# Dokumentasi Sistem Monitoring Angkot (Bogor)
Versi: 1.0  
Timezone: Asia/Jakarta  
Produk: **Web Operator (Pemerintah)** + **Mobile App Masyarakat** + (**Device GPS Angkot / Driver App**)

---

## 1. Latar Belakang & Masalah
### Faktor dibuatnya aplikasi monitoring angkot
1. Bogor dikenal sebagai “kota angkot”.
2. Angkot sering **ngetem** (mengganggu kelancaran, potensi pungli/konflik).
3. Pengusaha/pemilik angkot masih ingin usaha angkot tetap berjalan (butuh transparansi & efisiensi).
4. Peningkatan keamanan: mencegah/merespons kejahatan (jambret, pelecehan, intimidasi, dll).

### Masalah utama yang ingin diselesaikan
- Pemerintah sulit memantau kepatuhan rute/trayek & perilaku operasi (ngetem berlebihan, putar arah liar, dsb).
- Penumpang tidak punya “rasa aman” & saluran pelaporan cepat.
- Pemilik sulit mendapat data rit/bolak-balik, performa operasi, dan bukti kinerja.

---

## 2. Tujuan & Ruang Lingkup
### Tujuan (Goals)
- Realtime visibility armada angkot per trayek.
- Deteksi cepat anomali operasional dan respons insiden.
- Pemetaan rute 01/02/03 secara geospasial (koridor rute).
- Laporan rit & kinerja untuk pemilik dan pemerintah.
- Menurunkan angka kejahatan/insiden melalui pelaporan dan tombol darurat.

### Non-goals (di tahap awal)
- Pembayaran digital/ETLE angkot.
- Optimasi rute otomatis berbasis AI (bisa tahap lanjutan).
- Face recognition atau hal invasif (hindari untuk privasi).

---

## 3. Produk & Modul
### A. Web Operator Pemerintah
Fitur:
1. **Realtime monitoring** (peta + status armada).
2. **Tracking** (riwayat jalur per kendaraan).
3. **Playback** (putar ulang per rentang waktu).
4. **Anomali detection** (ngetem/off-route/overspeed/lost-signal).
5. **Analytics** (heatmap kepadatan, jam sibuk, KPI trayek).
6. **Incident center** (SOS/panic, laporan penumpang, tindakan).
7. **Scheduling & shift** (penugasan driver/armada).
8. **Reporting** (rit/bolak-balik, kepatuhan rute, waktu operasional, dll).
9. **Master data** (trayek, koridor, pool/base, stop resmi, pemilik, armada, device).

### B. Mobile App Masyarakat
Fitur:
- Lokasi wajib aktif (mode “Safety Trip”).
- Lihat angkot terdekat (opsional jika kebijakan mengizinkan).
- **Panic button** (SOS) → kirim lokasi + metadata.
- **Report anomali by passenger** (pelecehan, jambret, intimidasi, dsb).
- Riwayat laporan & status tindak lanjut.
- (Opsional) Share trip ke keluarga (link/ID perjalanan).

### C. GPS Angkot (Wajib)
Opsi implementasi:
- **Opsi 1 (MVP cepat): Driver App** Android khusus pengemudi.
- **Opsi 2 (Operasional stabil): GPS tracker IoT** (MQTT/HTTP).

> Catatan: Tracking angkot yang akurat harus berasal dari device angkot. Lokasi penumpang digunakan untuk keamanan/insiden & korelasi, bukan menggantikan GPS kendaraan.

---

## 4. Peran (Roles) & Akses (RBAC)
### Roles utama
- **Operator**: monitor peta, validasi anomali, buat tiket insiden.
- **Supervisor**: akses data sensitif (alamat lengkap, NIK), set rule, approve tindakan.
- **Admin Sistem**: master data, user management, integrasi device.
- **Auditor**: read-only + audit log.
- **Pemilik Angkot** (portal opsional): lihat laporan rit & performa armada miliknya.
- **Driver**: start/stop duty, mode operasi, panic (opsional).
- **Passenger**: safety trip, panic, report.

### Prinsip akses data sensitif
- Detail pemilik **dibatasi berdasarkan role** (ringkas vs lengkap).
- Semua akses data sensitif dicatat pada **audit log**.

---

## 5. Data Registrasi Pemilik Angkot (yang wajib disiapkan)
> Tujuan: verifikasi legal, akurasi operasional, dan rule pengecualian (pulang ke base) agar tidak memicu false alarm.

### A. Data Pemilik (perorangan / badan usaha)
**Identitas**
- Nama lengkap
- NIK (KTP)
- Foto KTP + selfie verifikasi (opsional)
- NPWP (opsional) / NIB (jika badan usaha)
- Status kepemilikan (pribadi/koperasi/perusahaan)

**Alamat & Domisili**
- Alamat sesuai KTP
- Alamat domisili (jika berbeda)
- Titik **Base/Pool/Tempat Parkir** (koordinat peta)
- Foto lokasi base/pool (minimal 2 sudut)

**Kontak**
- No HP utama (WA)
- No cadangan
- Kontak darurat (keluarga/pengurus pool)
- Email (opsional)

**Legal/Administrasi**
- Keanggotaan koperasi/pool (jika ada)
- Surat izin operasional/trayek (jika ada, sesuai kebijakan daerah)

**Preferensi Operasi**
- Trayek yang diizinkan untuk armada ini (mis. 01)
- Jam operasional umum (hari kerja/akhir pekan)

### B. Data Kendaraan
**Identitas**
- Nomor polisi
- Nomor rangka (VIN) & nomor mesin
- Merk/tipe/tahun
- Warna kendaraan
- Kapasitas (jumlah kursi)

**Dokumen**
- STNK (nomor, masa berlaku, foto)
- BPKB (nomor, foto/validasi offline)
- KIR/Uji berkala (masa berlaku, foto)
- Pajak kendaraan (status)
- Izin trayek (jika ada)

**Atribut Lapangan**
- Foto kendaraan: depan/belakang/samping/dalam
- Nomor lambung/kode armada (jika ada)
- Tanda trayek (mis. “01”) + foto

### C. Data Driver (jika memakai driver management)
- Nama driver, NIK ringkas
- No SIM & masa berlaku
- No HP
- Penugasan shift (driver A/B)
- Kontak darurat driver (opsional)

### D. Data Shift & Operasional
- Shift 1: jam mulai–selesai (contoh 05:00–13:00)
- Shift 2: jam mulai–selesai (contoh 13:00–21:00)
- Hari aktif (Senin–Minggu / hari tertentu)
- Lokasi terminal awal/akhir (geofence)
- **Mode operasi** yang wajib ada:
  - `IN_SERVICE` (narik penumpang sesuai trayek)
  - `DEADHEAD_TO_BASE` (kosong pulang base/pool)
  - `OUT_OF_SERVICE` (off/parkir)
  - `MAINTENANCE` (perbaikan)
  - `EMERGENCY` (darurat)

### E. Data Perangkat GPS
- Device ID/Serial/IMEI
- Nomor SIM card perangkat (ICCID/MSISDN)
- Provider
- Interval ping (default & adaptif)
- Foto pemasangan device (untuk IoT)
- Status health device (baterai/tegangan/sinyal/last seen)

---

## 6. Pemetaan Rute (Trayek 01/02/03) & Koridor Buffer
### Konsep
- Rute disimpan sebagai **LINESTRING**.
- Dibuat koridor rute sebagai **POLYGON** menggunakan `ST_Buffer`.
- Angkot dianggap “on-route” jika posisinya berada dalam koridor tersebut.

### Rekomendasi radius buffer
- GPS HP/alat bisa meleset 5–15m (kota padat).
- Jika Anda ingin “buffer diameter 4m” (radius 2m), itu **berpotensi terlalu ketat**.
- Rekomendasi awal: **10m–25m** lalu kalibrasi per segmen.

### Implementasi PostGIS (contoh konsep)
- `corridor = ST_Buffer(route_geom::geography, radius_m)::geometry`
- Cek on-route:
  - `ST_Contains(corridor, point_geom)` atau
  - `ST_DWithin(point_geom::geography, route_geom::geography, radius_m)`

> Opsional lanjutan: **map-matching** (OSRM/Valhalla) agar track tidak zig-zag.

---

## 7. Aturan Anomali (Rules) + Pengecualian “Pulang ke Dramaga”
### A. Jenis anomali inti
1. **NGETEM**: kendaraan berhenti (speed < threshold) lebih dari X menit di luar stop resmi.
2. **OFF_ROUTE**: kendaraan di luar koridor trayek lebih dari Y detik/menit.
3. **OVERSPEED**: melebihi batas pada segmen tertentu.
4. **LOST_SIGNAL**: tidak ada ping lebih dari Z menit.
5. **DEVICE_TAMPER**: device mati mendadak, pattern tidak wajar (opsional).

### B. Prinsip anti false-alarm (wajib)
**OFF_ROUTE hanya dihitung jika status = `IN_SERVICE`.**

### C. Pengecualian: Angkot 01 menuju Dramaga tidak dianggap anomali
Kondisi agar “keluar trayek menuju base/pool” tidak jadi OFF_ROUTE:
- Status kendaraan **bukan** `IN_SERVICE` (mis. `DEADHEAD_TO_BASE` / `OUT_OF_SERVICE`)
- Tujuan adalah **base/pool terdaftar** (mis. Dramaga)
- Dalam window waktu wajar:
  - setelah shift selesai ±30–60 menit, atau sebelum shift mulai ±30–60 menit
- (opsional penguatan) jarak ke base **menurun konsisten** pada N ping terakhir

**Cara menentukan “mode pulang”**
- Opsi 1 (disarankan): tombol di driver app “Selesai narik (Pulang)”.
- Opsi 2: auto-infer:
  - sudah lewat jam shift end
  - jarak ke base makin dekat
  - tidak ada aktivitas “stop resmi” di trayek

### D. Pseudocode aturan OFF_ROUTE (ringkas)
```pseudo
if vehicle.status == IN_SERVICE:
    if not within_corridor(vehicle.point, vehicle.route_corridor):
        if duration_outside_corridor > Y_seconds:
            raise OFF_ROUTE
else:
    # DEADHEAD_TO_BASE / OUT_OF_SERVICE / MAINTENANCE
    ignore OFF_ROUTE
````

### E. Pseudocode pengecualian DEADHEAD_TO_BASE

```pseudo
if vehicle.status == DEADHEAD_TO_BASE:
    if is_heading_to_base(vehicle.last_points, vehicle.base_point):
        ignore OFF_ROUTE
    else if duration > max_deadhead_duration:
        raise SUSPICIOUS_DEADHEAD
```

---

## 8. Alur Pengguna (User Flow)

### A. Flow Operasional Pemerintah (Operator Web)

1. **Login** (RBAC)
2. Dashboard peta:

   * filter trayek 01/02/03
   * lihat status: moving/stopped/off-route/SOS/lost-signal
3. Klik ikon angkot → panel detail:

   * ringkas kendaraan + status + last update
   * tab pemilik (ringkas/role-based)
   * tab shift & mode operasi
   * tab anomali & insiden
4. Jika anomali:

   * operator validasi (true/false)
   * buat tiket insiden jika perlu
   * hubungi pemilik/driver/petugas lapangan
5. Reporting:

   * pilih rentang waktu → rit, ngetem, kepatuhan rute
   * export PDF/CSV
6. Master data:

   * tambah trayek, gambar rute, set buffer, set stop resmi, set base/pool
7. Audit:

   * lihat log akses data sensitif & log tindakan insiden

### B. Flow Masyarakat (Mobile App)

1. Onboarding:

   * persetujuan lokasi + kebijakan privasi
2. Mode “Safety Trip”:

   * lokasi aktif selama perjalanan
   * (opsional) pilih naik angkot trayek 01/02/03
3. Panic button:

   * kirim SOS + lokasi + kategori
   * tampil status penanganan
4. Report anomali:

   * isi kategori (pelecehan/jambret/ancaman/dll)
   * auto attach lokasi + waktu
   * dapat nomor tiket & update

### C. Flow Pemilik (Portal opsional)

1. Login
2. Lihat armada milik sendiri (realtime/summary)
3. Laporan rit/hari, jam operasional, waktu ngetem, kepatuhan trayek
4. Notifikasi (device mati, lost signal, dll)

---

## 9. Tampilan Detail Angkot di Dashboard Operator

Saat ikon angkot di-klik, panel menampilkan:

### Header ringkas

* ID armada / Nomor polisi / Trayek / Status mode (IN_SERVICE/DEADHEAD/...)
* Kecepatan, arah, last update, akurasi GPS
* Tombol cepat: **Buat tiket** | **Hubungi pemilik** | **Riwayat**

### Tab: Pemilik

* Nama pemilik
* No kontak
* Base/pool (peta mini)
* (Role supervisor) alamat lengkap, NIK, dokumen

### Tab: Kendaraan

* Status STNK/KIR/pajak (valid/expired)
* Foto kendaraan
* Info device GPS (IMEI, last seen, health)

### Tab: Operasional

* Shift aktif + driver bertugas
* Rit hari ini
* Status ngetem terakhir (durasi)

### Tab: Kejadian & Anomali

* daftar event: off-route, ngetem, overspeed, lost signal, SOS, laporan penumpang
* timeline playback shortcut

---

## 10. Arsitektur Sistem (High-Level)

### Komponen

* **Ingestion Service**: menerima ping lokasi (angkot & penumpang)
* **Realtime Gateway**: WebSocket untuk dashboard
* **Rules Engine**: evaluasi anomali (streaming/batch)
* **API Service**: REST/GraphQL untuk web & mobile
* **Storage**:

  * Postgres+PostGIS (master data + geofence + koridor)
  * Time-series store (TimescaleDB atau ClickHouse) untuk ping & playback
  * Redis untuk “latest position”, session, rate limit
* **Notification Service**: push notif, SMS/WA gateway (opsional)
* **Observability**: Prometheus/Grafana + logs + audit

### Aliran data (simplified)

Device Angkot/Mobile Passenger → API Ingestion → (Redis latest + DB pings) → Rules Engine → Events → Dashboard WebSocket + Notif

---

## 11. Tech Stack Rekomendasi

### Mobile (Masyarakat)

* Flutter / React Native
* Background location (Android foreground service, iOS background modes)
* Firebase Cloud Messaging (push notif)

### GPS Angkot

* Driver App Android (Flutter/Native) **atau** GPS tracker IoT
* MQTT broker (EMQX) jika IoT

### Web Operator

* Next.js + Mapbox GL JS (atau Leaflet)
* WebSocket client (realtime updates)

### Backend

* NestJS / FastAPI / Go
* WebSocket (Socket.IO / native WS)
* Kafka/Redpanda atau NATS (opsional tapi kuat untuk event)

### Database

* Postgres + PostGIS (wajib)
* TimescaleDB **atau** ClickHouse (untuk ping & analytics)
* Redis (cache realtime)

### DevOps & Monitoring

* Docker, Kubernetes (opsional sesuai skala)
* Prometheus + Grafana
* Loki/ELK
* Sentry (error tracking)

---

## 12. Skema Database (Rancangan)

> Ini rancangan konseptual; bisa disesuaikan.

### A. Master Data

* `owners` (pemilik)
* `vehicles` (angkot)
* `devices` (GPS)
* `drivers` (pengemudi)
* `routes` (trayek 01/02/03)
* `route_corridors` (polygon buffer)
* `stops` (stop resmi/terminal)
* `bases` (pool/base pemilik)
* `shifts` (jadwal shift)
* `assignments` (driver+vehicle+shift)

### B. Telemetry & Event

* `vehicle_pings` (time-series)
* `passenger_sessions` (safety trip)
* `passenger_pings` (opsional, disimpan minimal)
* `events` (anomali, SOS, report)
* `incidents` (workflow penanganan)
* `audit_logs` (akses data sensitif, tindakan operator)

### C. Field penting contoh (ringkas)

#### owners

* `owner_id`, `name`, `nik_hash`, `phone_primary`, `phone_alt`
* `address_brief`, `address_full_encrypted` (role-restricted)
* `base_id`, `verification_status`

#### vehicles

* `vehicle_id`, `plate_no`, `route_id`
* `stnk_no`, `stnk_expired_at`, `kir_expired_at`, `tax_status`
* `owner_id`, `device_id`, `vehicle_code`

#### routes

* `route_id` (01/02/03), `name`
* `route_geom` (LINESTRING)
* `buffer_radius_m`
* `corridor_geom` (POLYGON)

#### vehicle_pings (time-series)

* `vehicle_id`, `ts`, `lat`, `lon`, `speed`, `heading`, `accuracy_m`
* `status_mode` (IN_SERVICE/DEADHEAD/...)
* partition by date (jika ClickHouse) / hypertable (Timescale)

#### events

* `event_id`, `vehicle_id`, `type` (OFF_ROUTE/NGETEM/SOS/REPORT)
* `severity`, `ts_start`, `ts_end`, `geom`, `meta_json`
* `is_acknowledged`, `ack_by`, `ack_ts`

#### incidents

* `incident_id`, `source_event_id`
* `status` (OPEN/IN_PROGRESS/RESOLVED/FALSE_ALARM)
* `assigned_to`, `actions_log`

---

## 13. API & Endpoint (Contoh)

### Auth & User

* `POST /auth/login`
* `GET /me`
* `GET /users` (admin)
* `POST /users` (admin)

### Registrasi Pemilik/Armada

* `POST /owners`
* `POST /vehicles`
* `POST /devices`
* `POST /drivers`
* `POST /assignments`
* `POST /routes` (gambar rute)
* `POST /routes/:id/corridor` (generate buffer)

### Ingestion Telemetry

* `POST /telemetry/vehicle` (ping GPS angkot)
* `POST /telemetry/passenger` (ping safety trip, minimal)
* `POST /events/sos` (panic)
* `POST /reports` (report penumpang)

### Operator Dashboard

* `GET /dashboard/vehicles/latest?route=01`
* `GET /vehicles/:id/detail`
* `GET /vehicles/:id/playback?from=&to=`
* `GET /events?status=open&type=OFF_ROUTE`
* `POST /incidents`
* `PATCH /incidents/:id` (status, assign, resolve)

### Reporting

* `GET /reports/rit?vehicle_id=&date=`
* `GET /reports/kpi?route_id=&range=`
* `GET /exports/pdf?...`

### Realtime

* `WS /realtime` (subscribe per route/area)

  * channel: `vehicles.latest`, `events.new`, `incidents.update`

---

## 14. Perhitungan Rit (Bolak-Balik)

### Konsep

* Definisikan 2 geofence terminal: `Terminal_A` dan `Terminal_B`.
* Rit dihitung ketika kendaraan melewati urutan:

  * A → B (1 rit) atau A → B → A (2 rit) tergantung definisi.
* Untuk menghindari noise:

  * perlu dwell minimal di terminal, atau crossing dengan hysteresis.

### Pseudocode rit sederhana

```pseudo
state = last_terminal_crossed
if enter_geofence(Terminal_A) and state != "A":
   state = "A"
if enter_geofence(Terminal_B) and state == "A":
   rit += 1
   state = "B"
if enter_geofence(Terminal_A) and state == "B":
   rit += 1
   state = "A"
```

---

## 15. Privacy, Keamanan, dan Kepatuhan

### Prinsip privasi (penting karena lokasi masyarakat)

* **Consent jelas**: pengguna paham kenapa lokasi diaktifkan.
* Mode lokasi penumpang **hanya aktif saat Safety Trip** (bukan 24/7).
* Minimasi data:

  * simpan ping penumpang secara ringkas/terbatas (mis. agregat / event-based).
* Retensi:

  * ping detail kendaraan: 30–90 hari (sesuaikan kapasitas)
  * event/insiden: 1–3 tahun (kebutuhan investigasi)
* Audit log:

  * siapa membuka detail pemilik
  * siapa mengubah status insiden

### Security controls

* TLS end-to-end
* Token auth (JWT/OAuth2)
* Rate limit & anti spam report
* Enkripsi field sensitif (alamat lengkap, NIK) at-rest
* RBAC ketat + masking data di UI

---

## 16. Observability & Operasional

* Metrics:

  * jumlah kendaraan online, ping rate, lost-signal count
  * jumlah event per tipe, waktu respon insiden
* Logs:

  * ingestion errors, device invalid, GPS spoof suspicion
* Alerting:

  * spike lost-signal, broker down, DB lag

---

## 17. Rekomendasi MVP (Tahap 1)

1. Registrasi pemilik + armada + device GPS (angkot wajib).
2. Realtime monitoring + playback.
3. Pemetaan rute 01/02/03 + koridor buffer.
4. Deteksi ngetem & off-route (hanya saat IN_SERVICE).
5. Panic button + incident workflow operator.
6. Laporan rit per hari untuk pemilik & pemerintah.

Tahap 2:

* Map-matching, analytics lanjutan, score kepatuhan, prediksi area rawan.

---

## 18. Struktur Repository (Saran)

* `apps/`

  * `operator-web/` (Next.js)
  * `passenger-mobile/` (Flutter/RN)
  * `driver-mobile/` (opsional jika driver app)
* `services/`

  * `api-gateway/`
  * `telemetry-ingestion/`
  * `rules-engine/`
  * `notification-service/`
* `infra/`

  * `docker-compose/` atau `k8s/`
  * `monitoring/` (prometheus/grafana)
* `db/`

  * `migrations/`
  * `schemas/`
* `docs/`

  * PRD, API spec, runbook

---

## 19. Checklist Implementasi Penting

* [ ] Definisi trayek 01/02/03 + terminal geofence
* [ ] Kebijakan buffer corridor (radius realistis)
* [ ] Status mode kendaraan wajib (IN_SERVICE/DEADHEAD/...)
* [ ] Rule exception “pulang ke base” (mis. Dramaga) diaktifkan
* [ ] RBAC + masking data sensitif
* [ ] Audit log akses detail pemilik
* [ ] Retensi data & consent privasi penumpang
* [ ] Dashboard incident response siap pakai

---

````markdown
# Dokumen Teknis Lanjutan — Monitoring Angkot (Bogor)
Tambahan ini berisi: **DDL contoh tabel**, **payload API**, **query PostGIS**, **desain realtime (WS)**, **rules engine**, dan **wireframe teks**.

> Catatan: ini rancangan teknis yang siap dijadikan baseline. Detail field sensitif (NIK, alamat lengkap, dokumen) **wajib** mengikuti kebijakan pemda + prinsip minimasi data.

---

## 0) Pilihan Arsitektur Data (Recommended)
### Master Data + Geospasial
- **PostgreSQL + PostGIS** (wajib)
  - pemilik, kendaraan, rute, corridor buffer, stop resmi, base/pool, shift, RBAC, incident

### Telemetry (ping lokasi)
Pilih salah satu:
- **TimescaleDB** (paling “nyatu” dengan Postgres, enak untuk time-series)
- **ClickHouse** (super kencang untuk playback/analytics skala besar)

### Cache realtime
- **Redis**
  - posisi terakhir per kendaraan, state, rate limit, session

### Storage dokumen (foto STNK/BPKB/KIR)
- **Object storage**: S3/MinIO
  - database hanya simpan `file_url`, `hash`, metadata

---

## 1) Extensions & Konvensi
### PostgreSQL extensions
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto; -- untuk hashing/enkripsi field sensitif (opsional)
CREATE EXTENSION IF NOT EXISTS btree_gist; -- berguna untuk constraint berbasis range (opsional)
````

### Konvensi ID & waktu

* Semua tabel pakai `uuid` sebagai PK.
* Gunakan `timestamptz` (UTC), tampilkan di UI dalam Asia/Jakarta.
* Field geospasial:

  * `geom geometry(Point, 4326)` untuk titik
  * `route_geom geometry(LineString, 4326)` untuk rute
  * `corridor_geom geometry(Polygon, 4326)` untuk koridor

---

## 2) DDL — Master Data (Postgres + PostGIS)

### 2.1 RBAC minimal

```sql
CREATE TABLE roles (
  role_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL -- ADMIN, SUPERVISOR, OPERATOR, AUDITOR, OWNER_PORTAL
);

CREATE TABLE users (
  user_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE user_roles (
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);
```

### 2.2 Pemilik (owners) + base/pool

```sql
CREATE TABLE bases (
  base_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                 -- "Base Dramaga Pak X"
  address_brief text,                 -- versi ringkas
  geom geometry(Point, 4326) NOT NULL,
  geofence_radius_m integer NOT NULL DEFAULT 200,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE owners (
  owner_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('PERSONAL','COOP','COMPANY')),
  name text NOT NULL,
  phone_primary text NOT NULL,
  phone_alt text,
  emergency_contact_name text,
  emergency_contact_phone text,

  -- field sensitif: simpan hash + (opsional) enkripsi
  nik_hash text,                      -- contoh: encode(digest(nik, 'sha256'),'hex')
  address_brief text,
  address_full_encrypted bytea,       -- pgcrypto opsional

  base_id uuid REFERENCES bases(base_id),
  verification_status text NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX owners_base_idx ON owners(base_id);
```

### 2.3 Kendaraan + dokumen

```sql
CREATE TABLE vehicles (
  vehicle_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES owners(owner_id),
  vehicle_code text,                  -- nomor lambung/kode internal
  plate_no text NOT NULL UNIQUE,
  brand text,
  model text,
  year integer,
  color text,
  seat_capacity integer,

  chassis_no text,                    -- nomor rangka (bisa disamarkan di UI)
  engine_no text,

  route_id text,                      -- "01", "02" (FK ke routes.route_id di bawah)
  is_active boolean NOT NULL DEFAULT true,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE vehicle_documents (
  doc_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('STNK','BPKB','KIR','TAX','ROUTE_PERMIT','PHOTO')),
  doc_number text,
  valid_until date,
  file_url text,                      -- S3/MinIO URL
  file_hash text,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vehicle_docs_vehicle_idx ON vehicle_documents(vehicle_id);
```

### 2.4 Device GPS

```sql
CREATE TABLE devices (
  device_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type text NOT NULL CHECK (device_type IN ('DRIVER_APP','GPS_IOT')),
  imei_or_serial text UNIQUE,
  sim_msisdn text,                    -- nomor SIM pada device (opsional)
  provider text,
  install_photo_url text,
  firmware_version text,
  last_seen_at timestamptz,
  health_status text NOT NULL DEFAULT 'UNKNOWN'
    CHECK (health_status IN ('OK','WARN','DOWN','UNKNOWN')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vehicles
  ADD COLUMN device_id uuid REFERENCES devices(device_id);
```

### 2.5 Driver + shift + assignment

```sql
CREATE TABLE drivers (
  driver_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  sim_no text,
  sim_valid_until date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE shifts (
  shift_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,                 -- "Pagi", "Sore"
  start_time time NOT NULL,           -- 05:00
  end_time time NOT NULL,             -- 13:00
  active_days int[] NOT NULL DEFAULT '{1,2,3,4,5,6,7}', -- 1=Mon..7=Sun
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(driver_id),
  shift_id uuid NOT NULL REFERENCES shifts(shift_id),
  effective_from date NOT NULL DEFAULT CURRENT_DATE,
  effective_to date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX assignments_vehicle_idx ON assignments(vehicle_id);
```

### 2.6 Rute trayek + koridor buffer + stop resmi

```sql
CREATE TABLE routes (
  route_id text PRIMARY KEY,          -- "01", "02", "03"
  name text NOT NULL,
  buffer_radius_m integer NOT NULL DEFAULT 15, -- rekomendasi awal
  route_geom geometry(LineString, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE route_corridors (
  route_id text PRIMARY KEY REFERENCES routes(route_id) ON DELETE CASCADE,
  corridor_geom geometry(Polygon, 4326) NOT NULL,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE stops (
  stop_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id text REFERENCES routes(route_id),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('TERMINAL_A','TERMINAL_B','STOP')),
  geom geometry(Point, 4326) NOT NULL,
  geofence_radius_m integer NOT NULL DEFAULT 60,
  is_official boolean NOT NULL DEFAULT true
);

CREATE INDEX stops_route_idx ON stops(route_id);
CREATE INDEX stops_geom_gix ON stops USING GIST(geom);
CREATE INDEX corridor_geom_gix ON route_corridors USING GIST(corridor_geom);
```

### 2.7 Status mode kendaraan (audit perubahan mode)

Mode penting untuk mencegah false alarm “pulang ke base (Dramaga)”.

```sql
CREATE TABLE vehicle_mode_changes (
  mode_change_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  changed_by text NOT NULL CHECK (changed_by IN ('SYSTEM','DRIVER','OPERATOR')),
  from_mode text,
  to_mode text NOT NULL CHECK (to_mode IN ('IN_SERVICE','DEADHEAD_TO_BASE','OUT_OF_SERVICE','MAINTENANCE','EMERGENCY')),
  reason text,
  geom geometry(Point, 4326),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX vmc_vehicle_time_idx ON vehicle_mode_changes(vehicle_id, changed_at DESC);
```

### 2.8 Events, Incidents, Reports, Audit log

```sql
CREATE TABLE events (
  event_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid REFERENCES vehicles(vehicle_id),
  route_id text,
  type text NOT NULL CHECK (type IN ('OFF_ROUTE','NGETEM','OVERSPEED','LOST_SIGNAL','SOS','PASSENGER_REPORT','SUSPICIOUS_DEADHEAD')),
  severity text NOT NULL DEFAULT 'MEDIUM' CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  ts_start timestamptz NOT NULL,
  ts_end timestamptz,
  geom geometry(Point, 4326),
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_acknowledged boolean NOT NULL DEFAULT false,
  ack_by uuid REFERENCES users(user_id),
  ack_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX events_vehicle_time_idx ON events(vehicle_id, ts_start DESC);
CREATE INDEX events_type_time_idx ON events(type, ts_start DESC);
CREATE INDEX events_geom_gix ON events USING GIST(geom);

CREATE TABLE incidents (
  incident_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_event_id uuid REFERENCES events(event_id),
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','RESOLVED','FALSE_ALARM')),
  assigned_to uuid REFERENCES users(user_id),
  description text,
  actions_log jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE passenger_reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passenger_session_id uuid,
  category text NOT NULL CHECK (category IN ('HARASSMENT','THEFT','VIOLENCE','SUSPICIOUS','OTHER')),
  description text,
  geom geometry(Point, 4326),
  ts_reported timestamptz NOT NULL DEFAULT now(),
  vehicle_id uuid REFERENCES vehicles(vehicle_id),
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED','REVIEWED','LINKED_TO_INCIDENT','REJECTED'))
);

CREATE TABLE audit_logs (
  audit_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(user_id),
  action text NOT NULL,               -- VIEW_OWNER_DETAIL, UPDATE_INCIDENT, EXPORT_REPORT, etc
  target_type text,                   -- OWNER/VEHICLE/INCIDENT/REPORT
  target_id uuid,
  ip_addr inet,
  user_agent text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
```

---

## 3) DDL — Telemetry (TimescaleDB Option)

> Jika memakai TimescaleDB, buat hypertable untuk ping.

```sql
-- tabel ping (raw)
CREATE TABLE vehicle_pings (
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  speed_kmh double precision,
  heading_deg double precision,
  accuracy_m double precision,
  mode text NOT NULL CHECK (mode IN ('IN_SERVICE','DEADHEAD_TO_BASE','OUT_OF_SERVICE','MAINTENANCE','EMERGENCY')),
  geom geometry(Point, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED,
  PRIMARY KEY (vehicle_id, ts)
);

-- Timescale: create hypertable
SELECT create_hypertable('vehicle_pings', 'ts', chunk_time_interval => interval '1 day');

CREATE INDEX vehicle_pings_ts_idx ON vehicle_pings (ts DESC);
CREATE INDEX vehicle_pings_geom_gix ON vehicle_pings USING GIST (geom);

-- kompresi (opsional)
-- ALTER TABLE vehicle_pings SET (timescaledb.compress);
-- SELECT add_compression_policy('vehicle_pings', INTERVAL '7 days');
```

### “Latest position” table (opsional) — cepat untuk dashboard

```sql
CREATE TABLE vehicle_latest (
  vehicle_id uuid PRIMARY KEY REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  ts timestamptz NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  speed_kmh double precision,
  heading_deg double precision,
  accuracy_m double precision,
  mode text NOT NULL,
  geom geometry(Point, 4326) NOT NULL
);

CREATE INDEX vehicle_latest_geom_gix ON vehicle_latest USING GIST(geom);
```

> Alternatif: simpan latest di **Redis** saja. Tapi table ini enak untuk query spasial cepat dari PostGIS.

---

## 4) Telemetry (ClickHouse Option)

> Jika memilih ClickHouse untuk ping besar.

```sql
-- contoh konsep (tidak termasuk cluster/distributed)
CREATE TABLE vehicle_pings_ch (
  vehicle_id UUID,
  ts DateTime64(3, 'UTC'),
  lat Float64,
  lon Float64,
  speed_kmh Float32,
  heading_deg Float32,
  accuracy_m Float32,
  mode LowCardinality(String)
)
ENGINE = MergeTree
PARTITION BY toDate(ts)
ORDER BY (vehicle_id, ts);
```

---

## 5) Payload API (Contoh JSON)

### 5.1 Ping GPS angkot

`POST /telemetry/vehicle`

```json
{
  "vehicle_id": "uuid",
  "ts": "2026-01-25T10:15:30.123Z",
  "lat": -6.595038,
  "lon": 106.816635,
  "speed_kmh": 23.5,
  "heading_deg": 120.0,
  "accuracy_m": 8.0,
  "mode": "IN_SERVICE",
  "device": {
    "device_id": "uuid-or-serial",
    "battery": 0.87,
    "signal_dbm": -85
  }
}
```

### 5.2 Panic button (penumpang/driver)

`POST /events/sos`

```json
{
  "source": "PASSENGER",
  "vehicle_id": "uuid",
  "ts": "2026-01-25T10:16:10.000Z",
  "lat": -6.596,
  "lon": 106.817,
  "category": "HARASSMENT",
  "note": "Ada pelecehan di angkot",
  "attachments": [
    { "type": "AUDIO", "url": "s3://...", "hash": "..." }
  ]
}
```

### 5.3 Report anomali oleh penumpang

`POST /reports`

```json
{
  "session_id": "uuid",
  "vehicle_hint": { "route_id": "01", "plate_no": "F 1234 XX" },
  "category": "THEFT",
  "description": "Ada jambret, pelaku turun di lampu merah",
  "ts": "2026-01-25T10:20:00Z",
  "lat": -6.59,
  "lon": 106.81
}
```

---

## 6) WebSocket Realtime (Contoh)

`WS /realtime?token=...`

### Subscribe

```json
{ "type": "SUBSCRIBE", "channels": ["route:01", "events", "incidents"] }
```

### Push: posisi terbaru kendaraan

```json
{
  "type": "VEHICLE_LATEST",
  "route_id": "01",
  "payload": {
    "vehicle_id": "uuid",
    "plate_no": "F 1234 XX",
    "ts": "2026-01-25T10:15:30.123Z",
    "lat": -6.595038,
    "lon": 106.816635,
    "speed_kmh": 23.5,
    "mode": "IN_SERVICE"
  }
}
```

### Push: event baru

```json
{
  "type": "EVENT_NEW",
  "payload": {
    "event_id": "uuid",
    "type": "OFF_ROUTE",
    "severity": "HIGH",
    "vehicle_id": "uuid",
    "ts_start": "2026-01-25T10:18:00Z",
    "lat": -6.60,
    "lon": 106.80
  }
}
```

---

## 7) Query PostGIS Penting

### 7.1 Generate corridor buffer dari route_geom

```sql
-- generate corridor untuk semua route
INSERT INTO route_corridors(route_id, corridor_geom, generated_at)
SELECT
  r.route_id,
  ST_Buffer(r.route_geom::geography, r.buffer_radius_m)::geometry(Polygon, 4326) AS corridor_geom,
  now()
FROM routes r
ON CONFLICT (route_id)
DO UPDATE SET corridor_geom = EXCLUDED.corridor_geom, generated_at = now();
```

### 7.2 Cek “on-route” (point berada di corridor)

```sql
SELECT
  vp.vehicle_id,
  vp.ts,
  ST_Contains(rc.corridor_geom, vp.geom) AS on_route
FROM vehicle_pings vp
JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
JOIN route_corridors rc ON rc.route_id = v.route_id
WHERE vp.vehicle_id = '...'
ORDER BY vp.ts DESC
LIMIT 100;
```

### 7.3 Deteksi ngetem (dwell) sederhana

Definisi: speed < 2 km/h selama > X menit dan bukan di stop resmi.

```sql
-- contoh: cari kandidat ngetem 10 menit terakhir
WITH last10 AS (
  SELECT *
  FROM vehicle_pings
  WHERE ts > now() - interval '10 minutes'
),
slow AS (
  SELECT *
  FROM last10
  WHERE speed_kmh IS NOT NULL AND speed_kmh < 2
),
not_near_stop AS (
  SELECT s.*
  FROM slow s
  LEFT JOIN stops st
    ON ST_DWithin(s.geom::geography, st.geom::geography, st.geofence_radius_m)
   AND (st.route_id IS NULL OR st.route_id = (SELECT route_id FROM vehicles WHERE vehicle_id = s.vehicle_id))
  WHERE st.stop_id IS NULL
)
SELECT vehicle_id,
       min(ts) AS start_ts,
       max(ts) AS end_ts,
       extract(epoch from (max(ts) - min(ts))) / 60.0 AS minutes
FROM not_near_stop
GROUP BY vehicle_id
HAVING max(ts) - min(ts) > interval '5 minutes';
```

### 7.4 Hitung rit (bolak-balik) berbasis geofence terminal

Asumsi: stop terminal A & B diset di `stops.kind`.

```sql
-- 1) ambil terminal A/B route tertentu
WITH terminals AS (
  SELECT
    route_id,
    max(CASE WHEN kind='TERMINAL_A' THEN geom END) AS term_a,
    max(CASE WHEN kind='TERMINAL_B' THEN geom END) AS term_b,
    max(CASE WHEN kind='TERMINAL_A' THEN geofence_radius_m END) AS rad_a,
    max(CASE WHEN kind='TERMINAL_B' THEN geofence_radius_m END) AS rad_b
  FROM stops
  WHERE route_id = '01'
  GROUP BY route_id
),
p AS (
  SELECT vp.vehicle_id, vp.ts, vp.geom
  FROM vehicle_pings vp
  JOIN vehicles v ON v.vehicle_id = vp.vehicle_id
  WHERE v.route_id = '01'
    AND vp.ts >= '2026-01-25T00:00:00Z' AND vp.ts < '2026-01-26T00:00:00Z'
),
flags AS (
  SELECT
    p.*,
    (SELECT ST_DWithin(p.geom::geography, t.term_a::geography, t.rad_a) FROM terminals t) AS in_a,
    (SELECT ST_DWithin(p.geom::geography, t.term_b::geography, t.rad_b) FROM terminals t) AS in_b
  FROM p
)
-- 2) heuristik: hitung transisi A->B sebagai 1 rit
SELECT vehicle_id,
       count(*) FILTER (WHERE in_b = true) AS rough_b_entries
FROM flags
GROUP BY vehicle_id;
```

> Untuk rit yang benar-benar akurat, biasanya dipakai **state machine** (A→B→A) + “debounce” (minimal waktu antar crossing).

---

## 8) Rules Engine (Pseudocode + Severity)

### 8.1 OFF_ROUTE dengan pengecualian “pulang ke base”

**Prinsip:** OFF_ROUTE hanya saat `mode=IN_SERVICE`.

```pseudo
for each vehicle ping:
  route = vehicle.route_id
  corridor = route_corridor[route]
  on_route = contains(corridor, ping.point)

  if ping.mode == IN_SERVICE:
     if not on_route:
        outside_timer += dt
        if outside_timer > OFF_ROUTE_SECONDS:
            emit_event(OFF_ROUTE, severity=HIGH, meta={...})
     else:
        outside_timer = 0

  else if ping.mode == DEADHEAD_TO_BASE:
     # tidak hitung OFF_ROUTE
     # tapi cek apakah benar menuju base
     if not heading_to_base(vehicle.last_points, owner.base_point):
         deadhead_suspicion_timer += dt
         if deadhead_suspicion_timer > MAX_DEADHEAD_SUSPICION:
             emit_event(SUSPICIOUS_DEADHEAD, severity=MEDIUM)
     else:
         deadhead_suspicion_timer = 0
```

**heading_to_base()** (heuristik):

* hitung jarak ke base untuk N ping terakhir
* jika jarak menurun konsisten (mis. 6 dari 8 ping menurun) → dianggap menuju base

### 8.2 NGETEM severity (contoh)

* 3–5 menit: LOW
* 5–10 menit: MEDIUM
* > 10 menit: HIGH
* > 15 menit di titik rawan/terlarang: CRITICAL

---

## 9) Retensi, Partisi, dan Indexing

### Retensi data yang umum

* `vehicle_pings` raw: 30–90 hari (tergantung storage)
* `events/incidents`: 1–3 tahun
* `audit_logs`: 1–2 tahun

### Tips performa

* `vehicle_pings`:

  * index `GIST(geom)` untuk query spasial
  * hypertable (Timescale) / partition per day (ClickHouse)
* `route_corridors`:

  * `GIST(corridor_geom)` penting
* cache latest position di Redis untuk dashboard realtime:

  * key: `vehicle:{id}:latest`

---

## 10) Wireframe Teks (UI Operator Web)

### 10.1 Dashboard Map (Realtime)

**Layout**

* Top bar: [Logo] [Route Filter 01/02/03] [Search plate/owner] [Alerts badge] [User menu]
* Left sidebar (Filter):

  * Status: IN_SERVICE / DEADHEAD / SOS / LOST_SIGNAL / NGETEM
  * Time: last 5m / 15m / 1h
  * Owner / Pool / Shift
* Main map:

  * icon kendaraan (warna = status)
  * layer corridor route + stops
* Right panel (Detail ketika klik icon):

  * **Header**: Plate + Route + Mode + Speed + Last seen
  * Tabs:

    * **Pemilik** (ringkas) → tombol “Detail” (role supervisor)
    * **Kendaraan** (dokumen status)
    * **Operasional** (shift, driver, rit hari ini)
    * **Event & Incident** (timeline + action)
  * CTA:

    * [Buat Incident] [Hubungi Pemilik] [Playback 1 jam terakhir]

### 10.2 Incident Center

* Tabel list incident:

  * waktu, tipe, severity, kendaraan, lokasi, status, assigned
* klik row → detail:

  * peta mini + history 10 menit terakhir
  * catatan tindakan (actions_log)
  * tombol: assign, update status, resolve, false alarm

### 10.3 Route Editor

* Upload/Draw polyline rute
* Set buffer radius (m)
* Generate corridor
* Define stops: terminal A/B + stop resmi
* Preview: koridor overlay

---

## 11) Struktur Folder (Monorepo)

```text
repo/
  apps/
    operator-web/          # Next.js + Map
    passenger-mobile/      # Flutter/RN
    driver-mobile/         # optional (jika driver app)
  services/
    api-gateway/           # REST + Auth + RBAC
    telemetry-ingestion/   # ingest pings, validate device, push to stream/cache
    rules-engine/          # consume stream, compute events
    notification-service/  # push notif, sms/wa (opsional)
  db/
    migrations/
    seeds/
    sql/
  infra/
    docker-compose/
    k8s/
    monitoring/
  docs/
    PRD.md
    API.md
    RUNBOOK.md
```

---

## 12) Checklist Validasi Pengecualian “Menuju Dramaga”

Agar “angkot 01 pulang ke Dramaga” tidak jadi anomali, pastikan:

* [ ] Owner punya `base_id` dengan koordinat Dramaga
* [ ] Mode kendaraan bisa berubah ke `DEADHEAD_TO_BASE`
* [ ] OFF_ROUTE hanya dihitung saat `IN_SERVICE`
* [ ] Sistem punya aturan verifikasi “menuju base” (jarak menurun / window shift)
* [ ] Semua perubahan mode dicatat di `vehicle_mode_changes` (audit)

---

Selesai.

Kalau kamu ingin, aku bisa lanjutkan satu tingkat lebih detail lagi (masih markdown) berupa:
- **OpenAPI spec ringkas** untuk endpoint utama,
- **state machine rit** yang lebih akurat (A→B→A + debounce),
- dan contoh **view SQL** untuk “detail angkot saat di klik” (join vehicles + owners + docs + latest + last event).
