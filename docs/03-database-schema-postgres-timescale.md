# Desain Schema PostgreSQL, PostGIS, dan TimescaleDB

## Tujuan

Dokumen ini menjabarkan rancangan schema teknis untuk implementasi data layer sistem monitoring angkot menggunakan `PostgreSQL`, `PostGIS`, dan `TimescaleDB`.

## Prinsip Implementasi

- `PostgreSQL` menjadi sistem pencatatan utama.
- `PostGIS` dipakai untuk route corridor, stop, dan geofence.
- `TimescaleDB` dipakai untuk telemetry ber-volume tinggi.
- `Redis` tidak dibahas detail di dokumen ini karena bukan source of truth.

## Konvensi Umum

- Primary key: `uuid`
- Timestamp: `timestamptz`
- Status terbatas: `text` + check constraint atau `enum` bila domain benar-benar stabil
- Audit fields standar:
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()`
  - `created_by uuid null`
  - `updated_by uuid null`

## Ekstensi yang Dibutuhkan

```sql
create extension if not exists postgis;
create extension if not exists timescaledb;
create extension if not exists pgcrypto;
```

## Tabel Master Data

### `fleet_owners`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `name` | `text` | nama pemilik armada |
| `address` | `text` | alamat domisili pemilik |
| `code` | `text` | kode unik opsional |
| `contact_phone` | `text` | kontak utama |
| `status` | `text` | `active`, `inactive` |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### `routes`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `code` | `text` | unik |
| `name` | `text` | nama trayek |
| `direction_a_name` | `text` | arah pertama |
| `direction_b_name` | `text` | arah balik |
| `status` | `text` | aktif/nonaktif |
| `corridor_tolerance_meters` | `integer` | toleransi keluar trayek |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### `vehicles`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `fleet_owner_id` | `uuid` | FK `fleet_owners.id` |
| `route_id` | `uuid` | FK `routes.id` |
| `plate_number` | `text` | unik |
| `fleet_code` | `text` | kode armada internal |
| `photo_url` | `text` | lokasi foto kendaraan |
| `vehicle_status` | `text` | `active`, `maintenance`, `inactive` |
| `operational_status` | `text` | snapshot bisnis, bukan real-time cache |
| `year_of_make` | `integer` | opsional |
| `notes` | `text` | opsional |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### `gps_devices`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `device_imei` | `text` | unik |
| `device_model` | `text` | |
| `firmware_version` | `text` | opsional |
| `sim_number` | `text` | opsional |
| `status` | `text` | aktif/nonaktif/rusak |
| `last_seen_at` | `timestamptz` | info administratif |
| `created_at` | `timestamptz` | default now |
| `updated_at` | `timestamptz` | default now |

### `route_stops`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `route_id` | `uuid` | FK `routes.id` |
| `name` | `text` | |
| `sequence_no` | `integer` | urutan stop |
| `location` | `geography(Point, 4326)` | titik resmi |
| `radius_meters` | `integer` | toleransi kedatangan |
| `is_terminal` | `boolean` | default false |

### `route_segments`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `route_id` | `uuid` | FK `routes.id` |
| `segment_name` | `text` | opsional |
| `sequence_no` | `integer` | urutan segment |
| `path` | `geography(LineString, 4326)` | koridor jalur |
| `speed_limit_kph` | `numeric(5,2)` | opsional |

### `geofences`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `route_id` | `uuid` | nullable bila global |
| `name` | `text` | |
| `geofence_type` | `text` | `terminal`, `allowed_stop`, `restricted_area`, `pool` |
| `area` | `geography(Polygon, 4326)` | area geofence |
| `is_official_stop_zone` | `boolean` | default false |
| `is_active` | `boolean` | default true |

## Tabel Relasi Operasional

### `device_installations`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `vehicle_id` | `uuid` | FK |
| `gps_device_id` | `uuid` | FK |
| `installed_at` | `timestamptz` | |
| `removed_at` | `timestamptz` | nullable |
| `installation_status` | `text` | aktif/dilepas |

## Tabel Telemetry dan Turunannya

### `telemetry_points`

Tabel ini harus menjadi `hypertable`.

| Kolom | Tipe | Catatan |
|---|---|---|
| `time` | `timestamptz` | dimensi waktu hypertable |
| `vehicle_id` | `uuid` | FK |
| `gps_device_id` | `uuid` | FK |
| `latitude` | `double precision` | |
| `longitude` | `double precision` | |
| `location` | `geography(Point, 4326)` | hasil normalisasi |
| `speed_kph` | `numeric(6,2)` | |
| `heading_deg` | `numeric(6,2)` | |
| `altitude_m` | `numeric(8,2)` | opsional |
| `ignition_on` | `boolean` | opsional |
| `battery_voltage` | `numeric(6,2)` | opsional |
| `power_connected` | `boolean` | opsional |
| `satellite_count` | `integer` | opsional |
| `signal_strength` | `integer` | opsional |
| `raw_payload` | `jsonb` | bukti mentah |
| `ingested_at` | `timestamptz` | default now |

Rekomendasi:

- chunk interval awal: `1 hari`
- compression setelah `7 hari`
- retention raw: `180 hari` untuk pilot, bisa diperpanjang sesuai kebijakan

### `trip_summaries`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `vehicle_id` | `uuid` | FK |
| `route_id` | `uuid` | FK |
| `trip_date` | `date` | partisi logis |
| `started_at` | `timestamptz` | |
| `ended_at` | `timestamptz` | |
| `start_location` | `geography(Point, 4326)` | |
| `end_location` | `geography(Point, 4326)` | |
| `distance_km` | `numeric(8,2)` | |
| `duration_minutes` | `integer` | |
| `stopped_minutes` | `integer` | |
| `route_compliance_pct` | `numeric(5,2)` | |
| `anomaly_count` | `integer` | |
| `risk_delta` | `numeric(8,2)` | total perubahan skor |
| `summary_json` | `jsonb` | detail turunan |

### `daily_vehicle_metrics`

| Kolom | Tipe | Catatan |
|---|---|---|
| `metric_date` | `date` | PK komposit |
| `vehicle_id` | `uuid` | PK komposit |
| `route_id` | `uuid` | FK |
| `total_distance_km` | `numeric(10,2)` | |
| `total_trips` | `integer` | |
| `total_alerts` | `integer` | |
| `out_of_route_count` | `integer` | |
| `idling_outside_zone_minutes` | `integer` | |
| `offline_incidents` | `integer` | |
| `avg_speed_kph` | `numeric(6,2)` | |

## Tabel Anomaly dan Penegakan

### `anomalies`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `vehicle_id` | `uuid` | FK |
| `gps_device_id` | `uuid` | FK nullable |
| `route_id` | `uuid` | FK nullable |
| `anomaly_type` | `text` | jenis anomaly |
| `severity` | `text` | `low`, `medium`, `high`, `critical` |
| `detected_at` | `timestamptz` | waktu deteksi |
| `window_started_at` | `timestamptz` | awal evaluasi |
| `window_ended_at` | `timestamptz` | akhir evaluasi |
| `location` | `geography(Point, 4326)` | lokasi utama |
| `score_impact` | `numeric(8,2)` | delta skor |
| `evidence_json` | `jsonb` | evidence detail |
| `status` | `text` | `open`, `acknowledged`, `resolved`, `dismissed` |

### `alerts`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `anomaly_id` | `uuid` | FK nullable |
| `vehicle_id` | `uuid` | FK |
| `alert_type` | `text` | |
| `severity` | `text` | |
| `title` | `text` | |
| `description` | `text` | |
| `triggered_at` | `timestamptz` | |
| `acknowledged_at` | `timestamptz` | nullable |
| `acknowledged_by` | `uuid` | nullable |
| `status` | `text` | `open`, `acknowledged`, `closed` |

### `incidents`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `vehicle_id` | `uuid` | FK |
| `incident_type` | `text` | |
| `opened_at` | `timestamptz` | |
| `closed_at` | `timestamptz` | nullable |
| `status` | `text` | `open`, `under_review`, `resolved`, `closed` |
| `source_alert_id` | `uuid` | FK nullable |
| `summary` | `text` | |
| `resolution_notes` | `text` | nullable |

### `sanctions`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `incident_id` | `uuid` | FK |
| `sanction_type` | `text` | teguran, denda, pembinaan, dll |
| `issued_at` | `timestamptz` | |
| `effective_from` | `date` | |
| `effective_until` | `date` | nullable |
| `status` | `text` | aktif, selesai, dibatalkan |
| `notes` | `text` | |

### `risk_scores`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `vehicle_id` | `uuid` | FK `vehicles.id`, unik |
| `current_score` | `numeric(8,2)` | |
| `risk_level` | `text` | `low`, `medium`, `high`, `critical` |
| `last_calculated_at` | `timestamptz` | |
| `score_version` | `text` | versi formula |

### `risk_score_events`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `risk_score_id` | `uuid` | FK |
| `anomaly_id` | `uuid` | FK nullable |
| `event_time` | `timestamptz` | |
| `delta` | `numeric(8,2)` | perubahan skor |
| `result_score` | `numeric(8,2)` | skor setelah perubahan |
| `reason` | `text` | |
| `metadata_json` | `jsonb` | |

### `owner_compliance_snapshots`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `fleet_owner_id` | `uuid` | FK `fleet_owners.id` |
| `snapshot_date` | `date` | periode snapshot |
| `active_vehicle_count` | `integer` | |
| `high_risk_vehicle_count` | `integer` | |
| `total_anomaly_count` | `integer` | |
| `open_incident_count` | `integer` | |
| `avg_risk_score` | `numeric(8,2)` | |
| `max_risk_score` | `numeric(8,2)` | |
| `summary_json` | `jsonb` | detail agregat |

### `collective_anomalies`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `collective_type` | `text` | `mass_offline`, `corridor_emptying`, `abnormal_clustering`, dll |
| `route_id` | `uuid` | FK nullable |
| `fleet_owner_id` | `uuid` | FK nullable |
| `detected_at` | `timestamptz` | |
| `window_started_at` | `timestamptz` | |
| `window_ended_at` | `timestamptz` | |
| `severity` | `text` | |
| `vehicle_count` | `integer` | jumlah kendaraan terlibat |
| `location` | `geography(Point, 4326)` | titik utama bila relevan |
| `evidence_json` | `jsonb` | daftar kendaraan, metrik, dan bukti |
| `status` | `text` | `open`, `acknowledged`, `resolved`, `dismissed` |

### `device_identity_events`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `gps_device_id` | `uuid` | FK `gps_devices.id` |
| `vehicle_id` | `uuid` | FK nullable |
| `event_time` | `timestamptz` | |
| `event_type` | `text` | `imei_mismatch`, `device_reassignment_spike`, `fingerprint_changed`, dll |
| `severity` | `text` | |
| `evidence_json` | `jsonb` | bukti fingerprint, IMEI, histori perpindahan |

### `fleet_pattern_cases`

| Kolom | Tipe | Catatan |
|---|---|---|
| `id` | `uuid` | PK |
| `fleet_owner_id` | `uuid` | FK `fleet_owners.id` |
| `case_type` | `text` | `organized_violation`, `operational_collusion`, `risk_propagation` |
| `opened_at` | `timestamptz` | |
| `closed_at` | `timestamptz` | nullable |
| `severity` | `text` | |
| `status` | `text` | `open`, `under_review`, `resolved`, `closed` |
| `summary` | `text` | |
| `evidence_json` | `jsonb` | kendaraan terlibat, skor, dan anomali pendukung |

## Tabel Akses dan Audit

### `users`

- `id uuid`
- `full_name text`
- `email text unique`
- `password_hash text`
- `status text`
- `last_login_at timestamptz`

### `audit_logs`

- `id uuid`
- `actor_user_id uuid null`
- `entity_type text`
- `entity_id uuid null`
- `action text`
- `before_json jsonb`
- `after_json jsonb`
- `metadata_json jsonb`
- `created_at timestamptz`

## Strategi Index

### B-Tree

- `vehicles(plate_number)`
- `vehicles(fleet_owner_id, route_id)`
- `routes(code)`
- `gps_devices(device_imei)`
- `alerts(status, severity, triggered_at desc)`
- `incidents(status, opened_at desc)`
- `risk_scores(vehicle_id)`
- `fleet_owners(name)`
- `owner_compliance_snapshots(fleet_owner_id, snapshot_date desc)`
- `collective_anomalies(route_id, detected_at desc)`
- `collective_anomalies(fleet_owner_id, detected_at desc)`
- `device_identity_events(gps_device_id, event_time desc)`
- `fleet_pattern_cases(fleet_owner_id, opened_at desc)`

### Geospatial

- `gist(route_segments.path)`
- `gist(route_stops.location)`
- `gist(geofences.area)`
- `gist(telemetry_points.location)`

### Time-Series

- `telemetry_points(vehicle_id, time desc)`
- `telemetry_points(gps_device_id, time desc)`
- `anomalies(vehicle_id, detected_at desc)`
- `trip_summaries(vehicle_id, started_at desc)`

## Partitioning, Compression, dan Retention

### `telemetry_points`

Rekomendasi Timescale:

```sql
select create_hypertable('telemetry_points', 'time', if_not_exists => true);
select add_compression_policy('telemetry_points', interval '7 days');
select add_retention_policy('telemetry_points', interval '180 days');
```

Jika skala kota besar, pertimbangkan space partition tambahan berdasarkan hash `vehicle_id`.

### `trip_summaries`

- partisi bulanan opsional,
- retensi jangka panjang lebih lama daripada raw telemetry.

### `daily_vehicle_metrics`

- bisa direbuild dari telemetry, tetapi lebih efisien disimpan sebagai tabel agregat harian.

## Query Penting

### 1. Last Known Position

```sql
select distinct on (vehicle_id)
  vehicle_id,
  time,
  latitude,
  longitude,
  speed_kph,
  ignition_on
