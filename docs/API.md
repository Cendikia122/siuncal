# API Contract

Dokumen ini mencatat kontrak API yang dipakai implementasi aktual MVP.

## Telemetry Vehicle

`POST /telemetry/vehicle`

Sumber kebenaran posisi kendaraan. Payload dapat mengidentifikasi kendaraan langsung dengan `vehicle_id` atau `plate_no`, atau melalui assignment device aktif memakai `device_id` atau `imei_or_serial`.

### Request

```json
{
  "vehicle_id": "uuid",
  "plate_no": "F 1234 XX",
  "device_id": "uuid",
  "imei_or_serial": "86753090001",
  "ts": "2026-01-25T10:15:30.123Z",
  "lat": -6.595038,
  "lon": 106.816635,
  "speed_kmh": 23.5,
  "heading": 120,
  "accuracy_m": 8,
  "status": "IN_SERVICE",
  "device": {
    "device_id": "uuid",
    "imei_or_serial": "86753090001",
    "battery": 0.87,
    "signal_dbm": -85,
    "power_connected": true
  }
}
```

### Field Rules

- `lat` dan `lon` wajib numeric dan berada dalam range koordinat valid.
- `speed_kmh` opsional, tetapi jika dikirim harus numeric dari `0` sampai `200`.
- `heading` opsional, tetapi jika dikirim harus numeric dari `0` sampai `360`.
- `ts` opsional, tetapi jika dikirim **harus string ISO-8601** (contoh: `"2026-01-25T10:15:30.123Z"` atau `"2026-01-25T17:15:30+07:00"`). API juga menerima alias `timestamp`. **Unix epoch ms (integer seperti `1748862300000`) tidak diterima** — schema akan menolak dengan 400. Untuk GPS tracker fisik (GT06N), waktu sudah dalam format DateTime terpisah di protokol binary; adapter Traccar mengonversi `deviceTime` ke ISO-8601 sebelum dikirim ke API sehingga tidak ada masalah kompatibilitas.
- `status` opsional. Jika kosong, API menginfer `IN_SERVICE` saat `speed_kmh > 0`.
- `battery_level`/`device.battery`, `signal_dbm`/`device.signal_dbm`, dan `power_connected`/`device.power_connected` opsional. Jika dikirim, field ini dipersist untuk health/tamper signal perangkat.
- `heading_deg` dan `mode` masih diterima sebagai payload legacy, tetapi simulator dan dokumentasi baru memakai `heading` dan `status`.

### Response

```json
{ "ok": true }
```

### Persistence

Jika kendaraan berhasil di-resolve, API menyimpan ping ke `vehicle_positions` termasuk sinyal health device opsional (`battery_level`, `signal_dbm`, `power_connected`). View `vehicle_latest` membaca posisi terbaru dari tabel tersebut sehingga dashboard realtime dapat mengirim event `VEHICLE_LATEST`.

### Device Health and Tamper Candidates

`GET /devices/health`

Authentication wajib untuk role `ANALISA`. Endpoint ini menampilkan kesehatan perangkat dan kandidat `DEVICE_TAMPER`.

Sinyal tamper saat ini:

- `POWER_DISCONNECT_THEN_LOST_SIGNAL`: ping terakhir membawa `power_connected=false`, lalu perangkat melewati ambang offline.
- `IMPOSSIBLE_MOVEMENT`: posisi berurutan 24 jam terakhir membutuhkan kecepatan di atas `DEVICE_TAMPER_IMPOSSIBLE_SPEED_KMH`.
- `REPEATED_IDENTITY_MISMATCH`: device identity yang sama gagal resolve berulang dalam rolling window 24 jam.
- `ASSIGNED_DEVICE_WITHOUT_TELEMETRY` dan `FREQUENT_REASSIGNMENT`: sinyal pendukung untuk triage perangkat.

### Telemetry Quality Dashboard

`GET /telemetry/quality?hours=1&route_id=01`

Authentication wajib untuk role internal dashboard (`OPERATOR` atau `ANALISA`). Endpoint ini menghitung kualitas tracking dari `vehicle_positions`, `telemetry_matched_positions`, assignment aktif, dan rolling metric ingestion.

`GET /telemetry/quality/export?hours=720&route_id=01`

Authentication wajib untuk role `ANALISA`. Endpoint ini menghasilkan CSV untuk review pilot bulanan, berisi section summary, kendaraan, agregasi trayek, dan agregasi device. Jika `hours` tidak dikirim, default export memakai 720 jam atau 30 hari.

