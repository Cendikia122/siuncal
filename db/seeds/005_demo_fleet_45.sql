-- Expand the deterministic demo fleet to 10 owners and 45 active vehicles.
-- Idempotent: safe to run repeatedly on existing local Docker volumes.

BEGIN;

WITH owner_catalog(owner_no, owner_type, name, phone_primary, email, base_name, base_lat, base_lon) AS (
  VALUES
    (1, 'COOP', 'Koperasi Angkot Merdeka Cipaku', '0251-8320101', 'merdeka-cipaku@example.local', 'Pool Cipaku', -6.635827, 106.815472),
    (2, 'COOP', 'Koperasi Sukasari Bubulak', '0251-8320202', 'sukasari-bubulak@example.local', 'Pool Sukasari', -6.607318, 106.801546),
    (3, 'COOP', 'Koperasi Baranangsiang Bubulak', '0251-8320303', 'baranangsiang-bubulak@example.local', 'Pool Baranangsiang', -6.604274, 106.806157),
    (4, 'PERSONAL', 'Paguyuban Sopir Tajur Raya', '0251-8320404', 'tajur-raya@example.local', 'Pool Tajur', -6.627250, 106.824050),
    (5, 'COOP', 'Koperasi Angkot Sempur Indah', '0251-8320505', 'sempur-indah@example.local', 'Pool Sempur', -6.586800, 106.798500),
    (6, 'PERSONAL', 'Paguyuban Gunung Batu Mandiri', '0251-8320606', 'gunung-batu@example.local', 'Pool Gunung Batu', -6.587600, 106.772000),
    (7, 'COOP', 'Koperasi Terminal Bubulak Sejahtera', '0251-8320707', 'bubulak-sejahtera@example.local', 'Pool Bubulak', -6.569672, 106.754339),
    (8, 'PERSONAL', 'Paguyuban Pasar Anyar Bersatu', '0251-8320808', 'pasar-anyar@example.local', 'Pool Pasar Anyar', -6.591100, 106.792400),
    (9, 'COOP', 'Koperasi Lawang Gintung Amanah', '0251-8320909', 'lawang-gintung@example.local', 'Pool Lawang Gintung', -6.626900, 106.810200),
    (10, 'PERSONAL', 'Paguyuban Sindangbarang Pilar', '0251-8321010', 'sindangbarang-pilar@example.local', 'Pool Sindangbarang', -6.574900, 106.756700)
)
INSERT INTO owners (owner_type, name, phone_primary, email, base_name, base_lat, base_lon, status)
SELECT owner_type, name, phone_primary, email, base_name, base_lat, base_lon, 'VERIFIED'
FROM owner_catalog oc
WHERE NOT EXISTS (
  SELECT 1 FROM owners o WHERE o.name = oc.name
);

WITH owner_catalog(owner_no, name) AS (
  VALUES
    (1, 'Koperasi Angkot Merdeka Cipaku'),
    (2, 'Koperasi Sukasari Bubulak'),
    (3, 'Koperasi Baranangsiang Bubulak'),
    (4, 'Paguyuban Sopir Tajur Raya'),
    (5, 'Koperasi Angkot Sempur Indah'),
    (6, 'Paguyuban Gunung Batu Mandiri'),
    (7, 'Koperasi Terminal Bubulak Sejahtera'),
    (8, 'Paguyuban Pasar Anyar Bersatu'),
    (9, 'Koperasi Lawang Gintung Amanah'),
    (10, 'Paguyuban Sindangbarang Pilar')
),
fleet AS (
  SELECT
    n,
    CASE
      WHEN n <= 15 THEN '01'
      WHEN n <= 30 THEN '02'
      ELSE '03'
    END AS route_id,
    CASE
      WHEN n <= 15 THEN n
      WHEN n <= 30 THEN n - 15
      ELSE n - 30
    END AS route_vehicle_no,
    ((n - 1) % 10) + 1 AS owner_no
  FROM generate_series(1, 45) AS n
),
vehicle_catalog AS (
  SELECT
    oc.name AS owner_name,
    CASE route_id
      WHEN '01' THEN format('F 19%s AK', lpad(route_vehicle_no::text, 2, '0'))
      WHEN '02' THEN format('F 20%s SB', lpad(route_vehicle_no::text, 2, '0'))
      ELSE format('F 30%s BB', lpad(route_vehicle_no::text, 2, '0'))
    END AS plate_no,
    route_id,
    format('%s-DEMO-%s', route_id, lpad(route_vehicle_no::text, 3, '0')) AS vehicle_code,
    CASE route_id
      WHEN '01' THEN 'Hijau-Biru Muda'
      WHEN '02' THEN 'Hijau-Kuning'
      ELSE 'Hijau-Biru'
    END AS color,
    CASE route_vehicle_no % 3
      WHEN 0 THEN 'Daihatsu'
      WHEN 1 THEN 'Suzuki'
      ELSE 'Mitsubishi'
    END AS brand,
    CASE route_vehicle_no % 3
      WHEN 0 THEN 'Gran Max'
      WHEN 1 THEN 'Carry'
      ELSE 'Colt T120SS'
    END AS model,
    2014 + (route_vehicle_no % 9) AS year,
    CASE WHEN route_vehicle_no % 2 = 0 THEN 10 ELSE 12 END AS capacity
  FROM fleet
  JOIN owner_catalog oc ON oc.owner_no = fleet.owner_no
)
INSERT INTO vehicles (owner_id, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity)
SELECT o.owner_id, vc.plate_no, vc.route_id, vc.vehicle_code, 'IN_SERVICE', vc.brand, vc.model, vc.year, vc.color, vc.capacity
FROM vehicle_catalog vc
JOIN owners o ON o.name = vc.owner_name
WHERE NOT EXISTS (
  SELECT 1 FROM vehicles v WHERE v.plate_no = vc.plate_no
);

