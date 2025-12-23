#!/bin/bash
set -euo pipefail

# ========================================
# Carbon Compute macOS Builder
# ========================================
# Builds carbon-compute-macos with:
# - Multi-arch support (amd64 + arm64)
# - MPS (Metal Performance Shaders) for Apple Silicon GPU
# - TensorFlow Metal plugin
# - llama-cpp-python (replaces vLLM)
# - All ML/AI tools optimized for macOS
# ========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="wisejnrs/carbon-compute-macos"
BASE_IMAGE="${BASE_IMAGE:-wisejnrs/carbon-base-macos:latest}"
TAG="${TAG:-latest}"
PLATFORMS="${PLATFORMS:-linux/amd64,linux/arm64}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Carbon Compute macOS Builder${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Parse arguments
PUSH=false
BUILD_PLATFORMS="$PLATFORMS"
SINGLE_ARCH=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --push)
      PUSH=true
      shift
      ;;
    --amd64)
      SINGLE_ARCH="linux/amd64"
      shift
      ;;
    --arm64)
      SINGLE_ARCH="linux/arm64"
      shift
      ;;
    --tag)
      TAG="$2"
      shift 2
      ;;
    --base)
      BASE_IMAGE="$2"
      shift 2
      ;;
    *)
      echo -e "${RED}Unknown option: $1${NC}"
      echo "Usage: $0 [--push] [--amd64|--arm64] [--tag TAG] [--base BASE_IMAGE]"
      exit 1
      ;;
  esac
done

# Override platforms if single arch specified
if [ -n "$SINGLE_ARCH" ]; then
  BUILD_PLATFORMS="$SINGLE_ARCH"
fi

echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Image: ${GREEN}${IMAGE_NAME}:${TAG}${NC}"
echo -e "  Base: ${GREEN}${BASE_IMAGE}${NC}"
echo -e "  Platforms: ${GREEN}${BUILD_PLATFORMS}${NC}"
echo -e "  Push to registry: ${GREEN}${PUSH}${NC}"
echo ""

# Check if base image exists
echo -e "${CYAN}Checking if base image exists...${NC}"
if ! docker image inspect "$BASE_IMAGE" >/dev/null 2>&1; then
  echo -e "${YELLOW}WARNING: Base image $BASE_IMAGE not found locally${NC}"
  echo -e "${YELLOW}You may need to build carbon-base-macos first:${NC}"
  echo -e "  ./build-macos.sh"
  echo ""
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Check if buildx is available for multi-arch builds
if [[ "$BUILD_PLATFORMS" == *","* ]]; then
  if ! docker buildx version >/dev/null 2>&1; then
    echo -e "${RED}ERROR: docker buildx is required for multi-arch builds${NC}"
    echo "Please install Docker Buildx or build single architecture with --amd64 or --arm64"
    exit 1
  fi

  # Create/use buildx builder
  if ! docker buildx inspect carbon-builder >/dev/null 2>&1; then
    echo -e "${YELLOW}Creating buildx builder 'carbon-builder'...${NC}"
    docker buildx create --name carbon-builder --use
  else
    docker buildx use carbon-builder
  fi
fi

# Build command
BUILD_CMD="docker"
if [[ "$BUILD_PLATFORMS" == *","* ]]; then
  BUILD_CMD="docker buildx"
fi

echo -e "${BLUE}Building carbon-compute-macos...${NC}"
echo ""
echo -e "${CYAN}This build will:${NC}"
if [[ "$BUILD_PLATFORMS" == *"arm64"* ]]; then
  echo -e "  ${GREEN}✓${NC} Install PyTorch with MPS (Metal GPU) for Apple Silicon"
  echo -e "  ${GREEN}✓${NC} Install TensorFlow with Metal plugin for GPU acceleration"
  echo -e "  ${GREEN}✓${NC} Install llama-cpp-python with Metal support"
fi
if [[ "$BUILD_PLATFORMS" == *"amd64"* ]]; then
  echo -e "  ${GREEN}✓${NC} Install CPU-optimized versions for Intel Macs"
fi
echo -e "  ${GREEN}✓${NC} Install Jupyter Lab, code-server, Apache Spark"
echo -e "  ${GREEN}✓${NC} Install all ML/AI frameworks (scikit-learn, pandas, etc.)"
echo ""

START_TIME=$(date +%s)

# Build arguments
BUILD_ARGS=(
  --build-arg ROOT_CONTAINER="$BASE_IMAGE"
  --build-arg DEFAULT_USER=carbon
  --build-arg DEFAULT_UID=1000
)

