#!/bin/bash
# Universal Carbon Container Launcher with Configuration Support
set -e

# ============================================
# DEFAULT CONFIGURATION
# ============================================

# Image selection
IMAGE_TYPE="${IMAGE_TYPE:-base}"  # base, compute, tools
IMAGE_VARIANT="${IMAGE_VARIANT:-gpu}"  # gpu, minimal (default: gpu)

# User settings
CARBON_USER="${CARBON_USER:-carbon}"
CARBON_PASSWORD="${CARBON_PASSWORD:-Carbon123#}"
CARBON_UID="${CARBON_UID:-1000}"
CARBON_GID="${CARBON_GID:-100}"
TZ="${TZ:-Australia/Brisbane}"

# VNC settings
VNC_PASSWORD="${VNC_PASSWORD:-Carbon123#}"
VNC_RESOLUTION="${VNC_RESOLUTION:-1920x1080}"
VNC_DEPTH="${VNC_DEPTH:-24}"
VNC_DISPLAY="${VNC_DISPLAY:-:1}"

# Workspace
WORK_DIR="${WORK_DIR:-$(pwd)/work}"
DATA_DIR="${DATA_DIR:-$(pwd)/data}"
HOME_DIR="${HOME_DIR:-}"

# Ports
RDP_PORT="${RDP_PORT:-3390}"
NOVNC_PORT="${NOVNC_PORT:-6900}"
VNC_PORT="${VNC_PORT:-5900}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MONGODB_PORT="${MONGODB_PORT:-27017}"
REDIS_PORT="${REDIS_PORT:-6379}"
MOSQUITTO_PORT="${MOSQUITTO_PORT:-1883}"
JUPYTER_PORT="${JUPYTER_PORT:-8888}"
CODE_SERVER_PORT="${CODE_SERVER_PORT:-9999}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
QDRANT_HTTP_PORT="${QDRANT_HTTP_PORT:-6333}"
QDRANT_GRPC_PORT="${QDRANT_GRPC_PORT:-6334}"

# Passwords
CODE_SERVER_PASSWORD="${CODE_SERVER_PASSWORD:-Carbon123#}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-Carbon123#}"
MONGODB_PASSWORD="${MONGODB_PASSWORD:-Carbon123#}"

# Resources
MEMORY_LIMIT="${MEMORY_LIMIT:-16g}"
CPU_LIMIT="${CPU_LIMIT:-8}"
GPU_DEVICES="${GPU_DEVICES:-all}"

# Container settings
CONTAINER_NAME="${CONTAINER_NAME:-carbon-${IMAGE_TYPE}}"
NETWORK_MODE="${NETWORK_MODE:-bridge}"
RESTART_POLICY="${RESTART_POLICY:-unless-stopped}"

# ============================================
# LOAD .env FILE IF EXISTS
# ============================================

if [ -f .env ]; then
    echo "📋 Loading configuration from .env file..."
    set -a
    source .env
    set +a
fi

# ============================================
# PARSE COMMAND LINE ARGUMENTS
# ============================================

SHOW_HELP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --image)
            IMAGE_TYPE="$2"
            shift 2
            ;;
        --variant)
            IMAGE_VARIANT="$2"
            shift 2
            ;;
        --password)
            CARBON_PASSWORD="$2"
            VNC_PASSWORD="$2"
            CODE_SERVER_PASSWORD="$2"
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
        --resolution)
            VNC_RESOLUTION="$2"
            shift 2
            ;;
        --memory)
            MEMORY_LIMIT="$2"
            shift 2
            ;;
        --cpu)
            CPU_LIMIT="$2"
            shift 2
            ;;
        --gpu)
            GPU_DEVICES="$2"
            shift 2
            ;;
        --name)
            CONTAINER_NAME="$2"
            shift 2
            ;;
        --help|-h)
            SHOW_HELP=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            SHOW_HELP=true
            shift
            ;;
    esac
done

