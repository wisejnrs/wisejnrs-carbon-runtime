#!/bin/bash
set -euo pipefail

# ========================================
# Carbon macOS Complete Builder
# ========================================
# Builds both carbon-base-macos and carbon-compute-macos
# Then runs verification tests
# ========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Detect architecture
ARCH="$(uname -m)"

echo -e "${BLUE}"
echo "========================================================================"
echo "  🚀 Carbon macOS Complete Build & Test Suite"
echo "========================================================================"
echo -e "${NC}"
echo ""
echo -e "${CYAN}System Information:${NC}"
echo -e "  Architecture: ${GREEN}${ARCH}${NC}"
echo -e "  Platform: ${GREEN}$(uname -s)${NC}"
echo -e "  Hostname: ${GREEN}$(hostname)${NC}"
echo ""

# Check if on macOS
if [[ "$(uname -s)" != "Darwin" ]]; then
    echo -e "${YELLOW}WARNING: This script is designed for macOS${NC}"
    echo -e "Current OS: $(uname -s)"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if on Apple Silicon
if [[ "$ARCH" == "arm64" ]]; then
    echo -e "${GREEN}✅ Apple Silicon detected - MPS GPU acceleration will be enabled!${NC}"
    BUILD_ARCH="--arm64"
elif [[ "$ARCH" == "x86_64" ]]; then
    echo -e "${YELLOW}⚠️  Intel Mac detected - CPU-only mode (no GPU acceleration)${NC}"
    BUILD_ARCH="--amd64"
else
    echo -e "${RED}❌ Unknown architecture: $ARCH${NC}"
    exit 1
fi

echo ""

# Check Docker
echo -e "${CYAN}Checking Docker availability...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker not found${NC}"
    echo ""
    echo "Please install Docker Desktop for Mac:"
    echo "  https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! docker info &> /dev/null; then
    echo -e "${RED}❌ Docker daemon not running${NC}"
    echo ""
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo -e "${GREEN}✅ Docker is running${NC}"
DOCKER_VERSION=$(docker --version)
echo -e "   ${DOCKER_VERSION}"
echo ""

# Disk space check
echo -e "${CYAN}Checking disk space...${NC}"
AVAILABLE_GB=$(df -g . | awk 'NR==2 {print $4}')
REQUIRED_GB=70

if [[ $AVAILABLE_GB -lt $REQUIRED_GB ]]; then
    echo -e "${YELLOW}⚠️  Low disk space: ${AVAILABLE_GB}GB available${NC}"
    echo -e "   Required: ~${REQUIRED_GB}GB"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✅ Sufficient disk space: ${AVAILABLE_GB}GB available${NC}"
fi

echo ""

# Build plan
echo -e "${MAGENTA}"
echo "========================================================================"
echo "  📋 Build Plan"
echo "========================================================================"
echo -e "${NC}"
echo ""
echo -e "${CYAN}Phase 1: carbon-base-macos${NC}"
echo "  - Size: ~14 GB"
echo "  - Time: 15-25 minutes"
echo "  - Features: Software rendering, MoltenVK, all dev tools"
echo ""
echo -e "${CYAN}Phase 2: carbon-compute-macos${NC}"
echo "  - Size: ~48 GB"
echo "  - Time: 25-40 minutes"
if [[ "$ARCH" == "arm64" ]]; then
    echo "  - Features: MPS GPU, PyTorch, TensorFlow Metal, Jupyter"
    echo -e "  - ${GREEN}GPU Acceleration: ENABLED${NC} ⚡"
else
    echo "  - Features: CPU-only, PyTorch, TensorFlow, Jupyter"
    echo -e "  - ${YELLOW}GPU Acceleration: DISABLED (Intel Mac)${NC}"
fi
echo ""
echo -e "${CYAN}Phase 3: Verification${NC}"
echo "  - Start container"
echo "  - Run MPS verification tests"
echo "  - Test PyTorch GPU training"
echo ""
echo -e "${YELLOW}Total estimated time: 40-65 minutes${NC}"
echo -e "${YELLOW}Total disk usage: ~62 GB${NC}"
echo ""

