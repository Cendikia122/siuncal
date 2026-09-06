ALTER TABLE vehicles
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS capacity integer;

ALTER TABLE incidents
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES users(user_id),
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE TABLE IF NOT EXISTS vehicle_documents (
  document_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  file_url text,
  expiry_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS drivers (
  driver_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  sim_no text,
  sim_expiry date,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS devices (
  device_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_type text NOT NULL,
  imei_or_serial text UNIQUE NOT NULL,
  provider text,
  status text NOT NULL DEFAULT 'ACTIVE',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assignments (
  assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES vehicles(vehicle_id) ON DELETE CASCADE,
  driver_id uuid REFERENCES drivers(driver_id),
  device_id uuid REFERENCES devices(device_id),
  shift_name text,
  shift_start time,
  shift_end time,
  days_of_week int[] DEFAULT ARRAY[1,2,3,4,5,6,0],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS geofences (
  geofence_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL,
  route_id text REFERENCES routes(route_id),
  geom geometry(Polygon, 4326),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_geofences_geom ON geofences USING GIST (geom);

CREATE TABLE IF NOT EXISTS incident_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES users(user_id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifications (
  notification_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
