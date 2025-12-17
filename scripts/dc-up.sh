#!/bin/bash
#
# Docker Compose Quick Launcher for Carbon
# Usage: ./scripts/dc-up.sh [profile]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════════╗"
echo "║     Carbon Docker Compose Launcher            ║"
echo "╚═══════════════════════════════════════════════╝"
echo -e "${NC}"

# Get profile from argument or show menu
if [ -n "$1" ]; then
    PROFILE="$1"
else
    echo -e "${YELLOW}Select a profile:${NC}"
    echo ""
    echo "  1) minimal      - Base image only"
    echo "  2) ml           - ML/AI workstation (Jupyter, Spark, GPU)"
    echo "  3) creative     - Creative tools (Blender, GIMP, OBS)"
    echo "  4) security     - Security tools (Wireshark, nmap, hashcat)"
    echo "  5) dev          - Development (all images + databases)"
    echo "  6) full         - Everything (all services)"
    echo ""
    echo "  7) Custom       - Enter custom profile(s)"
    echo ""
    read -p "Enter choice [1-7]: " choice

    case $choice in
        1) PROFILE="minimal" ;;
        2) PROFILE="ml" ;;
        3) PROFILE="creative" ;;
        4) PROFILE="security" ;;
        5) PROFILE="dev" ;;
        6) PROFILE="full" ;;
        7)
            read -p "Enter profile name(s) (space-separated): " PROFILE
            ;;
        *)
            echo -e "${RED}Invalid choice${NC}"
            exit 1
            ;;
    esac
fi

# Convert space-separated profiles to --profile flags
PROFILE_FLAGS=""
for p in $PROFILE; do
    PROFILE_FLAGS="$PROFILE_FLAGS --profile $p"
done

echo ""
echo -e "${GREEN}Starting Carbon with profile(s):${NC} ${BLUE}$PROFILE${NC}"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}Warning: .env file not found. Creating from .env.example...${NC}"
    if [ -f .env.example ]; then
        cp .env.example .env
        echo -e "${GREEN}Created .env file. Please review and customize if needed.${NC}"
    fi
fi

# Run docker compose
echo -e "${BLUE}Executing: docker compose $PROFILE_FLAGS up -d${NC}"
echo ""

docker compose $PROFILE_FLAGS up -d

echo ""
echo -e "${GREEN}✓ Carbon services started!${NC}"
echo ""
echo -e "${YELLOW}Access your environment:${NC}"

# Show relevant URLs based on profile
if [[ "$PROFILE" == *"minimal"* ]] || [[ "$PROFILE" == *"base"* ]]; then
    echo "  • noVNC (Web Desktop): http://localhost:6900"
    echo "  • xRDP: localhost:3390 (user: carbon, pass: Carbon123#)"
fi

if [[ "$PROFILE" == *"ml"* ]] || [[ "$PROFILE" == *"compute"* ]] || [[ "$PROFILE" == *"full"* ]]; then
    echo "  • Jupyter Lab: http://localhost:8888"
    echo "  • VS Code (code-server): http://localhost:9999"
    echo "  • Spark Master UI: http://localhost:8080"
    echo "  • noVNC (Compute): http://localhost:6901"
fi

if [[ "$PROFILE" == *"creative"* ]] || [[ "$PROFILE" == *"security"* ]] || [[ "$PROFILE" == *"tools"* ]] || [[ "$PROFILE" == *"full"* ]]; then
    echo "  • noVNC (Tools): http://localhost:6902"
fi

if [[ "$PROFILE" == *"dev"* ]] || [[ "$PROFILE" == *"full"* ]] || [[ "$PROFILE" == *"monitoring"* ]]; then
    echo "  • Portainer: http://localhost:9000"
fi

echo ""
echo -e "${BLUE}View logs:${NC} ./scripts/dc-logs.sh"
echo -e "${BLUE}Stop services:${NC} ./scripts/dc-down.sh"
echo ""
