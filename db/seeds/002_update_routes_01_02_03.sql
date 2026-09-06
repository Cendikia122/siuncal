BEGIN;

-- Deprecated compatibility seed.
--
-- Route 01/02/03 geometries are now rebuilt deterministically in
-- db/seeds/001_seed.sql, including outbound/inbound route geometry, stops,
-- ngetem geofences, and moving vehicle positions.

COMMIT;
