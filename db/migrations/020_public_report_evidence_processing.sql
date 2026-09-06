CREATE TABLE IF NOT EXISTS public_report_evidence_processing (
  processing_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attachment_id uuid NOT NULL REFERENCES public_report_attachments(attachment_id) ON DELETE CASCADE,
  public_report_id uuid NOT NULL REFERENCES public_reports(public_report_id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING',
  stage text NOT NULL DEFAULT 'QUEUED',
  attempts integer NOT NULL DEFAULT 0,
  input_checksum_sha256 text,
  thumbnail_bucket text,
  thumbnail_object_key text,
  thumbnail_content_type text,
  thumbnail_size_bytes integer,
  ocr_text text,
  ocr_confidence double precision,
  quality_flags text[] NOT NULL DEFAULT ARRAY[]::text[],
  processing_duration_ms integer,
  error_code text,
  error_message text,
  queued_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_report_evidence_processing_status_check
    CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'SKIPPED')),
  CONSTRAINT public_report_evidence_processing_stage_not_blank CHECK (btrim(stage) <> ''),
  CONSTRAINT public_report_evidence_processing_attempts_non_negative CHECK (attempts >= 0),
  CONSTRAINT public_report_evidence_processing_ocr_confidence_range
    CHECK (ocr_confidence IS NULL OR (ocr_confidence >= 0 AND ocr_confidence <= 1)),
  CONSTRAINT public_report_evidence_processing_duration_non_negative
    CHECK (processing_duration_ms IS NULL OR processing_duration_ms >= 0),
  CONSTRAINT public_report_evidence_processing_thumbnail_size_positive
    CHECK (thumbnail_size_bytes IS NULL OR thumbnail_size_bytes > 0),
  UNIQUE (attachment_id)
);

CREATE INDEX IF NOT EXISTS idx_public_report_evidence_processing_report
  ON public_report_evidence_processing (public_report_id, status);
CREATE INDEX IF NOT EXISTS idx_public_report_evidence_processing_status_updated
  ON public_report_evidence_processing (status, updated_at DESC);
