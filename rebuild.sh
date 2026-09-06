#!/bin/bash

# Script untuk rebuild dan restart semua services
# Author: Auto-generated
# Usage: ./rebuild.sh [options]
#   Options:
#     --clean    : Clean rebuild (hapus semua images dan volumes)
#     --dev      : Start dev services setelah docker up
#     --help     : Show this help

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ASCII Banner
echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════╗
║   Monitoring Angkot - Auto Rebuild Script   ║
╚══════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Parse arguments
CLEAN_BUILD=false
START_DEV=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --clean)
      CLEAN_BUILD=true
      shift
      ;;
    --dev)
      START_DEV=true
      shift
      ;;
    --help)
      echo "Usage: ./rebuild.sh [options]"
      echo ""
      echo "Options:"
      echo "  --clean    Clean rebuild (remove all images and volumes)"
      echo "  --dev      Start dev services after docker up"
      echo "  --help     Show this help"
      exit 0
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      exit 1
      ;;
  esac
done

# Change to docker-compose directory
cd "$(dirname "$0")/infra/docker-compose"

echo -e "${YELLOW}[1/5] Stopping existing containers...${NC}"
docker compose down || true

if [ "$CLEAN_BUILD" = true ]; then
  echo -e "${YELLOW}[2/5] Cleaning old images and volumes...${NC}"
  docker compose down -v --rmi all || true
  echo -e "${GREEN}✓ Cleaned successfully${NC}"
else
  echo -e "${BLUE}[2/5] Skipping clean (use --clean for clean build)${NC}"
fi

echo -e "${YELLOW}[3/5] Building Docker images...${NC}"
docker compose build --no-cache

echo -e "${YELLOW}[4/5] Starting containers...${NC}"
docker compose up -d

echo -e "${YELLOW}[5/5] Waiting for services to be healthy...${NC}"
sleep 5

# Check service health
echo ""
echo -e "${BLUE}Service Status:${NC}"
docker compose ps

echo ""
echo -e "${GREEN}✓ Docker services started!${NC}"
echo ""
echo -e "${BLUE}Services available at:${NC}"
echo -e "  • Operator Web:    http://localhost:3000"
echo -e "  • API Gateway:     http://localhost:4000"
echo -e "  • PostgreSQL:      localhost:5433"
echo -e "  • Redis:           localhost:6379"
echo ""

# Start dev services if requested
if [ "$START_DEV" = true ]; then
  echo -e "${YELLOW}Starting development services...${NC}"
  
  cd ../../
  
  # Open 3 new terminal tabs for dev services
  echo -e "${BLUE}Opening terminal tabs for:${NC}"
  echo -e "  • Operator Web (Next.js)"
  echo -e "  • API Gateway (Node.js)"
  echo -e "  • Rules Engine (Node.js)"
  
  # For macOS Terminal
  if [[ "$OSTYPE" == "darwin"* ]]; then
    osascript &lt;&lt;EOF
tell application "Terminal"
    do script "cd $(pwd)/apps/operator-web &amp;&amp; npm run dev"
    do script "cd $(pwd)/services/api-gateway &amp;&amp; npm run dev"
    do script "cd $(pwd)/services/rules-engine &amp;&amp; npm run dev"
end tell
EOF
  else
    echo -e "${YELLOW}Auto-start dev services only works on macOS${NC}"
    echo -e "${BLUE}Please manually run:${NC}"
    echo -e "  cd apps/operator-web &amp;&amp; npm run dev"
    echo -e "  cd services/api-gateway &amp;&amp; npm run dev"
    echo -e "  cd services/rules-engine &amp;&amp; npm run dev"
  fi
fi

echo ""
echo -e "${GREEN}════════════════════════════════════════════${NC}"
echo -e "${GREEN}    All services are ready! 🚀${NC}"
echo -e "${GREEN}════════════════════════════════════════════${NC}"
