#!/bin/bash
#
# Check status of Carbon services
# Usage: ./scripts/carbon-status.sh
#

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Carbon Services Status                    ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check if any containers are running
RUNNING_CONTAINERS=$(docker ps --filter "name=carbon" --format "{{.Names}}" | wc -l)

if [ "$RUNNING_CONTAINERS" -eq 0 ]; then
    echo -e "${YELLOW}No Carbon containers are currently running${NC}"
    echo ""
    echo -e "${BLUE}Start services with:${NC} ./scripts/dc-up.sh"
    exit 0
fi

echo -e "${GREEN}Running Carbon Containers:${NC}"
echo ""
docker ps --filter "name=carbon" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Resource Usage:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""
docker stats --no-stream --filter "name=carbon"

echo ""
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Docker Compose Services:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""
docker compose ps

echo ""
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}Access Points:${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════${NC}"
echo ""

# Check which containers are running and show relevant URLs
if docker ps --filter "name=carbon-base" --format "{{.Names}}" | grep -q carbon-base; then
    echo -e "${YELLOW}Carbon Base:${NC}"
    echo "  • noVNC: http://localhost:6900"
    echo "  • xRDP: localhost:3390"
    echo ""
fi

if docker ps --filter "name=carbon-compute" --format "{{.Names}}" | grep -q carbon-compute; then
    echo -e "${YELLOW}Carbon Compute:${NC}"
    echo "  • Jupyter Lab: http://localhost:8888"
    echo "  • VS Code: http://localhost:9999"
    echo "  • Spark UI: http://localhost:8080"
    echo "  • noVNC: http://localhost:6901"
    echo ""
fi

if docker ps --filter "name=carbon-tools" --format "{{.Names}}" | grep -q carbon-tools; then
    echo -e "${YELLOW}Carbon Tools:${NC}"
    echo "  • noVNC: http://localhost:6902"
    echo ""
fi

if docker ps --filter "name=portainer" --format "{{.Names}}" | grep -q portainer; then
    echo -e "${YELLOW}Monitoring:${NC}"
    echo "  • Portainer: http://localhost:9000"
    echo ""
fi

if docker ps --filter "name=qdrant" --format "{{.Names}}" | grep -q qdrant; then
    echo -e "${YELLOW}Vector Database:${NC}"
    echo "  • Qdrant Dashboard: http://localhost:6333/dashboard"
    echo ""
fi

echo ""