read -p "Ready to begin? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Build cancelled"
    exit 0
fi

echo ""
TOTAL_START=$(date +%s)

# ========================================
# Phase 1: Build carbon-base-macos
# ========================================

echo -e "${MAGENTA}"
echo "========================================================================"
echo "  📦 Phase 1: Building carbon-base-macos"
echo "========================================================================"
echo -e "${NC}"
echo ""

PHASE1_START=$(date +%s)

if ./build-macos.sh $BUILD_ARCH; then
    PHASE1_END=$(date +%s)
    PHASE1_TIME=$((PHASE1_END - PHASE1_START))
    PHASE1_MIN=$((PHASE1_TIME / 60))
    PHASE1_SEC=$((PHASE1_TIME % 60))

    echo ""
    echo -e "${GREEN}✅ Phase 1 Complete: carbon-base-macos built successfully${NC}"
    echo -e "   Build time: ${PHASE1_MIN}m ${PHASE1_SEC}s"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Phase 1 Failed: carbon-base-macos build failed${NC}"
    echo ""
    echo "Check the error messages above for details"
    exit 1
fi

# Small delay between phases
sleep 3

# ========================================
# Phase 2: Build carbon-compute-macos
# ========================================

echo -e "${MAGENTA}"
echo "========================================================================"
echo "  🧠 Phase 2: Building carbon-compute-macos"
echo "========================================================================"
echo -e "${NC}"
echo ""

PHASE2_START=$(date +%s)

if ./build-compute-macos.sh $BUILD_ARCH; then
    PHASE2_END=$(date +%s)
    PHASE2_TIME=$((PHASE2_END - PHASE2_START))
    PHASE2_MIN=$((PHASE2_TIME / 60))
    PHASE2_SEC=$((PHASE2_TIME % 60))

    echo ""
    echo -e "${GREEN}✅ Phase 2 Complete: carbon-compute-macos built successfully${NC}"
    echo -e "   Build time: ${PHASE2_MIN}m ${PHASE2_SEC}s"
    echo ""
else
    echo ""
    echo -e "${RED}❌ Phase 2 Failed: carbon-compute-macos build failed${NC}"
    echo ""
    echo "Check the error messages above for details"
    exit 1
fi

# ========================================
# Phase 3: Verification & Testing
# ========================================

echo -e "${MAGENTA}"
echo "========================================================================"
echo "  🧪 Phase 3: Verification & Testing"
echo "========================================================================"
echo -e "${NC}"
echo ""

# Stop any existing container
if docker ps -a --format '{{.Names}}' | grep -q '^carbon-test$'; then
    echo "Cleaning up existing test container..."
    docker stop carbon-test 2>/dev/null || true
    docker rm carbon-test 2>/dev/null || true
fi

# Start container
echo "Starting carbon-compute-macos container..."
docker run -d --name carbon-test \
  -p 6900:6900 \
  -p 8888:8888 \
  -p 9999:9999 \
  -v ~/carbon-workspace:/work \
  wisejnrs/carbon-compute-macos:latest

echo -e "${GREEN}✅ Container started: carbon-test${NC}"
echo ""

# Wait for services
echo "Waiting for services to start (30 seconds)..."
for i in {1..30}; do
    echo -n "."
    sleep 1
done
echo ""
echo ""

# Copy test files to container
echo "Copying test files to container..."
docker cp carbon-compute-macos/tests carbon-test:/home/carbon/

# Run MPS verification
echo -e "${CYAN}Running MPS verification test...${NC}"
echo ""

if docker exec carbon-test python3 /home/carbon/tests/verify_mps.py; then
    VERIFY_STATUS="PASS"
else
    VERIFY_STATUS="FAIL"
fi

echo ""

# Run PyTorch training test if MPS verification passed
if [[ "$VERIFY_STATUS" == "PASS" ]] && [[ "$ARCH" == "arm64" ]]; then
    echo -e "${CYAN}Running PyTorch MPS training test...${NC}"
    echo ""

    docker exec carbon-test python3 /home/carbon/tests/test1_pytorch_mps.py

    echo ""
