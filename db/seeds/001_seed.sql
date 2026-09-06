BEGIN;

TRUNCATE TABLE
  public_report_reviews,
  playback_records,
  public_report_actions,
  public_report_attachments,
  public_reports,
  passenger_positions,
  passenger_tracking_tokens,
  risk_score_events,
  risk_scores,
  notifications,
  incident_actions,
  alerts,
  anomalies,
  incidents,
  report_rit_daily,
  report_kpi_daily,
  vehicle_positions,
  assignments,
  vehicle_documents,
  devices,
  drivers,
  geofences,
  vehicles,
  route_stops,
  routes,
  audit_logs,
  refresh_tokens,
  owners,
  users
RESTART IDENTITY CASCADE;

INSERT INTO users (email, full_name, password_hash, roles)
VALUES
  ('operator@pemda.go.id', 'Petugas Dishub Kota Bogor', crypt('password123', gen_salt('bf')), ARRAY['OPERATOR']),
  ('analisa@pemda.go.id', 'Analis Operasional Angkot', crypt('password123', gen_salt('bf')), ARRAY['ANALISA']),
  ('admin@pemda.go.id', 'Administrator Dishub', crypt('password123', gen_salt('bf')), ARRAY['ADMIN']),
  ('lapangan@pemda.go.id', 'Petugas Lapangan Bogor', crypt('password123', gen_salt('bf')), ARRAY['PETUGAS_LAPANGAN']),
  ('warga@sentra.id', 'Warga Bogor', crypt('password123', gen_salt('bf')), ARRAY['PUBLIC_USER']),
  ('warga.cipaku@sentra.id', 'Warga Cipaku', crypt('password123', gen_salt('bf')), ARRAY['PUBLIC_USER']),
  ('warga.bubulak@sentra.id', 'Warga Bubulak', crypt('password123', gen_salt('bf')), ARRAY['PUBLIC_USER']),
  ('warga.baranangsiang@sentra.id', 'Warga Baranangsiang', crypt('password123', gen_salt('bf')), ARRAY['PUBLIC_USER']);

INSERT INTO owners (owner_type, name, phone_primary, email, base_name, base_lat, base_lon, status)
VALUES
  ('COOP', 'Koperasi Angkot Merdeka Cipaku', '0251-8320101', NULL, 'Pool Cipaku', -6.635827, 106.815472, 'VERIFIED'),
  ('COOP', 'Koperasi Sukasari Bubulak', '0251-8320202', NULL, 'Pool Sukasari', -6.607318, 106.801546, 'VERIFIED'),
  ('COOP', 'Koperasi Baranangsiang Bubulak', '0251-8320303', NULL, 'Pool Baranangsiang', -6.604274, 106.806157, 'VERIFIED');