# ============================================
# HELP MESSAGE
# ============================================

if [ "$SHOW_HELP" = true ]; then
    cat << 'EOF'
🚀 Carbon Container Launcher - Universal Configuration Script

USAGE:
    ./start-carbon-configurable.sh [OPTIONS]

OPTIONS:
    --image TYPE          Image type: base, compute, tools (default: base)
    --variant VARIANT     Image variant: gpu, minimal (default: gpu)
    --password PASS       Set all passwords (user, VNC, code-server)
    --work-dir PATH       Host directory for /work (default: ./work)
    --data-dir PATH       Host directory for /data (default: ./data)
    --resolution RES      VNC resolution (default: 1920x1080)
    --memory SIZE         Memory limit (default: 16g)
    --cpu COUNT           CPU limit (default: 8)
    --gpu DEVICES         GPU devices (default: all)
    --name NAME           Container name (default: carbon-TYPE)
    --help, -h            Show this help message

EXAMPLES:
    # Start base image with custom password
    ./start-carbon-configurable.sh --password MySecret123

    # Start compute image with custom workspace
    ./start-carbon-configurable.sh --image compute --work-dir ~/projects

    # Start tools with 4K resolution and 32GB RAM
    ./start-carbon-configurable.sh --image tools --resolution 3840x2160 --memory 32g

    # Start with specific GPU
    ./start-carbon-configurable.sh --gpu 0

CONFIGURATION FILE:
    Create a .env file (see .env.example) for persistent configuration
    Environment variables in .env will be loaded automatically

ENVIRONMENT VARIABLES:
    All settings can be controlled via environment variables:
    - CARBON_PASSWORD, VNC_PASSWORD, CODE_SERVER_PASSWORD
    - WORK_DIR, DATA_DIR
    - VNC_RESOLUTION, MEMORY_LIMIT, CPU_LIMIT
    - And many more... (see .env.example)

ACCESS:
    - RDP:    localhost:${RDP_PORT}
    - noVNC:  http://localhost:${NOVNC_PORT}
    - VNC:    localhost:${VNC_PORT}

DOCUMENTATION:
    See README.md, QUICK-START.md, and IMAGES.md for more information
EOF
    exit 0
fi

# ============================================
# BUILD IMAGE NAME
# ============================================

case $IMAGE_TYPE in
    base)
        IMAGE_NAME="wisejnrs/carbon-base:latest-${IMAGE_VARIANT}"
        ;;
    compute)
        IMAGE_NAME="wisejnrs/carbon-compute:latest"
        IMAGE_VARIANT="gpu"  # compute requires GPU
        ;;
    tools)
        IMAGE_NAME="wisejnrs/carbon-tools:latest-${IMAGE_VARIANT}"
        ;;
    *)
        echo "❌ Error: Invalid image type '$IMAGE_TYPE'"
        echo "Valid options: base, compute, tools"
        exit 1
        ;;
esac

# ============================================
# PREPARE DIRECTORIES
# ============================================

echo "📁 Preparing workspace directories..."
mkdir -p "$WORK_DIR"
mkdir -p "$DATA_DIR"

# ============================================
# CLEAN UP EXISTING CONTAINER
# ============================================

echo "🧹 Cleaning up existing container..."
docker stop "$CONTAINER_NAME" 2>/dev/null || true
docker rm "$CONTAINER_NAME" 2>/dev/null || true

# ============================================
# BUILD DOCKER RUN COMMAND
# ============================================

echo "🚀 Starting $IMAGE_NAME..."

DOCKER_CMD="docker run -d"
DOCKER_CMD="$DOCKER_CMD --name $CONTAINER_NAME"
DOCKER_CMD="$DOCKER_CMD --restart $RESTART_POLICY"

# Resource limits
DOCKER_CMD="$DOCKER_CMD --memory $MEMORY_LIMIT"
DOCKER_CMD="$DOCKER_CMD --cpus $CPU_LIMIT"