fi

# ========================================
# Final Summary
# ========================================

TOTAL_END=$(date +%s)
TOTAL_TIME=$((TOTAL_END - TOTAL_START))
TOTAL_MIN=$((TOTAL_TIME / 60))
TOTAL_SEC=$((TOTAL_TIME % 60))

echo ""
echo -e "${MAGENTA}"
echo "========================================================================"
echo "  🎉 Build Complete!"
echo "========================================================================"
echo -e "${NC}"
echo ""
echo -e "${CYAN}Build Summary:${NC}"
echo -e "  Phase 1 (base):    ${PHASE1_MIN}m ${PHASE1_SEC}s"
echo -e "  Phase 2 (compute): ${PHASE2_MIN}m ${PHASE2_SEC}s"
echo -e "  ${GREEN}Total time:        ${TOTAL_MIN}m ${TOTAL_SEC}s${NC}"
echo ""

echo -e "${CYAN}Images Built:${NC}"
docker images | grep "carbon.*macos" | head -2
echo ""

echo -e "${CYAN}Container Status:${NC}"
docker ps --filter "name=carbon-test" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""

echo -e "${CYAN}Access Points:${NC}"
echo -e "  Desktop (noVNC): ${GREEN}http://localhost:6900${NC}"
echo -e "  Jupyter Lab:     ${GREEN}http://localhost:8888${NC}"
echo -e "  VS Code:         ${GREEN}http://localhost:9999${NC}"
echo ""

if [[ "$ARCH" == "arm64" ]]; then
    echo -e "${CYAN}GPU Acceleration:${NC}"
    if [[ "$VERIFY_STATUS" == "PASS" ]]; then
        echo -e "  ${GREEN}✅ MPS GPU: ENABLED${NC}"
        echo -e "  ${GREEN}✅ PyTorch: 4-6x faster training${NC}"
        echo -e "  ${GREEN}✅ TensorFlow: Metal plugin active${NC}"
        echo ""
        echo -e "${YELLOW}💡 Tip: Monitor GPU usage in Activity Monitor → GPU History${NC}"
    else
        echo -e "  ${YELLOW}⚠️  MPS verification failed${NC}"
        echo -e "     Check logs above for details"
    fi
else
    echo -e "${CYAN}Performance:${NC}"
    echo -e "  ${YELLOW}⚠️  CPU-only mode (Intel Mac)${NC}"
    echo -e "     All features work, but no GPU acceleration"
fi

echo ""
echo -e "${CYAN}Next Steps:${NC}"
echo ""
echo -e "${BLUE}1. Access Jupyter Lab:${NC}"
echo "   open http://localhost:8888"
echo ""
echo -e "${BLUE}2. Try a notebook:${NC}"
echo "   # In Jupyter, create a new notebook and test PyTorch MPS:"
echo "   import torch"
echo "   print('MPS available:', torch.backends.mps.is_available())"
echo ""
echo -e "${BLUE}3. Stop container:${NC}"
echo "   docker stop carbon-test"
echo ""
echo -e "${BLUE}4. Restart container:${NC}"
echo "   docker start carbon-test"
echo ""
echo -e "${BLUE}5. View logs:${NC}"
echo "   docker logs carbon-test"
echo ""

echo -e "${MAGENTA}"
echo "========================================================================"
echo "  🚀 Carbon macOS Suite Ready!"
echo "========================================================================"
echo -e "${NC}"
echo ""

if [[ "$VERIFY_STATUS" == "PASS" ]]; then
    echo -e "${GREEN}✅ SUCCESS: All systems operational!${NC}"
    echo ""
    if [[ "$ARCH" == "arm64" ]]; then
        echo "Your Mac is now a GPU-accelerated ML/AI workstation! 🎉"
    else
        echo "Your Mac is now a complete development environment! 🎉"
    fi
else
    echo -e "${YELLOW}⚠️  Build complete but verification had issues${NC}"
    echo "Review the logs above for troubleshooting"
fi

echo ""