from telemetry_points
order by vehicle_id, time desc;
```

### 2. Kendaraan Keluar Trayek

```sql
select
  t.vehicle_id,
  t.time,
  t.location
from telemetry_points t
join vehicles v on v.id = t.vehicle_id
join routes r on r.id = v.route_id
where not exists (
  select 1
  from route_segments rs
  where rs.route_id = r.id
    and st_dwithin(t.location, rs.path, r.corridor_tolerance_meters)
);
```

### 3. Ngetem Lebih dari 10 Menit di Luar Zona Resmi

```sql
with slow_points as (
  select
    vehicle_id,
    time,
    location,
    speed_kph
  from telemetry_points
  where speed_kph <= 3
),
outside_zone as (
  select sp.*
  from slow_points sp
  where not exists (
    select 1
    from geofences g
    where g.is_official_stop_zone = true
      and st_contains(g.area::geometry, sp.location::geometry)
  )
)
select vehicle_id, min(time) as start_time, max(time) as end_time
from outside_zone
group by vehicle_id, date_trunc('10 minutes', time)
having max(time) - min(time) >= interval '10 minutes';
```

### 4. Playback Perjalanan

```sql
select
  time,
  latitude,
  longitude,
  speed_kph,
  heading_deg
from telemetry_points
where vehicle_id = $1
  and time between $2 and $3
