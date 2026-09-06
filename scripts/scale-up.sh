#!/usr/bin/env bash
set -euo pipefail

replicas="${1:-}"
if [[ -z "$replicas" || ! "$replicas" =~ ^[0-9]+$ || "$replicas" -lt 1 ]]; then
  echo "Usage: $0 <api-gateway-replicas>" >&2
  exit 2
fi

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

docker compose \
  --env-file "$repo_root/infra/docker-compose/.env" \
  -f "$repo_root/infra/docker-compose/docker-compose.yml" \
  -f "$repo_root/infra/docker-compose/docker-compose.scale.yml" \
  --profile proxy \
  up -d --scale "api-gateway=$replicas"