Response utama:

```json
{
  "window": {
    "hours": 1,
    "target_interval_sec": 5,
    "stale_minutes": 10,
    "drift_threshold_m": 80,
    "expected_ping_count": 720
  },
  "summary": {
    "tracking_valid_pct": 98.25,
    "sla_target_pct": 99.5,
    "sla_met": false,
    "stale_vehicles": 1,
    "missing_ping_count": 24,
    "drift_count": 3,
    "assignment_mismatch_vehicles": 1,
    "rolling_rejections": {
      "invalid_device_identity": 0,
      "assignment_mismatch": 0,
      "duplicate_payload": 0
    }
  },
  "items": [],
  "by_route": [],
  "by_owner": [],
  "by_device": []
}
```

Konfigurasi:

- `TELEMETRY_TARGET_INTERVAL_SEC=5`
- `TELEMETRY_QUALITY_DRIFT_THRESHOLD_M=80`
- `TELEMETRY_QUALITY_SLA_TARGET_PCT=99.5`
- `DEVICE_OFFLINE_MINUTES=10`

---

## Emergency Response

### Passenger SOS

`POST /me/sos`

Authentication wajib `PUBLIC_USER`.

Payload:

```json
{
  "lat": -6.5944,
  "lon": 106.7891,
  "accuracy_m": 12,
  "category": "SECURITY",
  "message": "Penumpang merasa tidak aman di dalam angkot.",
  "session_id": "uuid-opsional",
  "vehicle_id": "uuid-opsional"
}
```

Response membuat incident `EMERGENCY` severity `CRITICAL`, mengisi `reporter_user_id`, `reporter_session_id` jika valid, lokasi, vehicle context jika tersedia, trust signal, dan SLA due time. Endpoint memiliki rate limit dan duplicate detection rolling window.

### Driver atau Device Panic

`POST /telemetry/driver-panic`

Authentication memakai telemetry token/HMAC yang sama dengan telemetry kendaraan.

Payload mengidentifikasi kendaraan melalui `vehicle_id`, `plate_no`, `device_id`, atau `imei_or_serial`, plus `lat` dan `lon`. Response membuat incident `EMERGENCY` severity `CRITICAL` dari source `DRIVER_DEVICE`.

### Emergency Board

`GET /emergencies`

Authentication wajib role `OPERATOR`, `ANALISA`, atau `PETUGAS_LAPANGAN`. Role petugas lapangan hanya melihat emergency yang assigned ke dirinya. Response berisi SLA timer, escalation state, assigned responder, lokasi, vehicle context, dan nearest vehicle.

### Proof Upload

`POST /incidents/:id/proofs`

Authentication wajib role internal. Request multipart field `proof` menerima JPEG/PNG/WebP dan menyimpan bukti ke object storage, lalu menulis action `PROOF_UPLOAD` ke `incident_actions.metadata`.

Konfigurasi:

- `EMERGENCY_SOS_RATE_LIMIT_WINDOW_MS=300000`
- `EMERGENCY_SOS_RATE_LIMIT_MAX=3`
- `EMERGENCY_DUPLICATE_WINDOW_MINUTES=5`
- `EMERGENCY_ACK_SLA_SECONDS=60`
- `EMERGENCY_ASSIGNMENT_SLA_SECONDS=180`

---

## Public Report

### Submit Report

`POST /public/reports`

Authentication wajib (`PUBLIC_USER`). Request multipart/form-data.

Field wajib: `plate_no`, `category`, `description`, `lat`, `lon`, `reported_at`, dan **minimal satu file** pada field `attachments` (JPEG/PNG/WebP, maks 5 MB per file, maks 3 file).

Request tanpa attachment akan ditolak dengan `400 VALIDATION_ERROR "Minimal satu foto bukti wajib"`.

### Lihat Riwayat Laporan (Public User)

`GET /me/public-reports`

Mengembalikan daftar laporan yang dikirim oleh user yang sedang login. Authentication wajib (`PUBLIC_USER`).

`GET /me/public-reports/:id`

Detail laporan milik user yang login.

### Antrian Review (Operator/Analisa)

`GET /operator/public-reports`

`GET /operator/public-reports/:id`

Endpoint untuk role internal Dishub (`OPERATOR` atau `ANALISA`). Menampilkan semua laporan + metadata reviewer + evidence snapshot automated review. **Tidak dapat diakses oleh `PUBLIC_USER`.**