UPDATE vehicles
SET status = 'IN_SERVICE'
WHERE plate_no ~ '^F (19|20|30)[0-9]{2} (AK|SB|BB)$';

WITH vehicle_catalog AS (
  SELECT
    v.plate_no,
    v.route_id,
    substring(v.plate_no from 'F [0-9]{2}([0-9]{2})')::int AS route_vehicle_no
  FROM vehicles v
  WHERE v.plate_no ~ '^F (19|20|30)[0-9]{2} (AK|SB|BB)$'
),
device_catalog AS (
  SELECT
    plate_no,
    route_id,
    format('8675309%s%s', route_id, lpad(route_vehicle_no::text, 2, '0')) AS imei_or_serial,
    CASE route_vehicle_no % 3
      WHEN 0 THEN 'Indosat'
      WHEN 1 THEN 'Telkomsel'
      ELSE 'XL'
    END AS provider
  FROM vehicle_catalog
)
INSERT INTO devices (device_type, imei_or_serial, provider, status)
SELECT 'GPS_IOT', imei_or_serial, provider, 'ASSIGNED'
FROM device_catalog dc
WHERE NOT EXISTS (
  SELECT 1 FROM devices d WHERE d.imei_or_serial = dc.imei_or_serial
);

WITH missing_drivers AS (
  SELECT v.plate_no
  FROM vehicles v
  WHERE v.plate_no ~ '^F (19|20|30)[0-9]{2} (AK|SB|BB)$'
    AND NOT EXISTS (
      SELECT 1
      FROM assignments a
      WHERE a.vehicle_id = v.vehicle_id
        AND a.is_active = true
    )
)
INSERT INTO drivers (name, phone, sim_no, sim_expiry, status)
SELECT
  'Driver Armada ' || plate_no,
  '081234' || regexp_replace(plate_no, '[^0-9]', '', 'g'),
  'SIM-' || regexp_replace(plate_no, '[^0-9A-Z]', '', 'g'),
  '2028-12-31'::date,
  'ACTIVE'
FROM missing_drivers md
WHERE NOT EXISTS (
  SELECT 1 FROM drivers d WHERE d.sim_no = 'SIM-' || regexp_replace(md.plate_no, '[^0-9A-Z]', '', 'g')
);

WITH assignment_catalog AS (
  SELECT
    v.vehicle_id,
    d.driver_id,
    dev.device_id,
    substring(v.plate_no from 'F [0-9]{2}([0-9]{2})')::int AS route_vehicle_no
  FROM vehicles v
  JOIN devices dev ON dev.imei_or_serial = format(
    '8675309%s%s',
    v.route_id,
    lpad(substring(v.plate_no from 'F [0-9]{2}([0-9]{2})')::text, 2, '0')
  )
  JOIN drivers d ON d.sim_no = 'SIM-' || regexp_replace(v.plate_no, '[^0-9A-Z]', '', 'g')
  WHERE v.plate_no ~ '^F (19|20|30)[0-9]{2} (AK|SB|BB)$'
    AND NOT EXISTS (
      SELECT 1
      FROM assignments a
      WHERE a.vehicle_id = v.vehicle_id
        AND a.is_active = true
    )
)
INSERT INTO assignments (vehicle_id, driver_id, device_id, shift_name, shift_start, shift_end, days_of_week, is_active)
SELECT
  vehicle_id,
  driver_id,
  device_id,
  CASE route_vehicle_no % 3 WHEN 1 THEN 'Pagi' WHEN 2 THEN 'Siang' ELSE 'Sore' END,
  CASE route_vehicle_no % 3 WHEN 1 THEN '05:00'::time WHEN 2 THEN '13:00'::time ELSE '15:00'::time END,
  CASE route_vehicle_no % 3 WHEN 1 THEN '13:00'::time WHEN 2 THEN '21:00'::time ELSE '23:00'::time END,
  ARRAY[1,2,3,4,5,6],
  true
FROM assignment_catalog;

WITH assigned_devices AS (
  SELECT DISTINCT device_id
  FROM assignments
  WHERE is_active = true
)
UPDATE devices d
SET status = 'ASSIGNED'
FROM assigned_devices ad
WHERE ad.device_id = d.device_id;

COMMIT;