# Platform argument
if [[ "$BUILD_PLATFORMS" == *","* ]]; then
  BUILD_ARGS+=(--platform "$BUILD_PLATFORMS")
  if [ "$PUSH" = true ]; then
    BUILD_ARGS+=(--push)
  else
    BUILD_ARGS+=(--load)
  fi
else
  BUILD_ARGS+=(--platform "$BUILD_PLATFORMS")
  if [ "$PUSH" = true ]; then
    BUILD_ARGS+=(--push)
  fi
fi

# Execute build
if $BUILD_CMD build \
  "${BUILD_ARGS[@]}" \
  -t "${IMAGE_NAME}:${TAG}" \
  -f "${SCRIPT_DIR}/carbon-compute-macos/Dockerfile" \
  "${SCRIPT_DIR}/carbon-compute-macos/"; then

  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  MINUTES=$((DURATION / 60))
  SECONDS=$((DURATION % 60))

  echo ""
  echo -e "${GREEN}========================================${NC}"
  echo -e "${GREEN}  Build Successful! ${NC}"
  echo -e "${GREEN}========================================${NC}"
  echo ""
  echo -e "${YELLOW}Image Details:${NC}"
  echo -e "  Name: ${GREEN}${IMAGE_NAME}:${TAG}${NC}"
  echo -e "  Platforms: ${GREEN}${BUILD_PLATFORMS}${NC}"
  echo -e "  Build time: ${GREEN}${MINUTES}m ${SECONDS}s${NC}"
  echo ""

  # Show image size (only for single-arch builds loaded locally)
  if [[ "$BUILD_PLATFORMS" != *","* ]] && [ "$PUSH" = false ]; then
    echo -e "${YELLOW}Image Size:${NC}"
    docker images "${IMAGE_NAME}:${TAG}" --format "  {{.Repository}}:{{.Tag}} - {{.Size}}"
    echo ""
  fi

  echo -e "${YELLOW}GPU Support Summary:${NC}"
  echo ""
  if [[ "$BUILD_PLATFORMS" == *"arm64"* ]]; then
    echo -e "${CYAN}Apple Silicon (M1/M2/M3/M4):${NC}"
    echo -e "  ${GREEN}✓${NC} PyTorch with MPS (Metal GPU acceleration)"
    echo -e "  ${GREEN}✓${NC} TensorFlow with Metal plugin"
    echo -e "  ${GREEN}✓${NC} llama-cpp-python with Metal support"
    echo -e "  ${GREEN}✓${NC} 3-6x faster ML training vs CPU!"
    echo ""
  fi
  if [[ "$BUILD_PLATFORMS" == *"amd64"* ]]; then
    echo -e "${CYAN}Intel Macs:${NC}"
    echo -e "  ${YELLOW}○${NC} CPU-only (no GPU acceleration)"
    echo -e "  ${YELLOW}○${NC} Still great for development & testing"
    echo ""
  fi

  echo -e "${YELLOW}Next Steps:${NC}"
  echo ""
  echo -e "${BLUE}1. Test the image:${NC}"
  echo -e "   docker run -d --name carbon-compute-test \\"
  echo -e "     -p 6900:6900 -p 8888:8888 -p 9999:9999 \\"
  echo -e "     -v ~/carbon-workspace:/work \\"
  echo -e "     ${IMAGE_NAME}:${TAG}"
  echo ""
  echo -e "${BLUE}2. Access services:${NC}"
  echo -e "   Desktop (noVNC): http://localhost:6900"
  echo -e "   Jupyter Lab:     http://localhost:8888"
  echo -e "   VS Code:         http://localhost:9999"
  echo ""
  echo -e "${BLUE}3. Test MPS (Apple Silicon only):${NC}"
  echo -e "   docker exec carbon-compute-test python3 -c \\"
  echo -e "     \"import torch; print('MPS available:', torch.backends.mps.is_available())\""
  echo ""
  echo -e "   docker exec carbon-compute-test python3 -c \\"
  echo -e "     \"import tensorflow as tf; print('GPUs:', tf.config.list_physical_devices('GPU'))\""
  echo ""
  echo -e "${BLUE}4. Test llama-cpp-python:${NC}"
  echo -e "   docker exec carbon-compute-test python3 -c \\"
  echo -e "     \"from llama_cpp import Llama; print('llama-cpp-python ready')\""
  echo ""

  if [ "$PUSH" = false ]; then
    echo -e "${BLUE}5. Push to registry (when ready):${NC}"
    echo -e "   ./build-compute-macos.sh --push"
    echo ""
  fi

else
  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  Build Failed${NC}"
  echo -e "${RED}========================================${NC}"
  exit 1
fi