# GPU support
if [ "$IMAGE_VARIANT" = "gpu" ]; then
    DOCKER_CMD="$DOCKER_CMD --gpus device=$GPU_DEVICES"
    DOCKER_CMD="$DOCKER_CMD --runtime=nvidia"
    DOCKER_CMD="$DOCKER_CMD -e NVIDIA_VISIBLE_DEVICES=$GPU_DEVICES"
    DOCKER_CMD="$DOCKER_CMD -e NVIDIA_DRIVER_CAPABILITIES=all"
fi

# Volume mounts
DOCKER_CMD="$DOCKER_CMD -v $WORK_DIR:/work"
DOCKER_CMD="$DOCKER_CMD -v $DATA_DIR:/data"
if [ -n "$HOME_DIR" ]; then
    DOCKER_CMD="$DOCKER_CMD -v $HOME_DIR:/home/$CARBON_USER"
fi

# Port mappings - Base ports (all images)
DOCKER_CMD="$DOCKER_CMD -p $SSH_PORT:2222"
DOCKER_CMD="$DOCKER_CMD -p $RDP_PORT:3389"
DOCKER_CMD="$DOCKER_CMD -p $NOVNC_PORT:6900"
DOCKER_CMD="$DOCKER_CMD -p $VNC_PORT:5901"
DOCKER_CMD="$DOCKER_CMD -p $POSTGRES_PORT:5432"
DOCKER_CMD="$DOCKER_CMD -p $MYSQL_PORT:3306"
DOCKER_CMD="$DOCKER_CMD -p $MONGODB_PORT:27017"
DOCKER_CMD="$DOCKER_CMD -p $REDIS_PORT:6379"
DOCKER_CMD="$DOCKER_CMD -p $MOSQUITTO_PORT:1883"

# Port mappings - Compute specific
if [ "$IMAGE_TYPE" = "compute" ]; then
    DOCKER_CMD="$DOCKER_CMD -p $JUPYTER_PORT:8888"
    DOCKER_CMD="$DOCKER_CMD -p $CODE_SERVER_PORT:9999"
    DOCKER_CMD="$DOCKER_CMD -p 7077:7077"
    DOCKER_CMD="$DOCKER_CMD -p 8080:8080"
    DOCKER_CMD="$DOCKER_CMD -p 8081:8081"
fi

# Port mappings - GPU images
if [ "$IMAGE_VARIANT" = "gpu" ]; then
    DOCKER_CMD="$DOCKER_CMD -p $OLLAMA_PORT:11434"
fi

# Port mappings - Qdrant (if enabled)
if [ "${ENABLE_QDRANT:-false}" = "true" ]; then
    DOCKER_CMD="$DOCKER_CMD -p $QDRANT_HTTP_PORT:6333"
    DOCKER_CMD="$DOCKER_CMD -p $QDRANT_GRPC_PORT:6334"
fi

# Environment variables - Display & Auth
DOCKER_CMD="$DOCKER_CMD -e CARBON_PASSWORD=$CARBON_PASSWORD"
DOCKER_CMD="$DOCKER_CMD -e VNC_PASSWORD=$VNC_PASSWORD"
DOCKER_CMD="$DOCKER_CMD -e VNC_RESOLUTION=$VNC_RESOLUTION"
DOCKER_CMD="$DOCKER_CMD -e VNC_DEPTH=$VNC_DEPTH"
DOCKER_CMD="$DOCKER_CMD -e VNC_DISPLAY=$VNC_DISPLAY"
DOCKER_CMD="$DOCKER_CMD -e CODE_SERVER_PASSWORD=$CODE_SERVER_PASSWORD"
DOCKER_CMD="$DOCKER_CMD -e POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
DOCKER_CMD="$DOCKER_CMD -e TZ=$TZ"

