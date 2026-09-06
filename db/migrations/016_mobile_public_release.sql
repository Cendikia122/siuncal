ALTER TABLE users
  ADD COLUMN IF NOT EXISTS email_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

ALTER TABLE users
  ALTER COLUMN email_verified_at SET DEFAULT now();

UPDATE users
SET email_verified_at = COALESCE(email_verified_at, created_at, now())
WHERE email_verified_at IS NULL;

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mobile_refresh_tokens (
  token_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  replaced_by uuid REFERENCES mobile_refresh_tokens(token_id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS passenger_tracking_consents (
  consent_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  policy_version text NOT NULL,
  platform text,
  app_version text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

CREATE TABLE IF NOT EXISTS account_email_outbox (
  email_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient text NOT NULL,
  template text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'PENDING',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user
  ON email_verification_tokens (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
  ON password_reset_tokens (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_mobile_refresh_tokens_user
  ON mobile_refresh_tokens (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_passenger_tracking_consents_user
  ON passenger_tracking_consents (user_id, accepted_at DESC);
CREATE INDEX IF NOT EXISTS idx_account_email_outbox_pending
  ON account_email_outbox (status, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM timescaledb_information.jobs
    WHERE proc_name = 'policy_retention'
      AND hypertable_name = 'passenger_positions'
  ) THEN
    PERFORM add_retention_policy('passenger_positions', INTERVAL '30 days');
  END IF;
END $$;
