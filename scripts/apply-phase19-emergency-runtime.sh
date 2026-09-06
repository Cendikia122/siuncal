#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-$REPO_ROOT/infra/docker-compose/.env}"
COMPOSE_FILE="${COMPOSE_FILE:-$REPO_ROOT/infra/docker-compose/docker-compose.yml}"
POSTGRES_SERVICE="${POSTGRES_SERVICE:-postgres}"
SEED_DEMO_FIELD_OFFICER="${SEED_DEMO_FIELD_OFFICER:-false}"

if [[ ! -f "$COMPOSE_ENV_FILE" ]]; then
  echo "FAIL compose env file not found: $COMPOSE_ENV_FILE" >&2
  echo "Set COMPOSE_ENV_FILE=/path/to/.env or create infra/docker-compose/.env." >&2
  exit 1
fi

compose() {
  docker compose --env-file "$COMPOSE_ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

postgres_psql() {
  compose exec -T "$POSTGRES_SERVICE" bash -lc \
    'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" "$@"' \
    bash "$@"
}

echo "Applying Phase 19 emergency migration to existing runtime database..."
compose exec -T "$POSTGRES_SERVICE" bash -lc \
  'psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -f /db/migrations/022_phase19_emergency_response.sql'

missing_columns="$(
  postgres_psql -At <<'SQL'
WITH required_columns(table_name, column_name) AS (
  VALUES
    ('incidents', 'reporter_user_id'),
    ('incidents', 'reporter_session_id'),
    ('incidents', 'source'),
    ('incidents', 'emergency_category'),
    ('incidents', 'trust_level'),
    ('incidents', 'escalation_state'),
    ('incidents', 'ack_due_at'),
    ('incidents', 'assignment_due_at'),
    ('incidents', 'escalation_target'),
    ('incidents', 'escalation_last_at'),
    ('incident_actions', 'metadata')
)
SELECT table_name || '.' || column_name
FROM required_columns required
WHERE NOT EXISTS (
  SELECT 1
  FROM information_schema.columns columns
  WHERE columns.table_name = required.table_name
    AND columns.column_name = required.column_name
)
ORDER BY table_name, column_name;
SQL
)"

if [[ -n "$missing_columns" ]]; then
  echo "FAIL Phase 19 migration verification failed. Missing columns:" >&2
  echo "$missing_columns" | sed 's/^/  - /' >&2
  exit 1
fi

field_officer_count="$(
  postgres_psql -At <<'SQL'
SELECT COUNT(*)::int
FROM users
WHERE is_active = true
  AND 'PETUGAS_LAPANGAN' = ANY(roles);
SQL
)"

if [[ "$field_officer_count" == "0" ]]; then
  if [[ "$SEED_DEMO_FIELD_OFFICER" != "true" ]]; then
    echo "FAIL Field officer role missing: no active user has PETUGAS_LAPANGAN." >&2
    echo "Provision a real field officer user for production/staging." >&2
    echo "For local demo only, rerun with SEED_DEMO_FIELD_OFFICER=true to create lapangan@pemda.go.id." >&2
    exit 1
  fi

  echo "Creating local demo PETUGAS_LAPANGAN user lapangan@pemda.go.id..."
  postgres_psql <<'SQL'
INSERT INTO users (email, full_name, password_hash, roles, is_active)
VALUES ('lapangan@pemda.go.id', 'Petugas Lapangan Bogor', crypt('password123', gen_salt('bf')), ARRAY['PETUGAS_LAPANGAN'], true)
ON CONFLICT (email) DO UPDATE
SET full_name = EXCLUDED.full_name,
    roles = CASE
      WHEN 'PETUGAS_LAPANGAN' = ANY(users.roles) THEN users.roles
      ELSE array_append(users.roles, 'PETUGAS_LAPANGAN')
    END,
    is_active = true;
SQL
  field_officer_count="$(
    postgres_psql -At <<'SQL'
SELECT COUNT(*)::int
FROM users
WHERE is_active = true
  AND 'PETUGAS_LAPANGAN' = ANY(roles);
SQL
  )"
fi

echo "PASS Phase 19 emergency migration columns are present."
echo "PASS Active PETUGAS_LAPANGAN users: $field_officer_count."
echo "Next: run docs/runbooks/emergency-drill.md against the target stack."
