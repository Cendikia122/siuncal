# Rencana Database Migration

## Tujuan

Dokumen ini menjabarkan urutan migration database untuk membangun fondasi data sistem monitoring angkot secara bertahap, aman, dan konsisten dengan dokumen arsitektur, ERD, schema, serta dashboard.

## Prinsip Migration

- migration dibagi per domain, bukan satu file besar,
- tabel master dibuat lebih dulu,
- tabel operasional dibuat setelah foreign key inti siap,
- tabel time-series dibuat setelah master kendaraan dan device tersedia,
- index berat dan policy Timescale ditambahkan setelah tabel utama stabil,
- data agregat dan intelligence diletakkan di fase lanjutan.

## Urutan Fase Migration

1. ekstensi database
2. master data inti
3. relasi device dan audit dasar
4. telemetry time-series
5. anomaly, alert, incident, sanction
6. risk score dan agregasi
7. intelligence dan fraud analytics
8. optimasi index, policy, dan view

## Fase 1: Extensions

File yang disarankan:

- `0001_enable_extensions.sql`

Isi:

- `postgis`
- `timescaledb`
- `pgcrypto`

Contoh:

```sql
create extension if not exists postgis;
create extension if not exists timescaledb;
create extension if not exists pgcrypto;
```

## Fase 2: Master Data Inti

File yang disarankan:

- `0002_create_fleet_owners.sql`
- `0003_create_routes.sql`
- `0004_create_vehicles.sql`
- `0005_create_gps_devices.sql`
- `0006_create_route_stops.sql`
- `0007_create_route_segments.sql`
- `0008_create_geofences.sql`
- `0009_create_users.sql`

### Urutan Dependensi

- `fleet_owners` lebih dulu daripada `vehicles`
- `routes` lebih dulu daripada `vehicles`, `route_stops`, `route_segments`, `geofences`
- `vehicles` lebih dulu daripada tabel operasional dan telemetry
- `gps_devices` lebih dulu daripada `device_installations` dan `telemetry_points`

### Constraint yang Disarankan

- `routes.code` unique
- `vehicles.plate_number` unique
- `gps_devices.device_imei` unique
- `fleet_owners.status` check in `('active', 'inactive')`
- `vehicles.vehicle_status` check in `('active', 'maintenance', 'inactive')`

## Fase 3: Device Relations dan Audit Dasar

File yang disarankan:

- `0010_create_device_installations.sql`
- `0011_create_audit_logs.sql`

### Catatan

- `device_installations` harus menyimpan histori pemasangan, bukan hanya relasi aktif saat ini
- status aktif device saat ini bisa diturunkan dari kombinasi `installation_status` dan `removed_at is null`

## Fase 4: Telemetry Time-Series

File yang disarankan:

- `0012_create_telemetry_points.sql`
- `0013_convert_telemetry_to_hypertable.sql`
- `0014_create_trip_summaries.sql`
- `0015_create_daily_vehicle_metrics.sql`

### Catatan Implementasi

- `telemetry_points` dibuat dulu sebagai tabel biasa
- setelah itu diubah menjadi hypertable Timescale
- index utama pada `vehicle_id, time desc` dan `gps_device_id, time desc`
- geography point harus dibentuk pada saat ingestion atau via generated logic yang konsisten

Contoh:

```sql
select create_hypertable('telemetry_points', 'time', if_not_exists => true);
```

## Fase 5: Anomaly dan Penegakan

File yang disarankan:

- `0016_create_anomalies.sql`
- `0017_create_alerts.sql`
- `0018_create_incidents.sql`
- `0019_create_sanctions.sql`

### Catatan

- `anomalies` adalah evidence operasional dasar
- `alerts` harus bisa mereferensikan `anomaly_id`
- `incidents` harus bisa dibuka dari alert
- `sanctions` harus bergantung pada incident

### Enum atau Check Constraints yang Disarankan

- `severity`: `low`, `medium`, `high`, `critical`
- `alert.status`: `open`, `acknowledged`, `closed`
- `incident.status`: `open`, `under_review`, `resolved`, `closed`
- `anomaly.status`: `open`, `acknowledged`, `resolved`, `dismissed`

