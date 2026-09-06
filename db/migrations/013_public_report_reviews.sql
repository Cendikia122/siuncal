CREATE TABLE IF NOT EXISTS public_report_reviews (
  review_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_report_id uuid NOT NULL REFERENCES public_reports(public_report_id) ON DELETE CASCADE,
  verdict text NOT NULL,
  confidence_score numeric(4, 3) NOT NULL,
  reason_summary text NOT NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  matched_anomaly_id uuid REFERENCES anomalies(anomaly_id) ON DELETE SET NULL,
  matched_alert_id uuid REFERENCES alerts(alert_id) ON DELETE SET NULL,
  matched_incident_id uuid REFERENCES incidents(incident_id) ON DELETE SET NULL,
  auto_escalated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT public_report_reviews_verdict_check CHECK (verdict IN ('CONFIRMED', 'LIKELY', 'INCONCLUSIVE', 'REJECT_SUSPECTED_SPAM')),
  CONSTRAINT public_report_reviews_confidence_range CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT public_report_reviews_reason_not_blank CHECK (btrim(reason_summary) <> '')
);

CREATE INDEX IF NOT EXISTS idx_public_report_reviews_report_created
  ON public_report_reviews (public_report_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_public_report_reviews_verdict_created
  ON public_report_reviews (verdict, created_at DESC);
