#!/bin/bash
# Build all Intel Arc GPU images
# Usage: ./build-all-arc.sh [--push]

set -e

REGISTRY="${REGISTRY:-wisejnrs}"
PUSH=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --push)
      PUSH=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: ./build-all-arc.sh [--push]"
      exit 1
      ;;
  esac
done

echo "========================================"
echo "Building Intel Arc GPU Images"
echo "========================================"
echo ""
echo "Registry: ${REGISTRY}"
echo "Push: ${PUSH}"
echo ""

# Build carbon-base-arc
echo "========================================"
echo "Building carbon-base-arc..."
echo "========================================"
docker build \
  -t ${REGISTRY}/carbon-base-arc:latest \
  -f carbon-base-arc/Dockerfile \
  carbon-base-arc/

if [ "$PUSH" = true ]; then
  echo "Pushing carbon-base-arc..."
  docker push ${REGISTRY}/carbon-base-arc:latest
fi

# Build carbon-compute-arc
echo ""
echo "========================================"
echo "Building carbon-compute-arc..."
echo "========================================"
docker build \
  --build-arg ROOT_CONTAINER=${REGISTRY}/carbon-base-arc:latest \
  -t ${REGISTRY}/carbon-compute-arc:latest \
  -f carbon-compute-arc/Dockerfile \
  carbon-compute-arc/

if [ "$PUSH" = true ]; then
  echo "Pushing carbon-compute-arc..."
  docker push ${REGISTRY}/carbon-compute-arc:latest
fi

# Build carbon-tools-arc
echo ""
echo "========================================"
echo "Building carbon-tools-arc..."
echo "========================================"
docker build \
  --build-arg ROOT_CONTAINER=${REGISTRY}/carbon-base-arc:latest \
  -t ${REGISTRY}/carbon-tools-arc:latest \
  -f carbon-tools-arc/Dockerfile \
  carbon-tools-arc/

if [ "$PUSH" = true ]; then
  echo "Pushing carbon-tools-arc..."
  docker push ${REGISTRY}/carbon-tools-arc:latest
fi

echo ""
echo "========================================"
echo "Build Complete!"
echo "========================================"
echo ""
echo "Images built:"
echo "  - ${REGISTRY}/carbon-base-arc:latest"
echo "  - ${REGISTRY}/carbon-compute-arc:latest"
echo "  - ${REGISTRY}/carbon-tools-arc:latest"
echo ""
echo "To run with Intel Arc GPU:"
echo "  docker run -d --device=/dev/dri -p 6900:6900 ${REGISTRY}/carbon-base-arc:latest"
echo ""