## Fase 6: Risk Score dan Ringkasan Kepatuhan

File yang disarankan:

- `0020_create_risk_scores.sql`
- `0021_create_risk_score_events.sql`
- `0022_create_owner_compliance_snapshots.sql`

### Catatan

- `risk_scores` dibuat satu row per `vehicle_id`
- `risk_score_events` menyimpan jejak delta skor
- `owner_compliance_snapshots` dipakai untuk dashboard kepatuhan per pemilik

## Fase 7: Intelligence dan Fraud Analytics

File yang disarankan:

- `0023_create_collective_anomalies.sql`
- `0024_create_device_identity_events.sql`
- `0025_create_fleet_pattern_cases.sql`

### Tujuan Tabel

- `collective_anomalies`
  - untuk offline massal, corridor emptying, abnormal clustering
- `device_identity_events`
  - untuk IMEI mismatch, fingerprint change, device reassignment spike
- `fleet_pattern_cases`
  - untuk organized violation, operational collusion, risk propagation

## Fase 8: Index, Policy, View, dan Optimasi

File yang disarankan:

- `0026_add_geospatial_indexes.sql`
- `0027_add_operational_indexes.sql`
- `0028_add_timescale_policies.sql`
- `0029_create_dashboard_views.sql`

### Isi Fase Ini

- `gist(route_segments.path)`
- `gist(route_stops.location)`
- `gist(geofences.area)`
- `gist(telemetry_points.location)`
- index `risk_scores(vehicle_id)`
- index `owner_compliance_snapshots(fleet_owner_id, snapshot_date desc)`
- index `collective_anomalies(route_id, detected_at desc)`
- policy compression dan retention Timescale

Contoh:

```sql
select add_compression_policy('telemetry_points', interval '7 days');
select add_retention_policy('telemetry_points', interval '180 days');
```

## Naming Convention

Format file yang disarankan:

```text
NNNN_short_description.sql
```

Contoh:

- `0004_create_vehicles.sql`
- `0016_create_anomalies.sql`
- `0025_create_fleet_pattern_cases.sql`

## Urutan Deploy Migration

### Lingkungan Lokal

- jalankan semua migration dari awal
- isi seed minimal:
  - trayek
  - pemilik armada
  - kendaraan
  - device
  - user internal

### Lingkungan Staging

- jalankan migration otomatis di awal deployment backend
- seed hanya data referensi yang aman

### Lingkungan Produksi

- migration dijalankan terkontrol
- perubahan index berat sebaiknya dijadwalkan
- retention policy diverifikasi lebih dulu agar tidak menghapus data yang masih diperlukan

## Data Seeding Minimal

File seed yang disarankan:

- `seed_routes.sql`
- `seed_fleet_owners.sql`
- `seed_vehicles.sql`
- `seed_gps_devices.sql`
- `seed_geofences.sql`
- `seed_users.sql`

## Rollback Strategy

Prinsip rollback:

- tabel inti jangan sering di-drop pada rollback produksi,
- rollback lebih aman berupa migration korektif,
- perubahan destructive harus dihindari setelah data produksi masuk.

Pendekatan:

- fase awal boleh rollback penuh di lokal/staging,
- fase produksi gunakan `forward fix`,
- backup wajib sebelum perubahan schema besar.

## Prioritas MVP

Untuk MVP, migration minimum yang wajib selesai:

- extensions
- fleet owners
- routes
- vehicles
- gps devices
- device installations
- telemetry points
- anomalies
- alerts
- incidents
- risk scores
- users
- audit logs

Tabel berikut bisa menyusul di fase lanjutan:

- `owner_compliance_snapshots`
- `collective_anomalies`
- `device_identity_events`
- `fleet_pattern_cases`

## Ringkasan

Rencana migration ini memecah implementasi database ke fase yang jelas sehingga tim bisa membangun sistem dari monitoring dasar menuju intelligence operasional tanpa membuat schema tidak terkendali.