WITH route_defs(route_id, name, color, buffer_radius_m) AS (
  VALUES
    ('01', 'Trayek 01 Cipinang Gading - Terminal Merdeka', '#10b981', 90),
    ('02', 'Trayek 02 Sukasari - Terminal Bubulak', '#3b82f6', 90),
    ('03', 'Trayek 03 Baranangsiang - Terminal Bubulak', '#f97316', 90)
),
outbound_points(route_id, seq, name, lon, lat) AS (
  VALUES
    ('01', 1, 'Cipinang Gading', 106.810900, -6.650100),
    ('01', 2, 'Cipaku', 106.815472, -6.635827),
    ('01', 3, 'Lawang Gintung', 106.810200, -6.626900),
    ('01', 4, 'Jl. Pahlawan', 106.805250, -6.619900),
    ('01', 5, 'Empang', 106.803684, -6.615059),
    ('01', 6, 'BTM / Juanda', 106.797900, -6.603900),
    ('01', 7, 'Paledang', 106.792700, -6.596900),
    ('01', 8, 'Stasiun Bogor / Kapten Muslihat', 106.790822, -6.594078),
    ('01', 9, 'Jl. Veteran', 106.783900, -6.591900),
    ('01', 10, 'Perintis Kemerdekaan', 106.785700, -6.587900),
    ('01', 11, 'Terminal Merdeka', 106.787778, -6.589167),

    ('02', 1, 'Sukasari', 106.801546, -6.607318),
    ('02', 2, 'Siliwangi / Lawang Gintung', 106.810200, -6.626900),
    ('02', 3, 'Batutulis', 106.809544, -6.625933),
    ('02', 4, 'Jl. Pahlawan', 106.805250, -6.619900),
    ('02', 5, 'Empang', 106.803684, -6.615059),
    ('02', 6, 'BTM / Juanda', 106.797900, -6.603900),
    ('02', 7, 'Paledang', 106.792700, -6.596900),
    ('02', 8, 'Stasiun Bogor / Kapten Muslihat', 106.790822, -6.594078),
    ('02', 9, 'Jl. Veteran', 106.783900, -6.591900),
    ('02', 10, 'Gunung Batu', 106.772000, -6.587600),
    ('02', 11, 'Sindangbarang', 106.762000, -6.581500),
    ('02', 12, 'Sindangbarang Pilar', 106.756700, -6.574900),
    ('02', 13, 'Jl. R1 Bubulak', 106.754900, -6.571100),
    ('02', 14, 'Terminal Bubulak', 106.754339, -6.569672),

    ('03', 1, 'Terminal Baranangsiang', 106.806157, -6.604274),
    ('03', 2, 'Jl. Bangka', 106.804600, -6.602500),
    ('03', 3, 'Tugu Kujang / Otista', 106.805358, -6.601289),
    ('03', 4, 'BTM / Juanda', 106.797900, -6.603900),
    ('03', 5, 'Stasiun Bogor / Kapten Muslihat', 106.790822, -6.594078),
    ('03', 6, 'Jl. Veteran', 106.783900, -6.591900),
    ('03', 7, 'Gunung Batu', 106.772000, -6.587600),
    ('03', 8, 'Sindangbarang', 106.762000, -6.581500),
    ('03', 9, 'Sindangbarang Pilar', 106.756700, -6.574900),
    ('03', 10, 'Jl. R1 Bubulak', 106.754900, -6.571100),
    ('03', 11, 'Terminal Bubulak', 106.754339, -6.569672)
),
inbound_points(route_id, seq, name, lon, lat) AS (
  VALUES
    ('01', 1, 'Terminal Merdeka', 106.787778, -6.589167),
    ('01', 2, 'Jl. Dr. Semeru', 106.783200, -6.588300),
    ('01', 3, 'Pasar Mawar', 106.789000, -6.590600),
    ('01', 4, 'Jl. MA Salmun', 106.791100, -6.592500),
    ('01', 5, 'Mayor Oking / Stasiun Bogor', 106.790822, -6.594078),
    ('01', 6, 'Dewi Sartika / Pasar Anyar', 106.792400, -6.591100),
    ('01', 7, 'Gedong Sawah', 106.796600, -6.593800),
    ('01', 8, 'Suryakencana / Pasar Bogor', 106.797900, -6.603900),
    ('01', 9, 'Siliwangi', 106.802900, -6.612600),
    ('01', 10, 'Lawang Gintung', 106.810200, -6.626900),
    ('01', 11, 'Cipaku', 106.815472, -6.635827),
    ('01', 12, 'Cipinang Gading', 106.810900, -6.650100),

    ('02', 1, 'Terminal Bubulak', 106.754339, -6.569672),
    ('02', 2, 'Jl. R1 Bubulak', 106.754900, -6.571100),
    ('02', 3, 'Sindangbarang Pilar', 106.756700, -6.574900),
    ('02', 4, 'Sindangbarang', 106.762000, -6.581500),
    ('02', 5, 'Gunung Batu', 106.772000, -6.587600),
    ('02', 6, 'Jl. Veteran', 106.783900, -6.591900),
    ('02', 7, 'Perintis Kemerdekaan', 106.785700, -6.587900),
    ('02', 8, 'Jl. Dr. Semeru', 106.783200, -6.588300),
    ('02', 9, 'Pasar Mawar', 106.789000, -6.590600),
    ('02', 10, 'Mayor Oking / Stasiun Bogor', 106.790822, -6.594078),
    ('02', 11, 'Juanda / Istana Bogor', 106.793800, -6.596900),
    ('02', 12, 'Jalak Harupat / Sempur', 106.798500, -6.586800),
    ('02', 13, 'Pajajaran / Tugu Kujang', 106.805358, -6.601289),
    ('02', 14, 'Otista', 106.802500, -6.603500),
    ('02', 15, 'Surya Kencana / Pasar Bogor', 106.797900, -6.603900),
    ('02', 16, 'Sukasari', 106.801546, -6.607318),

    ('03', 1, 'Terminal Bubulak', 106.754339, -6.569672),
    ('03', 2, 'Jl. R1 Bubulak', 106.754900, -6.571100),
    ('03', 3, 'Sindangbarang Pilar', 106.756700, -6.574900),
    ('03', 4, 'Sindangbarang', 106.762000, -6.581500),
    ('03', 5, 'Gunung Batu', 106.772000, -6.587600),
    ('03', 6, 'Jl. Veteran', 106.783900, -6.591900),
    ('03', 7, 'Perintis Kemerdekaan', 106.785700, -6.587900),
    ('03', 8, 'Jl. Dr. Semeru', 106.783200, -6.588300),
    ('03', 9, 'Pasar Mawar', 106.789000, -6.590600),
    ('03', 10, 'Mayor Oking / Stasiun Bogor', 106.790822, -6.594078),
    ('03', 11, 'Dewi Sartika / Pasar Anyar', 106.792400, -6.591100),
    ('03', 12, 'Gedong Sawah', 106.796600, -6.593800),
    ('03', 13, 'Juanda / Istana Bogor', 106.793800, -6.596900),
    ('03', 14, 'Jalak Harupat / Sempur', 106.798500, -6.586800),
    ('03', 15, 'Pajajaran / Tugu Kujang', 106.805358, -6.601289),
    ('03', 16, 'Terminal Baranangsiang', 106.806157, -6.604274)
),
outbound_lines AS (
  SELECT route_id, ST_MakeLine(ST_SetSRID(ST_MakePoint(lon, lat), 4326) ORDER BY seq) AS geom
  FROM outbound_points
  GROUP BY route_id
),
inbound_lines AS (
  SELECT route_id, ST_MakeLine(ST_SetSRID(ST_MakePoint(lon, lat), 4326) ORDER BY seq) AS geom
  FROM inbound_points
  GROUP BY route_id
)
INSERT INTO routes (route_id, name, color, buffer_radius_m, outbound_geom, inbound_geom)
SELECT
  route_defs.route_id,
  route_defs.name,
  route_defs.color,
  route_defs.buffer_radius_m,
  outbound_lines.geom,
  inbound_lines.geom
