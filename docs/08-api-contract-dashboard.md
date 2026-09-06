# API Contract Dashboard Monitoring dan Intelijen Armada

## Tujuan

Dokumen ini mendefinisikan kontrak API awal untuk dashboard monitoring angkot dan dashboard intelijen operasional armada. Fokusnya adalah endpoint yang dibutuhkan frontend untuk peta real-time, panel detail kendaraan, intelijen pemilik armada, fraud analytics device, dan investigasi kasus.

## Prinsip Umum

- API menggunakan `REST JSON`.
- Semua timestamp menggunakan `ISO 8601`.
- Semua ID utama menggunakan `uuid`.
- Endpoint dashboard dibagi menjadi:
  - `realtime`
  - `vehicles`
  - `owners`
  - `alerts-incidents`
  - `intelligence`
  - `devices`
  - `network`

## Base Path

```text
/api/v1
```

## Format Response Umum

### Success

```json
{
  "data": {},
  "meta": {
    "request_id": "uuid",
    "generated_at": "2026-04-18T21:00:00Z"
  }
}
```

### Error

```json
{
  "error": {
    "code": "not_found",
    "message": "Vehicle not found"
  },
  "meta": {
    "request_id": "uuid",
    "generated_at": "2026-04-18T21:00:00Z"
  }
}
```

## 1. Realtime Endpoints

### `GET /api/v1/realtime/summary`

Mengembalikan KPI utama command center.

Response:

```json
{
  "data": {
    "active_vehicles": 842,
    "offline_vehicles": 31,
    "high_risk_vehicles": 57,
    "open_incidents": 14,
    "priority_owners": 8,
    "collective_anomalies_today": 5
  }
}
```

### `GET /api/v1/realtime/vehicles`

Mengembalikan marker kendaraan untuk peta.

Query params:

- `route_id`
- `fleet_owner_id`
- `risk_level`
- `status`
- `bbox`

Response:

```json
{
  "data": [
    {
      "vehicle_id": "uuid",
      "plate_number": "B 1234 XYZ",
      "fleet_code": "M01-12",
      "latitude": -6.2,
      "longitude": 106.8,
      "last_seen_at": "2026-04-18T20:59:20Z",
      "status": "online",
      "risk_level": "high",
      "route_id": "uuid",
      "route_code": "M01"
    }
  ]
}
```

### `GET /api/v1/realtime/collective-anomalies`

Mengembalikan collective anomaly aktif untuk peta dan banner.

Response fields:

- `collective_anomaly_id`
- `collective_type`
- `severity`
- `route_id`
- `fleet_owner_id`
- `vehicle_count`
- `detected_at`
- `location`

## 2. Vehicle Endpoints

### `GET /api/v1/vehicles/{vehicle_id}`

Profil detail kendaraan untuk panel saat marker diklik.

Response:

```json
{
  "data": {
    "vehicle_id": "uuid",
    "plate_number": "B 1234 XYZ",
    "fleet_code": "M01-12",
    "photo_url": "https://...",
    "vehicle_status": "active",
    "operational_status": "running",
    "route": {
      "route_id": "uuid",
      "code": "M01",
      "name": "Kampung Melayu - Tanah Abang"
    },
    "owner": {
      "fleet_owner_id": "uuid",
      "name": "Nama Pemilik",
      "address": "Alamat lengkap",
      "contact_phone": "0812xxxx"
    },
    "device": {
      "gps_device_id": "uuid",
      "device_imei": "1234567890",
      "device_model": "Teltonika-01",
      "status": "active"
    },
    "realtime": {
      "status": "online",
      "last_seen_at": "2026-04-18T20:59:20Z",
      "latitude": -6.2,
      "longitude": 106.8,
      "speed_kph": 27.5
    },
    "risk": {
      "current_score": 63.5,
      "risk_level": "high",
      "last_calculated_at": "2026-04-18T20:58:50Z"
    }
  }
}
```

### `GET /api/v1/vehicles/{vehicle_id}/history`

Riwayat anomaly, alert, incident, dan sanction kendaraan.

Query params:

- `from`
- `to`
- `types`
- `limit`

Response sections:

- `anomalies`
- `alerts`
- `incidents`
- `sanctions`

### `GET /api/v1/vehicles/{vehicle_id}/playback`

Mengembalikan jalur perjalanan untuk peta playback.

Query params:

- `from`
- `to`

Response item:

- `time`
- `latitude`
- `longitude`
- `speed_kph`
- `heading_deg`
- `anomaly_flags`

## 3. Owner Intelligence Endpoints

### `GET /api/v1/owners/priority`

Daftar pemilik armada prioritas tinggi.

Query params:

- `from`
- `to`
- `min_risk_level`

Response item:

- `fleet_owner_id`
- `name`
- `active_vehicle_count`
- `high_risk_vehicle_count`
- `avg_risk_score`
- `open_incident_count`
- `active_sanction_count`
- `priority_reason`

### `GET /api/v1/owners/{fleet_owner_id}`

Profil pemilik armada dan ringkasan kepatuhan.

Response:

- identitas pemilik,
- jumlah kendaraan,
- distribusi risk level,
- incident terbuka,
- sanction aktif,
- collective anomalies terkait.

### `GET /api/v1/owners/{fleet_owner_id}/vehicles`

Daftar kendaraan milik pemilik.

Response fields:

