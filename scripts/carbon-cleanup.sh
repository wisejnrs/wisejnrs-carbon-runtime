#!/bin/bash
#
# Clean up Docker resources for Carbon
# Usage: ./scripts/carbon-cleanup.sh [--aggressive]
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
echo "║     Carbon Docker Cleanup                     ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

AGGRESSIVE=false
if [ "$1" == "--aggressive" ] || [ "$1" == "-a" ]; then
    AGGRESSIVE=true
fi

echo -e "${YELLOW}Current Docker disk usage:${NC}"
echo ""
docker system df
echo ""

if [ "$AGGRESSIVE" = true ]; then
    echo -e "${RED}╔═══════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║  WARNING: AGGRESSIVE CLEANUP MODE             ║${NC}"
    echo -e "${RED}║  This will remove ALL unused Docker resources ║${NC}"
    echo -e "${RED}╚═══════════════════════════════════════════════╝${NC}"
    echo ""
    echo "This will remove:"
    echo "  • All stopped containers"
    echo "  • All dangling images"
    echo "  • All unused images (not just dangling)"
    echo "  • All unused build cache"
    echo "  • All unused volumes"
    echo "  • All unused networks"
    echo ""
    read -p "Are you ABSOLUTELY sure? (type 'yes' to confirm): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Cancelled"
        exit 0
    fi

    echo ""
    echo -e "${YELLOW}Performing aggressive cleanup...${NC}"
    echo ""

    # Stop all Carbon containers first
    echo "Stopping Carbon containers..."
    docker compose down

    # Remove dangling images
    echo "Removing dangling images..."
    docker image prune -f

    # Remove all unused images
    echo "Removing all unused images..."
    docker image prune -a -f

    # Remove all build cache
    echo "Removing build cache..."
    docker builder prune -a -f

    # Remove unused volumes
    echo "Removing unused volumes..."
    docker volume prune -f

    # Remove unused networks
    echo "Removing unused networks..."
    docker network prune -f

else
    echo -e "${YELLOW}Standard cleanup mode${NC}"
    echo ""
    echo "This will remove:"
    echo "  • Dangling images (untagged layers)"
    echo "  • Build cache"
    echo ""
    read -p "Continue? (yes/no): " confirm

    if [ "$confirm" != "yes" ]; then
        echo "Cancelled"
        exit 0
    fi

    echo ""
    echo -e "${YELLOW}Performing standard cleanup...${NC}"
    echo ""

    # Remove dangling images
    echo "Removing dangling images..."
    docker image prune -f

    # Remove build cache
    echo "Removing build cache..."
    docker builder prune -a -f
fi

echo ""
echo -e "${GREEN}✓ Cleanup complete!${NC}"
echo ""
echo -e "${YELLOW}Updated Docker disk usage:${NC}"
echo ""
docker system df
echo ""

echo -e "${BLUE}Tip:${NC} Run with ${YELLOW}--aggressive${NC} flag to remove all unused resources"
echo ""