FROM route_defs
JOIN outbound_lines ON outbound_lines.route_id = route_defs.route_id
JOIN inbound_lines ON inbound_lines.route_id = route_defs.route_id;

WITH stop_points(route_id, seq, name, lon, lat) AS (
  VALUES
    ('01', 1, 'Cipinang Gading', 106.810900, -6.650100),
    ('01', 2, 'Cipaku', 106.815472, -6.635827),
    ('01', 3, 'Lawang Gintung', 106.810200, -6.626900),
    ('01', 4, 'Empang', 106.803684, -6.615059),
    ('01', 5, 'BTM / Juanda', 106.797900, -6.603900),
    ('01', 6, 'Paledang', 106.792700, -6.596900),
    ('01', 7, 'Stasiun Bogor', 106.790822, -6.594078),
    ('01', 8, 'Pasar Anyar', 106.792400, -6.591100),
    ('01', 9, 'Pasar Mawar', 106.789000, -6.590600),
    ('01', 10, 'Terminal Merdeka', 106.787778, -6.589167),

    ('02', 1, 'Sukasari', 106.801546, -6.607318),
    ('02', 2, 'Lawang Gintung', 106.810200, -6.626900),
    ('02', 3, 'Batutulis', 106.809544, -6.625933),
    ('02', 4, 'Empang', 106.803684, -6.615059),
    ('02', 5, 'Stasiun Bogor', 106.790822, -6.594078),
    ('02', 6, 'Gunung Batu', 106.772000, -6.587600),
    ('02', 7, 'Sindangbarang', 106.762000, -6.581500),
    ('02', 8, 'Sindangbarang Pilar', 106.756700, -6.574900),
    ('02', 9, 'Terminal Bubulak', 106.754339, -6.569672),
    ('02', 10, 'Tugu Kujang', 106.805358, -6.601289),
    ('02', 11, 'Sempur', 106.798500, -6.586800),
    ('02', 12, 'Pasar Bogor / Surya Kencana', 106.797900, -6.603900),

    ('03', 1, 'Terminal Baranangsiang', 106.806157, -6.604274),
    ('03', 2, 'Tugu Kujang', 106.805358, -6.601289),
    ('03', 3, 'BTM / Juanda', 106.797900, -6.603900),
    ('03', 4, 'Stasiun Bogor', 106.790822, -6.594078),
    ('03', 5, 'Gunung Batu', 106.772000, -6.587600),
    ('03', 6, 'Sindangbarang', 106.762000, -6.581500),
    ('03', 7, 'Sindangbarang Pilar', 106.756700, -6.574900),
    ('03', 8, 'Terminal Bubulak', 106.754339, -6.569672),
    ('03', 9, 'Pasar Mawar', 106.789000, -6.590600),
    ('03', 10, 'Pasar Anyar', 106.792400, -6.591100),
    ('03', 11, 'Sempur', 106.798500, -6.586800)
)
INSERT INTO route_stops (route_id, name, seq, geom)
SELECT route_id, name, seq, ST_SetSRID(ST_MakePoint(lon, lat), 4326)
FROM stop_points
ORDER BY route_id, seq;

WITH geofence_points(name, type, route_id, lon, lat, radius_m) AS (
  VALUES
    ('Terminal Merdeka', 'TERMINAL', '01', 106.787778, -6.589167, 140),
    ('Terminal Bubulak - Trayek 02', 'TERMINAL', '02', 106.754339, -6.569672, 180),
    ('Terminal Bubulak - Trayek 03', 'TERMINAL', '03', 106.754339, -6.569672, 180),
    ('Terminal Baranangsiang', 'TERMINAL', '03', 106.806157, -6.604274, 170),
    ('Pool Cipaku', 'BASE', NULL, 106.815472, -6.635827, 100),
    ('Pool Sukasari', 'BASE', NULL, 106.801546, -6.607318, 100),
    ('Pool Baranangsiang', 'BASE', NULL, 106.806157, -6.604274, 100),
    ('Ngetem Stasiun Bogor - 01', 'NGETEM', '01', 106.790822, -6.594078, 120),
    ('Ngetem Stasiun Bogor - 02', 'NGETEM', '02', 106.790822, -6.594078, 120),
    ('Ngetem Stasiun Bogor - 03', 'NGETEM', '03', 106.790822, -6.594078, 120),
    ('Ngetem Tugu Kujang - 02', 'NGETEM', '02', 106.805358, -6.601289, 110),
    ('Ngetem Tugu Kujang - 03', 'NGETEM', '03', 106.805358, -6.601289, 110),
    ('Ngetem Pasar Anyar - 01', 'NGETEM', '01', 106.792400, -6.591100, 110),
    ('Ngetem Pasar Anyar - 03', 'NGETEM', '03', 106.792400, -6.591100, 110),
    ('Ngetem Pasar Mawar - 01', 'NGETEM', '01', 106.789000, -6.590600, 100),
    ('Ngetem Pasar Mawar - 03', 'NGETEM', '03', 106.789000, -6.590600, 100),
    ('Ngetem Pasar Bogor / Surya Kencana - 02', 'NGETEM', '02', 106.797900, -6.603900, 120),
    ('Ngetem Pasar Bogor / Surya Kencana - 03', 'NGETEM', '03', 106.797900, -6.603900, 120),
    ('Ngetem BTM / Juanda - 01', 'NGETEM', '01', 106.797900, -6.603900, 100),
    ('Ngetem BTM / Juanda - 03', 'NGETEM', '03', 106.797900, -6.603900, 100),
    ('Ngetem Sempur - 02', 'NGETEM', '02', 106.798500, -6.586800, 100),
    ('Ngetem Sempur - 03', 'NGETEM', '03', 106.798500, -6.586800, 100)
)
INSERT INTO geofences (name, type, route_id, geom)
SELECT
  name,
  type,
  route_id,
  ST_Buffer(ST_SetSRID(ST_MakePoint(lon, lat), 4326)::geography, radius_m)::geometry