# Environment variables - Service Toggles
# Databases default OFF to save resources
DOCKER_CMD="$DOCKER_CMD -e ENABLE_POSTGRESQL=${ENABLE_POSTGRESQL:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_MYSQL=${ENABLE_MYSQL:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_MONGODB=${ENABLE_MONGODB:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_REDIS=${ENABLE_REDIS:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_MOSQUITTO=${ENABLE_MOSQUITTO:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_QDRANT=${ENABLE_QDRANT:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_SSH=${ENABLE_SSH:-true}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_OLLAMA=${ENABLE_OLLAMA:-false}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_VLLM=${ENABLE_VLLM:-false}"
# Development tools default ON
DOCKER_CMD="$DOCKER_CMD -e ENABLE_JUPYTER=${ENABLE_JUPYTER:-true}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_CODE_SERVER=${ENABLE_CODE_SERVER:-true}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_SPARK=${ENABLE_SPARK:-true}"
# Desktop default ON
DOCKER_CMD="$DOCKER_CMD -e ENABLE_VNC=${ENABLE_VNC:-true}"
DOCKER_CMD="$DOCKER_CMD -e ENABLE_XRDP=${ENABLE_XRDP:-true}"

# Image
DOCKER_CMD="$DOCKER_CMD $IMAGE_NAME"

# ============================================
# RUN CONTAINER
# ============================================

echo ""
echo "🔧 Configuration:"
echo "   Image:      $IMAGE_NAME"
echo "   Password:   ${CARBON_PASSWORD:0:3}***"
echo "   Work Dir:   $WORK_DIR"
echo "   Data Dir:   $DATA_DIR"
echo "   Resolution: $VNC_RESOLUTION"
echo "   Memory:     $MEMORY_LIMIT"
echo "   CPUs:       $CPU_LIMIT"
if [ "$IMAGE_VARIANT" = "gpu" ]; then
echo "   GPU:        $GPU_DEVICES"
fi
echo ""

eval $DOCKER_CMD

# ============================================
# WAIT FOR STARTUP
# ============================================

echo "⏳ Waiting for services to initialize..."
sleep 35

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

# ============================================
# DISPLAY ACCESS INFORMATION
# ============================================

echo ""
echo "✅ Carbon container is running!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          🌐 ACCESS INFORMATION                            ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🖥️  DESKTOP ACCESS:"
echo "   🌐 Web (noVNC):  http://${SERVER_IP}:${NOVNC_PORT}"
echo "                    http://localhost:${NOVNC_PORT}"
echo "   🖥️  RDP (xrdp):   ${SERVER_IP}:${RDP_PORT}"
echo "                    User: $CARBON_USER"
echo "                    Pass: ${CARBON_PASSWORD:0:3}***"
echo "   🔌 VNC Client:   ${SERVER_IP}:${VNC_PORT}"
echo "                    Pass: ${VNC_PASSWORD:0:3}***"
echo ""

if [ "$IMAGE_TYPE" = "compute" ]; then
echo "📓 DEVELOPMENT:"
echo "   Jupyter Lab:     http://${SERVER_IP}:${JUPYTER_PORT}"
echo "   code-server:     http://${SERVER_IP}:${CODE_SERVER_PORT}"
echo "                    Pass: ${CODE_SERVER_PASSWORD:0:3}***"
echo ""
fi

echo "🗄️  DATABASES:"
echo "   PostgreSQL:      ${SERVER_IP}:${POSTGRES_PORT}"
echo "   MongoDB:         ${SERVER_IP}:${MONGODB_PORT}"
echo "   Redis:           ${SERVER_IP}:${REDIS_PORT}"
echo ""

if [ "$IMAGE_VARIANT" = "gpu" ]; then
echo "🎮 GPU STATUS:"
docker exec $CONTAINER_NAME nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo "   GPU info unavailable"
echo ""
fi

echo "📊 SERVICE STATUS:"
docker exec $CONTAINER_NAME supervisorctl status 2>&1 | head -15
echo ""
echo "🛑 TO STOP:"
echo "   docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME"
echo ""
echo "═══════════════════════════════════════════════════════════"
