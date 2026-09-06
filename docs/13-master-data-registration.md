# Master Data Registration MVP

Dokumen ini mencatat field registrasi yang benar-benar dipakai oleh MVP saat ini.

## Owner

Endpoint:

- `GET /owners`
- `GET /owners/:id`
- `POST /owners` khusus role `ANALISA`
- `PATCH /owners/:id` khusus role `ANALISA`

Field utama:

- `owner_type`: `PERSONAL`, `COOP`, atau `COMPANY`
- `name`
- `phone_primary`
- `email`
- `base.name`
- `base.lat`
- `base.lon`
- `status`

Catatan: upload dokumen owner belum aktif di MVP karena belum ada storage file real.

## Vehicle

Endpoint:

- `GET /vehicles`
- `GET /vehicles/:id`
- `POST /vehicles` khusus role `ANALISA`
- `PATCH /vehicles/:id` khusus role `ANALISA`

Field utama:

- `owner_id`
- `plate_no`
- `route_id`
- `vehicle_code`
- `status`
- `brand`
- `model`
- `year`
- `color`
- `capacity`

`plate_no` dibuat unik agar telemetry bisa resolve kendaraan lewat plat nomor.

## Route dan Stop

Endpoint:

- `GET /routes`
- `POST /routes` khusus role `ANALISA`
- `PATCH /routes/:id` khusus role `ANALISA`
- `POST /routes/:id/corridor` khusus role `ANALISA`
- `GET /stops`
- `POST /stops` khusus role `ANALISA`
- `PATCH /stops/:id` khusus role `ANALISA`

Field route:

- `route_id`
- `name`
- `color`
- `buffer_radius_m`
- `outbound`
- `inbound`

Field stop:

- `route_id`
- `name`
- `seq`
- `lat`
- `lng`

Seed route `01`, `02`, dan `03` memakai stop berurutan sebagai sumber geometry utama. `outbound_geom` dibentuk dari `seq` naik, sementara `inbound_geom` adalah reverse dari geometry tersebut.

## Device

Endpoint:

- `GET /devices` khusus role `ANALISA`
- `GET /devices/health` khusus role `ANALISA`
- `POST /devices` khusus role `ANALISA`
- `PATCH /devices/:id` khusus role `ANALISA`
- `DELETE /devices/:id` khusus role `ANALISA`

Field utama:

- `device_type`
- `imei_or_serial`
- `provider`
- `status`

`imei_or_serial` unik dan bisa dipakai telemetry ingestion untuk resolve kendaraan melalui assignment aktif.

## Assignment

Endpoint:

- `GET /assignments` khusus role `ANALISA`
- `POST /assignments` khusus role `ANALISA`
- `PATCH /assignments/:id` khusus role `ANALISA`

Field utama:

- `vehicle_id`
- `driver_id`
- `device_id`
- `shift_name`
- `shift_start`
- `shift_end`
- `days_of_week`
- `is_active`

Aturan MVP:

- satu kendaraan hanya punya satu assignment aktif,
- satu device hanya boleh berada di satu assignment aktif,
- membuat assignment aktif baru untuk kendaraan akan menonaktifkan assignment aktif sebelumnya,
- status device berubah menjadi `ASSIGNED` saat assignment aktif dan `AVAILABLE` saat dilepas/nonaktif.

## Telemetry Vehicle Resolution

Endpoint `POST /telemetry/vehicle` bisa resolve kendaraan dari:

1. `vehicle_id`
2. `plate_no`
3. `device_id` atau `imei_or_serial` melalui assignment aktif

Payload telemetry tetap memakai `lat`, `lon`, `speed_kmh`, `heading`, `status`, dan `ts`.