FROM geofence_points;

WITH owner_map AS (
  SELECT owner_id, name FROM owners
)
INSERT INTO vehicles (owner_id, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity)
SELECT
  owner_map.owner_id,
  data.plate_no,
  data.route_id,
  data.vehicle_code,
  data.status,
  data.brand,
  data.model,
  data.year,
  data.color,
  data.capacity
FROM (
  VALUES
    ('Koperasi Angkot Merdeka Cipaku', 'F 1901 AK', '01', '01-MDK-001', 'IN_SERVICE', 'Suzuki', 'Carry', 2017, 'Hijau-Biru Muda', 10),
    ('Koperasi Angkot Merdeka Cipaku', 'F 1902 AK', '01', '01-MDK-002', 'IN_SERVICE', 'Suzuki', 'Carry', 2016, 'Hijau-Biru Muda', 10),
    ('Koperasi Angkot Merdeka Cipaku', 'F 1903 AK', '01', '01-MDK-003', 'IDLE', 'Daihatsu', 'Gran Max', 2018, 'Hijau-Biru Muda', 10),
    ('Koperasi Sukasari Bubulak', 'F 2001 SB', '02', '02-SKB-001', 'IN_SERVICE', 'Mitsubishi', 'Colt T120SS', 2015, 'Hijau-Kuning', 12),
    ('Koperasi Sukasari Bubulak', 'F 2002 SB', '02', '02-SKB-002', 'IN_SERVICE', 'Suzuki', 'Carry', 2017, 'Hijau-Kuning', 10),
    ('Koperasi Sukasari Bubulak', 'F 2003 SB', '02', '02-SKB-003', 'IDLE', 'Daihatsu', 'Gran Max', 2019, 'Hijau-Kuning', 10),
    ('Koperasi Baranangsiang Bubulak', 'F 3001 BB', '03', '03-BRB-001', 'IN_SERVICE', 'Mitsubishi', 'Colt T120SS', 2014, 'Hijau-Biru', 12),
    ('Koperasi Baranangsiang Bubulak', 'F 3002 BB', '03', '03-BRB-002', 'IN_SERVICE', 'Suzuki', 'Carry', 2016, 'Hijau-Biru', 10),
    ('Koperasi Baranangsiang Bubulak', 'F 3003 BB', '03', '03-BRB-003', 'IDLE', 'Daihatsu', 'Gran Max', 2018, 'Hijau-Biru', 10)
) AS data(owner_name, plate_no, route_id, vehicle_code, status, brand, model, year, color, capacity)
JOIN owner_map ON owner_map.name = data.owner_name;

INSERT INTO drivers (name, phone, sim_no, sim_expiry, status)
VALUES
  ('Asep Darmawan', '081234010101', 'SIM-ANGKOT-001', '2027-06-01', 'ACTIVE'),
  ('Dedi Kurnia', '081234010102', 'SIM-ANGKOT-002', '2027-07-01', 'ACTIVE'),
  ('Yusuf Hidayat', '081234010103', 'SIM-ANGKOT-003', '2027-08-01', 'ACTIVE'),
  ('Rudi Hermawan', '081234020101', 'SIM-ANGKOT-004', '2027-09-01', 'ACTIVE'),
  ('Iman Saputra', '081234020102', 'SIM-ANGKOT-005', '2027-10-01', 'ACTIVE'),
  ('Agus Firmansyah', '081234020103', 'SIM-ANGKOT-006', '2027-11-01', 'ACTIVE'),
  ('Rahmat Maulana', '081234030101', 'SIM-ANGKOT-007', '2027-12-01', 'ACTIVE'),
  ('Solehudin', '081234030102', 'SIM-ANGKOT-008', '2028-01-01', 'ACTIVE'),
  ('Nandang Sutisna', '081234030103', 'SIM-ANGKOT-009', '2028-02-01', 'ACTIVE');

INSERT INTO devices (device_type, imei_or_serial, provider, status)
VALUES
  ('GPS_IOT', '86753090101', 'Telkomsel', 'ASSIGNED'),
  ('GPS_IOT', '86753090102', 'Telkomsel', 'ASSIGNED'),
  ('GPS_IOT', '86753090103', 'Indosat', 'ASSIGNED'),
  ('GPS_IOT', '86753090201', 'Telkomsel', 'ASSIGNED'),
  ('GPS_IOT', '86753090202', 'XL', 'ASSIGNED'),
  ('GPS_IOT', '86753090203', 'Indosat', 'ASSIGNED'),
  ('GPS_IOT', '86753090301', 'Telkomsel', 'ASSIGNED'),
  ('GPS_IOT', '86753090302', 'XL', 'ASSIGNED'),
  ('GPS_IOT', '86753090303', 'Indosat', 'ASSIGNED');

