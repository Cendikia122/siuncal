#!/bin/bash

# Script untuk cek status semua services
# Usage: ./status.sh

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
cat &lt;&lt; "EOF"
╔══════════════════════════════════════════════╗
║      Monitoring Angkot - Status Check        ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

cd "$(dirname "$0")/infra/docker-compose"

echo -e "${YELLOW}Docker Services:${NC}"
docker compose ps

echo ""
echo -e "${YELLOW}Health Checks:${NC}"

# Check each service
services=("postgres:5433" "redis:6379" "api-gateway:4000" "operator-web:3000")
for service in "${services[@]}"; do
  IFS=':' read -r name port &lt;&lt;&lt; "$service"
  if nc -z localhost "$port" 2&gt;/dev/null; then
    echo -e "  ${GREEN}✓${NC} $name (port $port)"
  else
    echo -e "  ${YELLOW}✗${NC} $name (port $port) - Not responding"
  fi
done

echo ""
echo -e "${YELLOW}Service URLs:${NC}"
echo -e "  • Operator Web:    ${BLUE}http://localhost:3000${NC}"
echo -e "  • API Gateway:     ${BLUE}http://localhost:4000${NC}"
echo -e "  • PostgreSQL:      ${BLUE}localhost:5433${NC}"
echo -e "  • Redis:           ${BLUE}localhost:6379${NC}"

echo ""
echo -e "${YELLOW}Logs (last 10 lines):${NC}"
echo -e "${BLUE}Run: docker compose logs -f [service-name]${NC}"