order by time asc;
```

### 5. Top Risk Vehicles

```sql
select
  rs.vehicle_id,
  rs.current_score,
  rs.risk_level
from risk_scores rs
order by rs.current_score desc
limit 20;
```

### 6. Profil Kendaraan untuk Popup Peta

```sql
select
  v.id as vehicle_id,
  v.plate_number,
  v.fleet_code,
  v.photo_url,
  v.vehicle_status,
  r.code as route_code,
  r.name as route_name,
  fo.name as owner_name,
  fo.address as owner_address,
  gd.device_imei,
  rs.current_score,
  rs.risk_level
from vehicles v
join fleet_owners fo on fo.id = v.fleet_owner_id
join routes r on r.id = v.route_id
left join device_installations di
  on di.vehicle_id = v.id
 and di.installation_status = 'aktif'
 and di.removed_at is null
left join gps_devices gd on gd.id = di.gps_device_id
left join risk_scores rs on rs.vehicle_id = v.id
where v.id = $1;
```

### 7. Pemilik dengan Risk Propagation Tinggi

```sql
select
  fo.id as fleet_owner_id,
  fo.name,
  count(*) filter (where rs.risk_level in ('high', 'critical')) as high_risk_vehicle_count,
  avg(rs.current_score) as avg_risk_score,
  max(rs.current_score) as max_risk_score