WITH assignment_data(plate_no, driver_name, imei_or_serial, shift_name, shift_start, shift_end) AS (
  VALUES
    ('F 1901 AK', 'Asep Darmawan', '86753090101', 'Pagi', '05:00'::time, '13:00'::time),
    ('F 1902 AK', 'Dedi Kurnia', '86753090102', 'Siang', '13:00'::time, '21:00'::time),
    ('F 1903 AK', 'Yusuf Hidayat', '86753090103', 'Cadangan', '09:00'::time, '17:00'::time),
    ('F 2001 SB', 'Rudi Hermawan', '86753090201', 'Pagi', '05:00'::time, '13:00'::time),
    ('F 2002 SB', 'Iman Saputra', '86753090202', 'Siang', '13:00'::time, '21:00'::time),
    ('F 2003 SB', 'Agus Firmansyah', '86753090203', 'Cadangan', '09:00'::time, '17:00'::time),
    ('F 3001 BB', 'Rahmat Maulana', '86753090301', 'Pagi', '05:00'::time, '13:00'::time),
    ('F 3002 BB', 'Solehudin', '86753090302', 'Siang', '13:00'::time, '21:00'::time),
    ('F 3003 BB', 'Nandang Sutisna', '86753090303', 'Cadangan', '09:00'::time, '17:00'::time)
)
INSERT INTO assignments (vehicle_id, driver_id, device_id, shift_name, shift_start, shift_end, days_of_week)
SELECT
  vehicles.vehicle_id,
  drivers.driver_id,
  devices.device_id,
  assignment_data.shift_name,
  assignment_data.shift_start,
  assignment_data.shift_end,
  ARRAY[1,2,3,4,5,6]
FROM assignment_data
JOIN vehicles ON vehicles.plate_no = assignment_data.plate_no
JOIN drivers ON drivers.name = assignment_data.driver_name
JOIN devices ON devices.imei_or_serial = assignment_data.imei_or_serial;

WITH document_data(plate_no, doc_type, file_url, expiry_date) AS (
  VALUES
    ('F 1901 AK', 'STNK', '/docs/stnk-f1901ak.pdf', '2026-12-01'::date),
    ('F 1901 AK', 'KIR', '/docs/kir-f1901ak.pdf', '2026-07-01'::date),
    ('F 2001 SB', 'STNK', '/docs/stnk-f2001sb.pdf', '2026-11-15'::date),
    ('F 3001 BB', 'STNK', '/docs/stnk-f3001bb.pdf', '2026-10-20'::date)
)
INSERT INTO vehicle_documents (vehicle_id, doc_type, file_url, expiry_date)
SELECT vehicles.vehicle_id, document_data.doc_type, document_data.file_url, document_data.expiry_date
FROM document_data
JOIN vehicles ON vehicles.plate_no = document_data.plate_no;

