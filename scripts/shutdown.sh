#!/bin/bash

# Script untuk stop semua services dengan aman
# Usage: ./shutdown.sh [--clean]

set -e

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${YELLOW}"
cat &lt;&lt; "EOF"
╔══════════════════════════════════════════════╗
║      Monitoring Angkot - Shutdown            ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

cd "$(dirname "$0")/infra/docker-compose"

if [ "$1" == "--clean" ]; then
  echo -e "${RED}[WARNING] This will remove all containers, volumes, and images!${NC}"
  read -p "Are you sure? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Stopping and cleaning...${NC}"
    docker compose down -v --rmi all
    echo -e "${GREEN}✓ Everything cleaned!${NC}"
  else
    echo -e "${YELLOW}Cancelled.${NC}"
  fi
else
  echo -e "${YELLOW}Stopping containers...${NC}"
  docker compose down
  echo -e "${GREEN}✓ All containers stopped${NC}"
fi
