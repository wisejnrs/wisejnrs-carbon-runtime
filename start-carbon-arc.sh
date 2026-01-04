#!/bin/bash
# Start carbon-base-arc container with Intel Arc GPU
# Usage: ./start-carbon-arc.sh [options]
#
# Options:
#   --name NAME        Container name (default: carbon-arc)
#   --password PASS    VNC/RDP password (default: Carbon123#)
#   --work-dir DIR     Host directory to mount as /work
#   --data-dir DIR     Host directory for database persistence
#   --memory MEM       Memory limit (default: 8g)
#   --cpus NUM         CPU limit (default: 4)
#   --detach           Run in background (default)
#   --interactive      Run interactively

set -e

# Defaults
CONTAINER_NAME="carbon-arc"
IMAGE="wisejnrs/carbon-base-arc:latest"
PASSWORD="Carbon123#"
WORK_DIR=""
DATA_DIR=""
MEMORY="8g"
CPUS="4"
DETACH="-d"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)
      CONTAINER_NAME="$2"
      shift 2
      ;;
    --password)
      PASSWORD="$2"
      shift 2
      ;;
    --work-dir)
      WORK_DIR="$2"
      shift 2
      ;;
    --data-dir)
      DATA_DIR="$2"
      shift 2
      ;;
    --memory)
      MEMORY="$2"
      shift 2
      ;;
    --cpus)
      CPUS="$2"
      shift 2
      ;;
    --detach)
      DETACH="-d"
      shift
      ;;
    --interactive)
      DETACH="-it"
      shift
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Build docker run command
CMD="docker run ${DETACH} --name ${CONTAINER_NAME}"

# Intel Arc GPU passthrough
CMD="${CMD} --device=/dev/dri"

# Add capabilities for profiling (optional but recommended)
CMD="${CMD} --cap-add=SYS_ADMIN --cap-add=SYS_PTRACE"

# Add to render group for GPU access
CMD="${CMD} --group-add render"

# Resource limits
CMD="${CMD} --memory=${MEMORY} --cpus=${CPUS}"

# Port mappings
CMD="${CMD} -p 6900:6900"   # noVNC
CMD="${CMD} -p 5900:5901"   # VNC
CMD="${CMD} -p 3389:3389"   # RDP
CMD="${CMD} -p 2222:2222"   # SSH
CMD="${CMD} -p 5432:5432"   # PostgreSQL
CMD="${CMD} -p 6379:6379"   # Redis
CMD="${CMD} -p 11434:11434" # Ollama

# Environment variables
CMD="${CMD} -e VNC_PASSWORD=${PASSWORD}"
CMD="${CMD} -e DEFAULT_PASSWORD=${PASSWORD}"
CMD="${CMD} -e ONEAPI_DEVICE_SELECTOR=level_zero:gpu"

# Volume mounts
if [ -n "${WORK_DIR}" ]; then
  CMD="${CMD} -v ${WORK_DIR}:/work"
fi

if [ -n "${DATA_DIR}" ]; then
  CMD="${CMD} -v ${DATA_DIR}:/data"
fi

# Image
CMD="${CMD} ${IMAGE}"

echo "Starting Intel Arc container: ${CONTAINER_NAME}"
echo "Command: ${CMD}"
echo ""

# Run
eval ${CMD}

echo ""
echo "Container started!"
echo ""
echo "Access:"
echo "  Web Desktop: http://localhost:6900"
echo "  VNC:         localhost:5900"
echo "  RDP:         localhost:3389 (carbon / ${PASSWORD})"
echo "  SSH:         localhost:2222"
echo ""
echo "Test Intel GPU:"
echo "  docker exec ${CONTAINER_NAME} test-intel-gpu.sh"
echo ""