WITH gps_points(plate_no, minutes_ago, lat, lon, speed_kmh, heading, status) AS (
  VALUES
    ('F 1901 AK', 30, -6.650100, 106.810900, 18.0, 345.0, 'IN_SERVICE'),
    ('F 1901 AK', 24, -6.635827, 106.815472, 22.0, 330.0, 'IN_SERVICE'),
    ('F 1901 AK', 18, -6.619900, 106.805250, 24.0, 315.0, 'IN_SERVICE'),
    ('F 1901 AK', 12, -6.603900, 106.797900, 20.0, 300.0, 'IN_SERVICE'),
    ('F 1901 AK', 6, -6.594078, 106.790822, 8.0, 285.0, 'IN_SERVICE'),
    ('F 1901 AK', 1, -6.589167, 106.787778, 0.0, 0.0, 'IDLE'),

    ('F 1902 AK', 30, -6.589167, 106.787778, 12.0, 130.0, 'IN_SERVICE'),
    ('F 1902 AK', 24, -6.590600, 106.789000, 18.0, 115.0, 'IN_SERVICE'),
    ('F 1902 AK', 18, -6.594078, 106.790822, 10.0, 120.0, 'IN_SERVICE'),
    ('F 1902 AK', 12, -6.603900, 106.797900, 20.0, 145.0, 'IN_SERVICE'),
    ('F 1902 AK', 6, -6.626900, 106.810200, 24.0, 160.0, 'IN_SERVICE'),
    ('F 1902 AK', 1, -6.635827, 106.815472, 16.0, 170.0, 'IN_SERVICE'),

    ('F 1903 AK', 30, -6.594078, 106.790822, 0.0, 0.0, 'IDLE'),
    ('F 1903 AK', 24, -6.594078, 106.790822, 0.0, 0.0, 'IDLE'),
    ('F 1903 AK', 18, -6.594078, 106.790822, 0.0, 0.0, 'IDLE'),
    ('F 1903 AK', 12, -6.594078, 106.790822, 0.0, 0.0, 'IDLE'),
    ('F 1903 AK', 6, -6.594078, 106.790822, 0.0, 0.0, 'IDLE'),
    ('F 1903 AK', 1, -6.594078, 106.790822, 0.0, 0.0, 'IDLE'),

    ('F 2001 SB', 30, -6.607318, 106.801546, 15.0, 185.0, 'IN_SERVICE'),
    ('F 2001 SB', 24, -6.626900, 106.810200, 18.0, 210.0, 'IN_SERVICE'),
    ('F 2001 SB', 18, -6.615059, 106.803684, 20.0, 300.0, 'IN_SERVICE'),
    ('F 2001 SB', 12, -6.594078, 106.790822, 24.0, 285.0, 'IN_SERVICE'),
    ('F 2001 SB', 6, -6.587600, 106.772000, 26.0, 270.0, 'IN_SERVICE'),
    ('F 2001 SB', 1, -6.569672, 106.754339, 0.0, 0.0, 'IDLE'),

    ('F 2002 SB', 30, -6.569672, 106.754339, 16.0, 95.0, 'IN_SERVICE'),
    ('F 2002 SB', 24, -6.581500, 106.762000, 22.0, 105.0, 'IN_SERVICE'),
    ('F 2002 SB', 18, -6.591900, 106.783900, 26.0, 85.0, 'IN_SERVICE'),
    ('F 2002 SB', 12, -6.594078, 106.790822, 10.0, 95.0, 'IN_SERVICE'),
    ('F 2002 SB', 6, -6.586800, 106.798500, 19.0, 105.0, 'IN_SERVICE'),
    ('F 2002 SB', 1, -6.601289, 106.805358, 8.0, 165.0, 'IN_SERVICE'),

    ('F 2003 SB', 30, -6.601289, 106.805358, 0.0, 0.0, 'IDLE'),
    ('F 2003 SB', 24, -6.601289, 106.805358, 0.0, 0.0, 'IDLE'),
    ('F 2003 SB', 18, -6.601289, 106.805358, 0.0, 0.0, 'IDLE'),
    ('F 2003 SB', 12, -6.601289, 106.805358, 0.0, 0.0, 'IDLE'),
    ('F 2003 SB', 6, -6.601289, 106.805358, 0.0, 0.0, 'IDLE'),
    ('F 2003 SB', 1, -6.601289, 106.805358, 0.0, 0.0, 'IDLE'),

    ('F 3001 BB', 30, -6.604274, 106.806157, 12.0, 300.0, 'IN_SERVICE'),
    ('F 3001 BB', 24, -6.601289, 106.805358, 14.0, 275.0, 'IN_SERVICE'),
    ('F 3001 BB', 18, -6.603900, 106.797900, 18.0, 285.0, 'IN_SERVICE'),
    ('F 3001 BB', 12, -6.594078, 106.790822, 12.0, 285.0, 'IN_SERVICE'),
    ('F 3001 BB', 6, -6.587600, 106.772000, 24.0, 270.0, 'IN_SERVICE'),
    ('F 3001 BB', 1, -6.569672, 106.754339, 0.0, 0.0, 'IDLE'),

    ('F 3002 BB', 30, -6.569672, 106.754339, 15.0, 95.0, 'IN_SERVICE'),
    ('F 3002 BB', 24, -6.581500, 106.762000, 21.0, 100.0, 'IN_SERVICE'),
    ('F 3002 BB', 18, -6.591900, 106.783900, 23.0, 85.0, 'IN_SERVICE'),
    ('F 3002 BB', 12, -6.590600, 106.789000, 10.0, 85.0, 'IN_SERVICE'),
    ('F 3002 BB', 6, -6.594078, 106.790822, 8.0, 100.0, 'IN_SERVICE'),
    ('F 3002 BB', 1, -6.604274, 106.806157, 0.0, 0.0, 'IDLE'),

    ('F 3003 BB', 30, -6.603900, 106.797900, 0.0, 0.0, 'IDLE'),
    ('F 3003 BB', 24, -6.603900, 106.797900, 0.0, 0.0, 'IDLE'),
    ('F 3003 BB', 18, -6.603900, 106.797900, 0.0, 0.0, 'IDLE'),
    ('F 3003 BB', 12, -6.603900, 106.797900, 0.0, 0.0, 'IDLE'),
    ('F 3003 BB', 6, -6.603900, 106.797900, 0.0, 0.0, 'IDLE'),
    ('F 3003 BB', 1, -6.603900, 106.797900, 0.0, 0.0, 'IDLE')
)
INSERT INTO vehicle_positions (vehicle_id, ts, lat, lon, speed_kmh, heading, status)
SELECT
  vehicles.vehicle_id,
  now() - make_interval(mins => gps_points.minutes_ago),
  gps_points.lat,
  gps_points.lon,
  gps_points.speed_kmh,
  gps_points.heading,
  gps_points.status
FROM gps_points
JOIN vehicles ON vehicles.plate_no = gps_points.plate_no;

