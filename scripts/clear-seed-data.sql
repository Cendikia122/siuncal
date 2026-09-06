-- Script untuk mengosongkan data seed trayek dan armada
-- Jalankan dengan: docker exec -i monitoring-angkot-postgres-1 psql -U monitoring -d Sentra -f - < scripts/clear-seed-data.sql

BEGIN;

-- 1. Hapus data terkait armada
-- Hapus incidents terlebih dahulu (foreign key ke vehicles)
DELETE FROM incident_actions;
DELETE FROM incidents;

-- Hapus telemetry/posisi (vehicle_latest adalah VIEW, jadi hanya hapus vehicle_positions)
DELETE FROM vehicle_positions;

-- Hapus assignments (hubungan vehicle-driver-device)
DELETE FROM assignments;

-- Hapus vehicles
DELETE FROM vehicles;

-- 2. Hapus data terkait trayek
-- Hapus route stops
DELETE FROM route_stops;

-- Hapus geofences
DELETE FROM geofences;

-- Hapus routes
DELETE FROM routes;

-- 3. Hapus master data terkait (opsional - uncomment jika perlu)
-- DELETE FROM drivers;
-- DELETE FROM devices;
-- DELETE FROM owners;

COMMIT;

-- Tampilkan hasil
SELECT 'vehicles' as table_name, COUNT(*) as remaining FROM vehicles
UNION ALL
SELECT 'routes', COUNT(*) FROM routes
UNION ALL
SELECT 'route_stops', COUNT(*) FROM route_stops
UNION ALL
SELECT 'incidents', COUNT(*) FROM incidents
UNION ALL
SELECT 'assignments', COUNT(*) FROM assignments;
