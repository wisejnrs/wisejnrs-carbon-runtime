#!/bin/bash
# Start carbon-compute-arc container with Intel Arc GPU for ML/AI
# Usage: ./start-carbon-compute-arc.sh [options]
#
# Options:
#   --name NAME        Container name (default: carbon-compute-arc)
#   --password PASS    VNC/RDP/Jupyter password (default: Carbon123#)
#   --work-dir DIR     Host directory to mount as /work
#   --data-dir DIR     Host directory for database persistence
#   --memory MEM       Memory limit (default: 16g)
#   --cpus NUM         CPU limit (default: 8)

set -e

# Defaults
CONTAINER_NAME="carbon-compute-arc"
IMAGE="wisejnrs/carbon-compute-arc:latest"
PASSWORD="Carbon123#"
WORK_DIR=""
DATA_DIR=""
MEMORY="16g"
CPUS="8"

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
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Build docker run command
CMD="docker run -d --name ${CONTAINER_NAME}"

# Intel Arc GPU passthrough
CMD="${CMD} --device=/dev/dri"

# Add capabilities for profiling
CMD="${CMD} --cap-add=SYS_ADMIN --cap-add=SYS_PTRACE"

# Add to render group for GPU access
CMD="${CMD} --group-add render"

# Resource limits (more for ML workloads)
CMD="${CMD} --memory=${MEMORY} --cpus=${CPUS}"

# Shared memory for PyTorch DataLoader
CMD="${CMD} --shm-size=4g"

# Port mappings
CMD="${CMD} -p 6900:6900"   # noVNC
CMD="${CMD} -p 5900:5901"   # VNC
CMD="${CMD} -p 3389:3389"   # RDP
CMD="${CMD} -p 8888:8888"   # Jupyter Lab
CMD="${CMD} -p 9999:9999"   # code-server
CMD="${CMD} -p 8080:8080"   # Spark Master UI
CMD="${CMD} -p 8081:8081"   # Spark Worker UI
CMD="${CMD} -p 7077:7077"   # Spark Master
CMD="${CMD} -p 5432:5432"   # PostgreSQL
CMD="${CMD} -p 11434:11434" # Ollama

# Environment variables
CMD="${CMD} -e VNC_PASSWORD=${PASSWORD}"
CMD="${CMD} -e DEFAULT_PASSWORD=${PASSWORD}"
CMD="${CMD} -e CODE_SERVER_PASSWORD=${PASSWORD}"
CMD="${CMD} -e ONEAPI_DEVICE_SELECTOR=level_zero:gpu"
CMD="${CMD} -e SYCL_CACHE_DIR=/tmp/sycl_cache"

# Volume mounts
if [ -n "${WORK_DIR}" ]; then
  CMD="${CMD} -v ${WORK_DIR}:/work"
fi

if [ -n "${DATA_DIR}" ]; then
  CMD="${CMD} -v ${DATA_DIR}:/data"
fi

# Image
CMD="${CMD} ${IMAGE}"

echo "Starting Intel Arc ML/AI container: ${CONTAINER_NAME}"
echo "Command: ${CMD}"
echo ""

# Run
eval ${CMD}

echo ""
echo "Container started!"
echo ""
echo "Access:"
echo "  Jupyter Lab:  http://localhost:8888"
echo "  code-server:  http://localhost:9999 (password: ${PASSWORD})"
echo "  Web Desktop:  http://localhost:6900"
echo "  Spark Master: http://localhost:8080"
echo "  RDP:          localhost:3389 (carbon / ${PASSWORD})"
echo ""
echo "Test Intel XPU for ML:"
echo "  docker exec ${CONTAINER_NAME} test-xpu-ml.sh"
echo ""
echo "PyTorch XPU example:"
echo "  docker exec ${CONTAINER_NAME} python3 -c \"import torch; print(torch.xpu.is_available())\""
echo ""
