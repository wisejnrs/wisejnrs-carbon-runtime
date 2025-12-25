#!/bin/bash
set -euo pipefail

# ========================================
# Carbon Tools macOS Builder
# ========================================
# Builds carbon-tools-macos with:
# - Multi-arch support (amd64 + arm64)
# - Creative tools (Blender, GIMP, Krita, etc.)
# - Security tools (nmap, Wireshark, hashcat, etc.)
# - DevOps tools (Docker, kubectl, Terraform, etc.)
# ========================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IMAGE_NAME="wisejnrs/carbon-tools-macos"
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
echo -e "${BLUE}  Carbon Tools macOS Builder${NC}"
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

echo -e "${BLUE}Building carbon-tools-macos...${NC}"
echo ""

START_TIME=$(date +%s)

# Build arguments
BUILD_ARGS=(
  --build-arg ROOT_CONTAINER="${BASE_IMAGE}"
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
  -f "${SCRIPT_DIR}/carbon-tools-macos/Dockerfile" \
  "${SCRIPT_DIR}/carbon-tools-macos/"; then

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
  echo -e "  Base: ${GREEN}${BASE_IMAGE}${NC}"
  echo -e "  Platforms: ${GREEN}${BUILD_PLATFORMS}${NC}"
  echo -e "  Build time: ${GREEN}${MINUTES}m ${SECONDS}s${NC}"
  echo ""

  # Show image size (only for single-arch builds loaded locally)
  if [[ "$BUILD_PLATFORMS" != *","* ]] && [ "$PUSH" = false ]; then
    echo -e "${YELLOW}Image Size:${NC}"
    docker images "${IMAGE_NAME}:${TAG}" --format "  {{.Repository}}:{{.Tag}} - {{.Size}}"
    echo ""
  fi

  if [ "$PUSH" = true ]; then
    echo -e "${GREEN}✅ Image pushed to Docker Hub${NC}"
    echo ""
    echo -e "${CYAN}Pull with:${NC}"
    echo -e "  docker pull ${IMAGE_NAME}:${TAG}"
    echo ""
  else
    echo -e "${YELLOW}Next Steps:${NC}"
    echo ""
    echo -e "${CYAN}1. Test the image:${NC}"
    echo -e "   docker run -d --name carbon-tools-test \\"
    echo -e "     -p 6900:6900 \\"
    echo -e "     ${IMAGE_NAME}:${TAG}"
    echo ""
    echo -e "${CYAN}2. Push to registry:${NC}"
    echo -e "   docker push ${IMAGE_NAME}:${TAG}"
    echo ""
  fi

  exit 0
else
  END_TIME=$(date +%s)
  DURATION=$((END_TIME - START_TIME))
  MINUTES=$((DURATION / 60))
  SECONDS=$((DURATION % 60))

  echo ""
  echo -e "${RED}========================================${NC}"
  echo -e "${RED}  Build Failed! ${NC}"
  echo -e "${RED}========================================${NC}"
  echo ""
  echo -e "${YELLOW}Build time: ${RED}${MINUTES}m ${SECONDS}s${NC}"
  echo ""
  exit 1
fi
