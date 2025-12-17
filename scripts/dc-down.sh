#!/bin/bash
#
# Docker Compose Shutdown for Carbon
# Usage: ./scripts/dc-down.sh [--volumes]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Carbon Docker Compose Shutdown            ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Check for --volumes flag
REMOVE_VOLUMES=false
if [ "$1" == "--volumes" ] || [ "$1" == "-v" ]; then
    REMOVE_VOLUMES=true
    echo -e "${YELLOW}Warning: This will remove all volumes (data will be lost)${NC}"
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Cancelled"
        exit 0
    fi
fi

echo ""
echo -e "${YELLOW}Stopping all Carbon services...${NC}"
echo ""

# Stop all containers (works for all profiles)
if [ "$REMOVE_VOLUMES" = true ]; then
    docker compose down -v
    echo ""
    echo -e "${GREEN}✓ Services stopped and volumes removed${NC}"
else
    docker compose down
    echo ""
    echo -e "${GREEN}✓ Services stopped (volumes preserved)${NC}"
fi

echo ""
echo -e "${BLUE}To remove volumes manually:${NC} docker compose down -v"
echo -e "${BLUE}To restart services:${NC} ./scripts/dc-up.sh"
echo ""