from fleet_owners fo
join vehicles v on v.fleet_owner_id = fo.id
left join risk_scores rs on rs.vehicle_id = v.id
group by fo.id, fo.name
having count(*) filter (where rs.risk_level in ('high', 'critical')) >= 2
order by high_risk_vehicle_count desc, avg_risk_score desc;
```

### 8. Trayek dengan Offline Kolektif

```sql
select
  v.route_id,
  count(distinct a.vehicle_id) as affected_vehicle_count,
  min(a.detected_at) as first_detected_at,
  max(a.detected_at) as last_detected_at
from anomalies a
join vehicles v on v.id = a.vehicle_id
where a.anomaly_type = 'device_offline'
  and a.detected_at >= now() - interval '10 minutes'
group by v.route_id
having count(distinct a.vehicle_id) >= 5
order by affected_vehicle_count desc;
```

### 9. Device yang Sering Berpindah Kendaraan

```sql
select
  gps_device_id,
  count(distinct vehicle_id) as vehicle_count,
  min(installed_at) as first_installation,
  max(installed_at) as last_installation
from device_installations
group by gps_device_id
having count(distinct vehicle_id) >= 3
order by vehicle_count desc, last_installation desc;
```

## Catatan Implementasi

- Simpan `raw_payload` untuk audit dan debugging parser.
- Hindari query dashboard real-time langsung ke agregasi berat di TimescaleDB bila snapshot dapat disajikan dari Redis.
- Gunakan materialized view atau continuous aggregate untuk ringkasan berkala.

## Ringkasan

Schema ini menggabungkan data relasional, geospasial, dan time-series dalam satu landasan yang cukup kuat untuk MVP serta masih rasional dioperasikan oleh tim kecil.
