# 0002. Postgres + PostGIS + TimescaleDB sebagai datastore tunggal

- Status: Accepted
- Tanggal: 2026-07-22 (dokumentasi keputusan yang sudah berjalan)
- Konteks terkait: db, services/api-gateway, services/telemetry-ingestion

## Konteks
Sistem menyimpan data relasional (master data, incident, laporan) dan data time-series GPS volume tinggi, serta butuh query geospasial (koridor rute, geofence, map-matching).

## Keputusan
Gunakan satu PostgreSQL dengan ekstensi PostGIS (geospasial) dan TimescaleDB (hypertable untuk `vehicle_positions`). Redis dipakai untuk rate limit, cache, pub/sub, dan BullMQ. MinIO/S3 untuk evidence/attachment biner. Binary tidak disimpan di Postgres.

## Konsekuensi
- Positif: satu datastore operasional, kompresi TimescaleDB efektif untuk time-series, query geospasial native.
- Negatif: satu titik yang harus di-scale (PgBouncer sudah, read replica belum — lihat issue production-readiness); volume Postgres yang di-reuse rawan schema drift (dimitigasi startup schema-check).

## Alternatif dipertimbangkan
- DB terpisah untuk time-series/metadata ML: belum diperlukan pada skala saat ini.