WITH incident_data(plate_no, type, severity, status, description, location_desc, lat, lon, minutes_ago) AS (
  VALUES
    ('F 1903 AK', 'NGETEM', 'MEDIUM', 'OPEN', 'Kendaraan berhenti lama di zona Stasiun Bogor.', 'Stasiun Bogor', -6.594078, 106.790822, 18),
    ('F 2003 SB', 'NGETEM', 'MEDIUM', 'OPEN', 'Kendaraan ngetem di sekitar Tugu Kujang saat jam sibuk.', 'Tugu Kujang', -6.601289, 106.805358, 14),
    ('F 3003 BB', 'NGETEM', 'LOW', 'IN_PROGRESS', 'Kendaraan menunggu penumpang di area BTM / Juanda.', 'BTM / Juanda', -6.603900, 106.797900, 10)
),
inserted_incidents AS (
  INSERT INTO incidents (vehicle_id, type, severity, status, description, location_desc, lat, lon, created_at)
  SELECT
    vehicles.vehicle_id,
    incident_data.type,
    incident_data.severity,
    incident_data.status,
    incident_data.description,
    incident_data.location_desc,
    incident_data.lat,
    incident_data.lon,
    now() - make_interval(mins => incident_data.minutes_ago)
  FROM incident_data
  JOIN vehicles ON vehicles.plate_no = incident_data.plate_no
  RETURNING incident_id, vehicle_id, type, severity, status, description, location_desc, lat, lon, created_at
),
inserted_anomalies AS (
  INSERT INTO anomalies (vehicle_id, route_id, rule, severity, status, started_at, last_seen_at, lat, lon, evidence)
  SELECT
    inserted_incidents.vehicle_id,
    vehicles.route_id,
    inserted_incidents.type,
    inserted_incidents.severity,
    CASE WHEN inserted_incidents.status = 'RESOLVED' THEN 'RESOLVED' ELSE 'OPEN' END,
    inserted_incidents.created_at,
    inserted_incidents.created_at,
    inserted_incidents.lat,
    inserted_incidents.lon,
    jsonb_build_object(
      'source', 'seed',
      'location_desc', inserted_incidents.location_desc,
      'description', inserted_incidents.description
    )
  FROM inserted_incidents
  JOIN vehicles ON vehicles.vehicle_id = inserted_incidents.vehicle_id
  RETURNING anomaly_id, vehicle_id, route_id, rule, severity, status, started_at, last_seen_at, evidence
),
inserted_alerts AS (
  INSERT INTO alerts (anomaly_id, vehicle_id, route_id, rule, severity, status, message, opened_at, last_seen_at, evidence)
  SELECT
    anomaly_id,
    vehicle_id,
    route_id,
    rule,
    severity,
    'OPEN',
    concat('Seed alert: ', rule, ' di titik ramai trayek ', route_id),
    started_at,
    last_seen_at,
    evidence
  FROM inserted_anomalies
  RETURNING alert_id, anomaly_id
)
UPDATE incidents
SET alert_id = inserted_alerts.alert_id
FROM inserted_alerts
JOIN anomalies ON anomalies.anomaly_id = inserted_alerts.anomaly_id
WHERE incidents.vehicle_id = anomalies.vehicle_id
  AND incidents.type = anomalies.rule
  AND incidents.created_at = anomalies.started_at;

UPDATE incidents
SET alert_id = alerts.alert_id
FROM alerts
WHERE incidents.alert_id IS NULL
  AND alerts.vehicle_id = incidents.vehicle_id
  AND alerts.rule = incidents.type
  AND abs(extract(epoch FROM (alerts.opened_at - incidents.created_at))) < 1;

WITH incident_map AS (
  SELECT incident_id, type FROM incidents
),
user_map AS (
  SELECT user_id, email FROM users
)
INSERT INTO incident_actions (incident_id, action, actor_id, notes)
SELECT
  incident_map.incident_id,
  'ACKNOWLEDGE',
  user_map.user_id,
  'Operator menandai titik ngetem untuk pemantauan lapangan.'
FROM incident_map
JOIN user_map ON user_map.email = 'operator@pemda.go.id';

WITH incident_map AS (
  SELECT incident_id, type, location_desc FROM incidents
)
INSERT INTO notifications (incident_id, channel, status, payload)
SELECT
  incident_id,
  'DESKTOP',
  'SENT',
  jsonb_build_object('message', concat(type, ' terdeteksi di ', location_desc))
FROM incident_map;

WITH passenger_seed(email, session_id, point_no, seconds_ago, lat, lon, accuracy, app_state) AS (
  VALUES
    ('warga@sentra.id', '10000000-0000-0000-0000-000000000001'::uuid, 1, 150, -6.607318, 106.801546, 9.0, 'FOREGROUND'),
    ('warga@sentra.id', '10000000-0000-0000-0000-000000000001'::uuid, 2, 120, -6.606050, 106.800650, 8.0, 'FOREGROUND'),
    ('warga@sentra.id', '10000000-0000-0000-0000-000000000001'::uuid, 3, 90, -6.604900, 106.799400, 7.0, 'FOREGROUND'),
    ('warga@sentra.id', '10000000-0000-0000-0000-000000000001'::uuid, 4, 60, -6.603900, 106.797900, 8.0, 'BACKGROUND'),
    ('warga@sentra.id', '10000000-0000-0000-0000-000000000001'::uuid, 5, 30, -6.602850, 106.798700, 8.0, 'BACKGROUND'),

    ('warga.cipaku@sentra.id', '10000000-0000-0000-0000-000000000002'::uuid, 1, 150, -6.635827, 106.815472, 10.0, 'FOREGROUND'),
    ('warga.cipaku@sentra.id', '10000000-0000-0000-0000-000000000002'::uuid, 2, 120, -6.632900, 106.813800, 9.0, 'FOREGROUND'),
    ('warga.cipaku@sentra.id', '10000000-0000-0000-0000-000000000002'::uuid, 3, 90, -6.629700, 106.811600, 9.0, 'FOREGROUND'),
    ('warga.cipaku@sentra.id', '10000000-0000-0000-0000-000000000002'::uuid, 4, 60, -6.626900, 106.810200, 8.0, 'BACKGROUND'),
    ('warga.cipaku@sentra.id', '10000000-0000-0000-0000-000000000002'::uuid, 5, 30, -6.623900, 106.807950, 8.0, 'BACKGROUND'),

    ('warga.bubulak@sentra.id', '10000000-0000-0000-0000-000000000003'::uuid, 1, 150, -6.569672, 106.754339, 11.0, 'FOREGROUND'),
    ('warga.bubulak@sentra.id', '10000000-0000-0000-0000-000000000003'::uuid, 2, 120, -6.571100, 106.754900, 10.0, 'FOREGROUND'),
    ('warga.bubulak@sentra.id', '10000000-0000-0000-0000-000000000003'::uuid, 3, 90, -6.574900, 106.756700, 9.0, 'FOREGROUND'),
    ('warga.bubulak@sentra.id', '10000000-0000-0000-0000-000000000003'::uuid, 4, 60, -6.581500, 106.762000, 9.0, 'BACKGROUND'),
    ('warga.bubulak@sentra.id', '10000000-0000-0000-0000-000000000003'::uuid, 5, 30, -6.587600, 106.772000, 8.0, 'BACKGROUND'),

    ('warga.baranangsiang@sentra.id', '10000000-0000-0000-0000-000000000004'::uuid, 1, 150, -6.604274, 106.806157, 9.0, 'FOREGROUND'),
    ('warga.baranangsiang@sentra.id', '10000000-0000-0000-0000-000000000004'::uuid, 2, 120, -6.602500, 106.804600, 8.0, 'FOREGROUND'),
    ('warga.baranangsiang@sentra.id', '10000000-0000-0000-0000-000000000004'::uuid, 3, 90, -6.601289, 106.805358, 8.0, 'FOREGROUND'),
    ('warga.baranangsiang@sentra.id', '10000000-0000-0000-0000-000000000004'::uuid, 4, 60, -6.603900, 106.797900, 7.0, 'BACKGROUND'),
    ('warga.baranangsiang@sentra.id', '10000000-0000-0000-0000-000000000004'::uuid, 5, 30, -6.596900, 106.792700, 8.0, 'BACKGROUND')
)
INSERT INTO passenger_positions (user_id, session_id, ts, lat, lon, accuracy, battery_level, app_state)
SELECT
  users.user_id,
  passenger_seed.session_id,
  now() - make_interval(secs => passenger_seed.seconds_ago),
  passenger_seed.lat,
  passenger_seed.lon,
  passenger_seed.accuracy,
  0.84 - (passenger_seed.point_no * 0.01),
  passenger_seed.app_state
