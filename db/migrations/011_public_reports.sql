CREATE TABLE IF NOT EXISTS public_reports (
  public_report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  vehicle_id uuid REFERENCES vehicles(vehicle_id) ON DELETE SET NULL,
  incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  plate_no text NOT NULL,
  category text NOT NULL,
  status text NOT NULL DEFAULT 'PENDING_REVIEW',
  plate_match_status text NOT NULL DEFAULT 'UNMATCHED_PLATE',
  description text NOT NULL,
  lat double precision NOT NULL,
  lon double precision NOT NULL,
  accuracy_m numeric,
  reported_at timestamptz NOT NULL,
  vehicle_last_lat double precision,
  vehicle_last_lon double precision,
  vehicle_last_seen_at timestamptz,
  distance_to_vehicle_m numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES users(user_id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_notes text,
  CONSTRAINT public_reports_plate_no_not_blank CHECK (btrim(plate_no) <> ''),
  CONSTRAINT public_reports_description_not_blank CHECK (btrim(description) <> ''),
  CONSTRAINT public_reports_category_check CHECK (category IN ('NGETEM', 'RECKLESS_DRIVING', 'SECURITY', 'SERVICE', 'OTHER')),
  CONSTRAINT public_reports_status_check CHECK (status IN ('PENDING_REVIEW', 'ACKNOWLEDGED', 'REJECTED', 'ESCALATED_TO_INCIDENT', 'RESOLVED')),
  CONSTRAINT public_reports_plate_match_status_check CHECK (plate_match_status IN ('MATCHED_VEHICLE', 'UNMATCHED_PLATE', 'MULTIPLE_MATCH_CANDIDATES')),
  CONSTRAINT public_reports_lat_range CHECK (lat BETWEEN -90 AND 90),
  CONSTRAINT public_reports_lon_range CHECK (lon BETWEEN -180 AND 180)
);

CREATE TABLE IF NOT EXISTS public_report_attachments (
  attachment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_report_id uuid NOT NULL REFERENCES public_reports(public_report_id) ON DELETE CASCADE,
  bucket text NOT NULL,
  object_key text NOT NULL,
  content_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  checksum_sha256 text,
  original_filename text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_report_attachments_bucket_not_blank CHECK (btrim(bucket) <> ''),
  CONSTRAINT public_report_attachments_object_key_not_blank CHECK (btrim(object_key) <> ''),
  CONSTRAINT public_report_attachments_content_type_check CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT public_report_attachments_file_size_positive CHECK (file_size_bytes > 0)
);

CREATE TABLE IF NOT EXISTS public_report_actions (
  action_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_report_id uuid NOT NULL REFERENCES public_reports(public_report_id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(user_id) ON DELETE RESTRICT,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_report_actions_action_check CHECK (action IN ('ACKNOWLEDGE', 'REJECT', 'ESCALATE_TO_INCIDENT', 'RESOLVE'))
);

CREATE INDEX IF NOT EXISTS idx_public_reports_status_created ON public_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_reports_reporter_created ON public_reports (reporter_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_reports_vehicle_created ON public_reports (vehicle_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_reports_plate_no ON public_reports (plate_no);
CREATE INDEX IF NOT EXISTS idx_public_report_attachments_report ON public_report_attachments (public_report_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_public_report_attachments_object ON public_report_attachments (bucket, object_key);
CREATE INDEX IF NOT EXISTS idx_public_report_actions_report_created ON public_report_actions (public_report_id, created_at DESC);
