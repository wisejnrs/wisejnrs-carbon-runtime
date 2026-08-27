#!/bin/bash
#
# Quick shell access to Carbon containers
# Usage: ./scripts/carbon-shell.sh [container]
#

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

CONTAINER="$1"

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Carbon Container Shell Access             ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

if [ -z "$CONTAINER" ]; then
    echo -e "${YELLOW}Available Carbon containers:${NC}"
    echo ""
    docker ps --filter "name=carbon" --format "  {{.Names}}"
    echo ""
    read -p "Enter container name: " CONTAINER
fi

# Check if container exists and is running
if ! docker ps --format "{{.Names}}" | grep -q "^${CONTAINER}$"; then
    echo -e "${RED}Error: Container '$CONTAINER' not found or not running${NC}"
    exit 1
fi

echo -e "${GREEN}Connecting to ${CONTAINER}...${NC}"
echo ""

# Try bash first, fall back to sh
docker exec -it "$CONTAINER" bash 2>/dev/null || docker exec -it "$CONTAINER" sh
