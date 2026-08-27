#!/bin/bash
# Build all Carbon images (GPU-enabled by default with CPU fallback)
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
REGISTRY="wisejnrs"
VERSION="latest"

# Parse arguments
PUSH=false
SPECIFIC_IMAGE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --push)
      PUSH=true
      shift
      ;;
    carbon-base|carbon-compute|carbon-tools)
      SPECIFIC_IMAGE="$1"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [carbon-base|carbon-compute|carbon-tools] [--push]"
      echo ""
      echo "Examples:"
      echo "  $0                    # Build all images"
      echo "  $0 carbon-base        # Build only carbon-base"
      echo "  $0 --push             # Build all and push to registry"
      echo "  $0 carbon-compute --push  # Build compute and push"
      exit 1
      ;;
  esac
done

log() { echo -e "${BLUE}[build]${NC} $*"; }
success() { echo -e "${GREEN}✓${NC} $*"; }
error() { echo -e "${RED}✗${NC} $*"; }
warn() { echo -e "${YELLOW}⚠${NC} $*"; }

echo ""
echo "═══════════════════════════════════════════════"
echo "   🚀 Building Carbon Image Suite (GPU-enabled)"
echo "═══════════════════════════════════════════════"
echo ""

# Track build status
BUILDS_SUCCEEDED=()
BUILDS_FAILED=()

# ========================================
# BUILD CARBON-BASE
# ========================================

if [ -z "$SPECIFIC_IMAGE" ] || [ "$SPECIFIC_IMAGE" = "carbon-base" ]; then
  log "Building carbon-base (GPU-enabled with CPU fallback)..."
  if docker build \
    -t "${REGISTRY}/carbon-base:${VERSION}" \
    -f carbon-base/Dockerfile \
    carbon-base/; then
    success "carbon-base:${VERSION} built successfully"
    BUILDS_SUCCEEDED+=("carbon-base:${VERSION}")

    if [ "$PUSH" = true ]; then
      log "Pushing carbon-base:${VERSION}..."
      docker push "${REGISTRY}/carbon-base:${VERSION}"
      success "Pushed carbon-base:${VERSION}"
    fi
  else
    error "Failed to build carbon-base"
    BUILDS_FAILED+=("carbon-base")
    exit 1
  fi
  echo ""
fi

# ========================================
# BUILD CARBON-COMPUTE
# ========================================

if [ -z "$SPECIFIC_IMAGE" ] || [ "$SPECIFIC_IMAGE" = "carbon-compute" ]; then
  log "Building carbon-compute (extends carbon-base)..."
  if docker build \
    --build-arg ROOT_CONTAINER="${REGISTRY}/carbon-base:${VERSION}" \
    -t "${REGISTRY}/carbon-compute:${VERSION}" \
    -f carbon-compute/Dockerfile \
    carbon-compute/; then
    success "carbon-compute:${VERSION} built successfully"
    BUILDS_SUCCEEDED+=("carbon-compute:${VERSION}")

    if [ "$PUSH" = true ]; then
      log "Pushing carbon-compute:${VERSION}..."
      docker push "${REGISTRY}/carbon-compute:${VERSION}"
      success "Pushed carbon-compute:${VERSION}"
    fi
  else
    error "Failed to build carbon-compute"
    BUILDS_FAILED+=("carbon-compute")
    exit 1
  fi
  echo ""
fi

# ========================================
# BUILD CARBON-TOOLS
# ========================================

if [ -z "$SPECIFIC_IMAGE" ] || [ "$SPECIFIC_IMAGE" = "carbon-tools" ]; then
  log "Building carbon-tools (extends carbon-base)..."
  if docker build \
    --build-arg ROOT_CONTAINER="${REGISTRY}/carbon-base:${VERSION}" \
    -t "${REGISTRY}/carbon-tools:${VERSION}" \
    -f carbon-tools/Dockerfile \
    carbon-tools/; then
    success "carbon-tools:${VERSION} built successfully"
    BUILDS_SUCCEEDED+=("carbon-tools:${VERSION}")

    if [ "$PUSH" = true ]; then
      log "Pushing carbon-tools:${VERSION}..."
      docker push "${REGISTRY}/carbon-tools:${VERSION}"
      success "Pushed carbon-tools:${VERSION}"
    fi
  else
    error "Failed to build carbon-tools"
    BUILDS_FAILED+=("carbon-tools")
    exit 1
  fi
  echo ""
fi

# ========================================
# SUMMARY
# ========================================

echo ""
echo "═══════════════════════════════════════════════"
echo "   📊 Build Summary"
echo "═══════════════════════════════════════════════"
echo ""

if [ ${#BUILDS_SUCCEEDED[@]} -gt 0 ]; then
  success "Successfully built ${#BUILDS_SUCCEEDED[@]} image(s):"
  for img in "${BUILDS_SUCCEEDED[@]}"; do
    echo "  ✓ ${img}"
  done
fi

if [ ${#BUILDS_FAILED[@]} -gt 0 ]; then
  error "Failed to build ${#BUILDS_FAILED[@]} image(s):"
  for img in "${BUILDS_FAILED[@]}"; do
    echo "  ✗ ${img}"
  done
  exit 1
fi

echo ""
success "All builds completed successfully!"
echo ""

# Show image sizes
log "Image sizes:"
docker images "${REGISTRY}/carbon-*:${VERSION}" --format "table {{.Repository}}:{{.Tag}}\t{{.Size}}"

echo ""
warn "Note: All images are GPU-enabled by default with CPU fallback support"
warn "They work perfectly on systems without GPUs"
echo ""
