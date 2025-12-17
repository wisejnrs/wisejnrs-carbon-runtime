#!/bin/bash
#
# View Carbon Docker Compose Logs
# Usage: ./scripts/dc-logs.sh [service] [--follow]
#

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVICE="$1"
FOLLOW_FLAG=""

# Check for --follow flag
if [ "$2" == "--follow" ] || [ "$2" == "-f" ] || [ "$1" == "--follow" ] || [ "$1" == "-f" ]; then
    FOLLOW_FLAG="-f"
    if [ "$1" == "--follow" ] || [ "$1" == "-f" ]; then
        SERVICE=""
    fi
fi

echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Carbon Docker Compose Logs                ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

if [ -z "$SERVICE" ]; then
    echo -e "${YELLOW}Available services:${NC}"
    docker compose ps --services
    echo ""
    echo -e "${BLUE}Usage:${NC}"
    echo "  ./scripts/dc-logs.sh <service> [--follow]"
    echo "  ./scripts/dc-logs.sh carbon-compute"
    echo "  ./scripts/dc-logs.sh carbon-compute --follow"
    echo "  ./scripts/dc-logs.sh --follow  # All services"
    echo ""

    # Show all logs by default
    docker compose logs --tail=50
else
    echo -e "${GREEN}Showing logs for: ${SERVICE}${NC}"
    echo ""
    docker compose logs $FOLLOW_FLAG --tail=100 "$SERVICE"
fi