FROM passenger_seed
JOIN users ON users.email = passenger_seed.email;

INSERT INTO report_kpi_daily (report_date, route_id, on_route_pct, avg_latency_sec, incident_count, avg_speed_kmh, avg_rit, avg_idle_sec)
VALUES
  (CURRENT_DATE - INTERVAL '1 day', '01', 94.8, 6, 1, 21.4, 8.6, 310),
  (CURRENT_DATE - INTERVAL '1 day', '02', 93.2, 7, 1, 22.1, 8.1, 340),
  (CURRENT_DATE - INTERVAL '1 day', '03', 92.6, 7, 1, 21.8, 7.9, 360),
  (CURRENT_DATE, '01', 95.1, 5, 1, 22.0, 4.2, 290),
  (CURRENT_DATE, '02', 93.9, 6, 1, 22.5, 4.0, 320),
  (CURRENT_DATE, '03', 92.9, 7, 1, 21.9, 3.8, 350);

WITH rit_data(plate_no, total_rit) AS (
  VALUES
    ('F 1901 AK', 9),
    ('F 1902 AK', 8),
    ('F 1903 AK', 4),
    ('F 2001 SB', 8),
    ('F 2002 SB', 7),
    ('F 2003 SB', 3),
    ('F 3001 BB', 7),
    ('F 3002 BB', 7),
    ('F 3003 BB', 3)
)
INSERT INTO report_rit_daily (report_date, vehicle_id, total_rit)
SELECT CURRENT_DATE - INTERVAL '1 day', vehicles.vehicle_id, rit_data.total_rit
FROM rit_data
JOIN vehicles ON vehicles.plate_no = rit_data.plate_no;

INSERT INTO risk_score_events (vehicle_id, anomaly_id, event_type, rule, severity, delta, previous_score, new_score, metadata, created_at)
SELECT
  anomalies.vehicle_id,
  anomalies.anomaly_id,
  'ANOMALY',
  anomalies.rule,
  anomalies.severity,
  CASE anomalies.severity
    WHEN 'CRITICAL' THEN 25
    WHEN 'HIGH' THEN 16
    WHEN 'MEDIUM' THEN 8
    ELSE 4
  END,
  0,
  CASE anomalies.severity
    WHEN 'CRITICAL' THEN 25
    WHEN 'HIGH' THEN 16
    WHEN 'MEDIUM' THEN 8
    ELSE 4
  END,
  jsonb_build_object('source', 'seed'),
  anomalies.started_at
FROM anomalies;

INSERT INTO risk_scores (vehicle_id, current_score, risk_level, last_anomaly_at, last_decay_at, last_high_critical_at, updated_at)
SELECT
  vehicles.vehicle_id,
  COALESCE(MAX(risk_score_events.new_score), 0),
  CASE
    WHEN COALESCE(MAX(risk_score_events.new_score), 0) >= 70 THEN 'CRITICAL'
    WHEN COALESCE(MAX(risk_score_events.new_score), 0) >= 40 THEN 'HIGH'
    WHEN COALESCE(MAX(risk_score_events.new_score), 0) >= 20 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  MAX(anomalies.started_at),
  now(),
  MAX(anomalies.started_at) FILTER (WHERE anomalies.severity IN ('HIGH', 'CRITICAL')),
  now()
FROM vehicles
LEFT JOIN anomalies ON anomalies.vehicle_id = vehicles.vehicle_id
LEFT JOIN risk_score_events ON risk_score_events.vehicle_id = vehicles.vehicle_id
GROUP BY vehicles.vehicle_id;

COMMIT;
