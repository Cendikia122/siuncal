#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://localhost:4000}"
WEB_BASE_URL="${WEB_BASE_URL:-http://localhost:3000}"
TIMEOUT_SECONDS="${HEALTH_CHECK_TIMEOUT_SECONDS:-5}"

check_url() {
  local name="$1"
  local url="$2"
  local body_file
  body_file="$(mktemp)"

  local status
  status="$(curl -fsS --max-time "$TIMEOUT_SECONDS" -o "$body_file" -w "%{http_code}" "$url" || true)"
  if [[ "$status" != "200" ]]; then
    echo "FAIL $name: expected HTTP 200, got ${status:-curl-error} ($url)" >&2
    if [[ -s "$body_file" ]]; then
      sed 's/^/  /' "$body_file" >&2
    fi
    rm -f "$body_file"
    return 1
  fi

  echo "PASS $name: HTTP 200 ($url)"
  rm -f "$body_file"
}

check_json_ok() {
  local name="$1"
  local url="$2"
  local body_file
  body_file="$(mktemp)"

  local status
  status="$(curl -fsS --max-time "$TIMEOUT_SECONDS" -o "$body_file" -w "%{http_code}" "$url" || true)"
  if [[ "$status" != "200" ]]; then
    echo "FAIL $name: expected HTTP 200, got ${status:-curl-error} ($url)" >&2
    if [[ -s "$body_file" ]]; then
      sed 's/^/  /' "$body_file" >&2
    fi
    rm -f "$body_file"
    return 1
  fi

  if ! grep -q '"ok"[[:space:]]*:[[:space:]]*true' "$body_file"; then
    echo "FAIL $name: response does not contain ok=true ($url)" >&2
    sed 's/^/  /' "$body_file" >&2
    rm -f "$body_file"
    return 1
  fi

  echo "PASS $name: ok=true ($url)"
  rm -f "$body_file"
}

check_json_ok "api health" "$API_BASE_URL/health"
check_json_ok "api readiness" "$API_BASE_URL/ready"
check_url "operator login page" "$WEB_BASE_URL/auth/login"