- `vehicle_id`
- `plate_number`
- `fleet_code`
- `route_code`
- `risk_level`
- `current_score`
- `last_anomaly_type`
- `last_anomaly_at`

### `GET /api/v1/owners/{fleet_owner_id}/patterns`

Daftar pola pelanggaran terorganisir, kolusi, atau risk propagation.

Response item:

- `fleet_pattern_case_id`
- `case_type`
- `severity`
- `opened_at`
- `status`
- `summary`
- `vehicle_count`

## 4. Alerts and Incidents Endpoints

### `GET /api/v1/alerts`

Daftar alert untuk dashboard.

Query params:

- `severity`
- `status`
- `route_id`
- `fleet_owner_id`
- `vehicle_id`

### `POST /api/v1/alerts/{alert_id}/acknowledge`

Body:

```json
{
  "note": "Sedang diverifikasi operator"
}
```

### `POST /api/v1/alerts/{alert_id}/escalate`

Membuat incident dari alert.

Body:

```json
{
  "incident_type": "organized_violation_review",
  "summary": "Perlu investigasi lanjutan"
}
```

### `GET /api/v1/incidents`

Daftar incident.

### `GET /api/v1/incidents/{incident_id}`

Detail incident, evidence, dan timeline.

### `POST /api/v1/incidents/{incident_id}/resolve`

Body:

```json
{
  "resolution_notes": "Selesai diverifikasi",
  "resolution_type": "closed_after_review"
}
```

## 5. Intelligence Endpoints

### `GET /api/v1/intelligence/collective-anomalies`

Daftar collective anomaly historis dan aktif.

Query params:

- `collective_type`
- `route_id`
- `fleet_owner_id`
- `severity`
- `status`
- `from`
- `to`

### `GET /api/v1/intelligence/collective-anomalies/{id}`

Detail collective anomaly.

Response sections:

- metadata kasus,
- daftar kendaraan terlibat,
- daftar pemilik terkait,
- evidence metrics,
- linked incidents.

### `GET /api/v1/intelligence/outliers/vehicles`

Daftar kendaraan outlier terhadap pola trayek normal.

Response item:

- `vehicle_id`
- `plate_number`
- `route_code`
- `outlier_score`
- `outlier_reason`
- `last_detected_at`

### `GET /api/v1/intelligence/risk-propagation`

Daftar pemilik dengan propagasi risiko tinggi.

Response item:

- `fleet_owner_id`
- `name`
- `high_risk_vehicle_count`
- `avg_risk_score`
- `max_risk_score`
- `propagation_level`

### `GET /api/v1/intelligence/fleet-pattern-cases`

Daftar case:

- `organized_violation`
- `operational_collusion`
- `risk_propagation`

### `GET /api/v1/intelligence/fleet-pattern-cases/{id}`

Detail case investigasi armada.

## 6. Device Fraud Endpoints

### `GET /api/v1/devices/suspicious`

Daftar device paling mencurigakan.

Response item:

- `gps_device_id`
- `device_imei`
- `device_model`
- `fraud_score`
- `latest_event_type`
- `reassignment_count_30d`

### `GET /api/v1/devices/{gps_device_id}`

Detail profil device.

### `GET /api/v1/devices/{gps_device_id}/identity-events`

Riwayat:

- `imei_mismatch`
- `fingerprint_changed`
- `device_reassignment_spike`

### `GET /api/v1/devices/reassignments`

Daftar device yang terlalu sering berpindah kendaraan.

## 7. Network View Endpoints

### `GET /api/v1/network/owners/{fleet_owner_id}`

Mengembalikan graph investigasi untuk satu pemilik.

Response:

```json
{
  "data": {
    "nodes": [
      {
        "id": "owner-1",
        "type": "fleet_owner",
        "label": "Nama Pemilik"
      },
      {
        "id": "vehicle-1",
        "type": "vehicle",
        "label": "B 1234 XYZ"
      }
    ],
    "edges": [
      {
        "source": "owner-1",
        "target": "vehicle-1",
        "type": "owns"
      }
    ]
  }
}
```

### `GET /api/v1/network/vehicles/{vehicle_id}`

Mengembalikan graph investigasi kendaraan.

## 8. Filter Metadata Endpoints

### `GET /api/v1/meta/routes`

Daftar trayek untuk filter UI.

### `GET /api/v1/meta/fleet-owners`

Daftar pemilik armada untuk filter UI.

### `GET /api/v1/meta/enums`

Mengembalikan:

- risk levels,
- anomaly types,
- incident statuses,
- collective anomaly types,
- fleet pattern case types.

## 9. Prioritas Implementasi API

### Fase 1

- `realtime/summary`
- `realtime/vehicles`
- `vehicles/{id}`
- `vehicles/{id}/history`
- `alerts`
- `incidents`

### Fase 2

- `owners/priority`
- `owners/{id}`
- `owners/{id}/patterns`
- `intelligence/collective-anomalies`
- `intelligence/risk-propagation`
- `devices/suspicious`

### Fase 3

- `intelligence/fleet-pattern-cases`
- `network/owners/{id}`
- `network/vehicles/{id}`
- endpoint fraud analytics lanjutan

## Ringkasan

Kontrak API ini disusun agar frontend dapat berkembang bertahap dari dashboard monitoring dasar ke dashboard intelijen armada yang lebih kaya, tanpa harus mengubah struktur dasar respons secara drastis.
