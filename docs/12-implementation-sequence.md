# Urutan Implementasi Engineering

## Tujuan

Dokumen ini merinci urutan kerja engineering dari repo kosong menuju MVP sistem monitoring angkot yang bisa menerima telemetry, menampilkan peta real-time, mencatat anomaly, dan membuka jalur pengembangan intelligence dashboard.

## Prinsip Eksekusi

- mulai dari vertical slice kecil yang berjalan end-to-end,
- jangan membangun intelligence layer sebelum ingestion dan telemetry stabil,
- semua service punya health endpoint atau log startup sejak awal,
- migration database dibuat sebelum API yang bergantung pada tabelnya,
- frontend memakai mock data terlebih dahulu, lalu dihubungkan ke API secara bertahap.

## Fase 0: Scaffold Repo

Output:

- struktur folder `backend/`
- struktur folder `frontend/`
- dokumen implementasi
- placeholder service entrypoints

Kriteria selesai:

- backend punya Go module,
- frontend punya Next.js App Router skeleton,
- struktur folder sudah mencerminkan service dan modul utama.

## Fase 1: Database Foundation

Output:

- migration ekstensi database,
- tabel master data,
- tabel device installation,
- tabel telemetry,
- seed data minimum.

Urutan kerja:

1. buat migration `fleet_owners`,
2. buat migration `routes`,
3. buat migration `vehicles`,
4. buat migration `gps_devices`,
5. buat migration `device_installations`,
6. buat migration `telemetry_points`,
7. aktifkan Timescale hypertable.

Kriteria selesai:

- database bisa menyimpan kendaraan, pemilik, trayek, device, dan telemetry.

## Fase 2: Ingestion Vertical Slice

Output:

- endpoint ingestion,
- validasi payload,
- normalisasi payload,
- publish event,
- telemetry tersimpan.

Urutan kerja:

1. implement `ingestion-service`,
2. implement event contract `telemetry.received`,
3. implement `telemetry-writer`,
4. buat simulator payload GPS sederhana,
5. verifikasi telemetry masuk ke TimescaleDB.

Kriteria selesai:

- satu payload GPS dapat masuk dari endpoint sampai tersimpan di database.

## Fase 3: Realtime Map

Output:

- realtime state di Redis,
- endpoint marker kendaraan,
- halaman map dashboard dengan marker mock/API.

Urutan kerja:

1. implement `realtime-state-service`,
2. simpan last known position,
3. implement `GET /api/v1/realtime/vehicles`,
4. buat halaman `Command Center`,
5. tampilkan marker kendaraan.

Kriteria selesai:

- posisi kendaraan terbaru bisa muncul di dashboard.

## Fase 4: Vehicle Detail Panel

Output:

- endpoint detail kendaraan,
- panel detail marker,
- riwayat anomaly dasar.

Urutan kerja:

1. implement `GET /api/v1/vehicles/{id}`,
2. implement `GET /api/v1/vehicles/{id}/history`,
3. tampilkan foto, plat, pemilik, alamat, trayek, status, dan risk score,
4. siapkan tombol playback dan network view.

Kriteria selesai:

- klik marker membuka profil kendaraan lengkap.

## Fase 5: Anomaly dan Risk Score

Output:

- rule keluar trayek,
- rule ngetem,
- rule offline,
- tabel anomaly, alert, risk score,
- panel alert aktif.

Urutan kerja:

1. implement `anomaly-risk-engine`,
2. buat checker route compliance,
3. buat checker idling outside zone,
4. buat offline detector,
5. update risk score,
6. expose alert list ke dashboard.

Kriteria selesai:

- anomaly dasar muncul sebagai alert dan mempengaruhi risk score kendaraan.

## Fase 6: Playback dan Incident

Output:

- endpoint playback,
- UI playback perjalanan,
- incident workflow dasar.

Urutan kerja:

1. implement query playback,
2. buat UI playback route,
3. implement escalate alert ke incident,
4. implement resolve incident.

Kriteria selesai:

- operator dapat menelusuri perjalanan dan menaikkan alert menjadi incident.

## Fase 7: Owner Intelligence

Output:

- priority owners,
- owner compliance snapshots,
- risk propagation,
- fleet pattern cases.

Urutan kerja:

1. implement `owner_compliance_snapshots`,
2. implement `GET /owners/priority`,
3. implement risk propagation analyzer,
4. implement fleet pattern case list,
5. buat halaman `Fleet Intelligence`.

Kriteria selesai:

- sistem bisa memprioritaskan pemilik armada berdasarkan risiko kendaraan-kendaraannya.

## Fase 8: Collective Anomaly dan Device Fraud

Output:

- collective anomaly detector,
- suspicious devices,
- device identity events,
- Device Fraud view.

Urutan kerja:

1. implement offline kolektif,
2. implement abnormal clustering,
3. implement device reassignment spike,
4. implement suspicious device endpoint,
5. buat halaman `Device Fraud`.

Kriteria selesai:

- sistem bisa menampilkan anomali lintas kendaraan dan indikasi fraud device.

## Fase 9: Investigation Desk

Output:

- network view,
- timeline evidence,
- action panel.

Urutan kerja:

1. implement network graph endpoint untuk owner,
2. implement network graph endpoint untuk vehicle,
3. buat komponen `NetworkGraph`,
4. buat timeline evidence,
5. hubungkan action panel ke incident workflow.

Kriteria selesai:

- supervisor bisa melihat hubungan pemilik, kendaraan, device, incident, dan sanction.

## Ringkasan Prioritas

Prioritas pertama adalah ingestion sampai peta real-time. Prioritas kedua adalah anomaly dan risk score. Intelligence layer seperti kolusi, collective anomaly, fraud device, dan network view sebaiknya dibangun setelah data telemetry dan incident cukup stabil.
