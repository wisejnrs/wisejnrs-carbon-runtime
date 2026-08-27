#!/bin/bash
# Start Carbon optimized for Raspberry Pi / IoT Server
# Headless configuration with SSH, MySQL, Mosquitto, Next.js, Ollama

set -e

echo "🍓 Starting Carbon for Raspberry Pi / IoT Server..."

# Load Pi-specific configuration
if [ -f .env.pi-server ]; then
    echo "📋 Loading Raspberry Pi configuration..."
    set -a
    source .env.pi-server
    set +a
else
    echo "⚠️  .env.pi-server not found, using defaults"
    echo "   Copy .env.pi-server.example to .env.pi-server and customize"
fi

# Defaults for Pi server
CONTAINER_NAME="${CONTAINER_NAME:-carbon-pi}"
IMAGE_NAME="${IMAGE_NAME:-wisejnrs/carbon-base:latest-minimal}"
SSH_PORT="${SSH_PORT:-2222}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MOSQUITTO_PORT="${MOSQUITTO_PORT:-1883}"
NEXTJS_PORT="${NEXTJS_PORT:-3000}"
REDIS_PORT="${REDIS_PORT:-6379}"
OLLAMA_PORT="${OLLAMA_PORT:-11434}"
WORK_DIR="${WORK_DIR:-./work}"
DATA_DIR="${DATA_DIR:-./data}"
MEMORY_LIMIT="${MEMORY_LIMIT:-6g}"
CPU_LIMIT="${CPU_LIMIT:-4}"

# Clean up existing
docker stop $CONTAINER_NAME 2>/dev/null || true
docker rm $CONTAINER_NAME 2>/dev/null || true

# Prepare directories
mkdir -p "$WORK_DIR" "$DATA_DIR"

echo ""
echo "🔧 Pi Server Configuration:"
echo "   Container: $CONTAINER_NAME"
echo "   Memory:    $MEMORY_LIMIT"
echo "   CPUs:      $CPU_LIMIT"
echo "   Workspace: $WORK_DIR"
echo ""

# Start container
docker run -d \
  --name $CONTAINER_NAME \
  --restart always \
  -v "$WORK_DIR:/work" \
  -v "$DATA_DIR:/data" \
  -p $SSH_PORT:2222 \
  -p $MYSQL_PORT:3306 \
  -p $MOSQUITTO_PORT:1883 \
  -p $NEXTJS_PORT:3000 \
  -p $REDIS_PORT:6379 \
  -p $OLLAMA_PORT:11434 \
  --memory $MEMORY_LIMIT \
  --cpus $CPU_LIMIT \
  -e ENABLE_VNC=false \
  -e ENABLE_XRDP=false \
  -e ENABLE_SSH=true \
  -e ENABLE_MYSQL=true \
  -e ENABLE_POSTGRESQL=false \
  -e ENABLE_MONGODB=false \
  -e ENABLE_REDIS=true \
  -e ENABLE_MOSQUITTO=true \
  -e ENABLE_OLLAMA=${ENABLE_OLLAMA:-false} \
  -e SSH_PORT=2222 \
  -e MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-Carbon123#}" \
  $IMAGE_NAME

echo "⏳ Waiting 30 seconds for services to start..."
sleep 30

# Get server info
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Carbon Pi Server is running!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║       🍓 RASPBERRY PI / IOT SERVER ACCESS                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🔐 SSH ACCESS (Primary):"
echo "   ssh -p $SSH_PORT carbon@${SERVER_IP}"
echo "   ssh -p $SSH_PORT carbon@localhost"
echo "   Password: (your CARBON_PASSWORD)"
echo ""
echo "🗄️  DATABASES:"
echo "   MySQL:      ${SERVER_IP}:${MYSQL_PORT}"
echo "   Redis:      ${SERVER_IP}:${REDIS_PORT}"
echo ""
echo "📡 IOT / MESSAGING:"
echo "   MQTT:       ${SERVER_IP}:${MOSQUITTO_PORT}"
echo "   Protocol:   mqtt://${SERVER_IP}:${MOSQUITTO_PORT}"
echo ""
echo "🌐 WEB APPLICATION:"
echo "   Next.js:    http://${SERVER_IP}:${NEXTJS_PORT}"
echo ""
if [ "${ENABLE_OLLAMA:-false}" = "true" ]; then
echo "🤖 AI (Optional):"
echo "   Ollama API: http://${SERVER_IP}:${OLLAMA_PORT}"
echo ""
fi
echo "📊 SERVICE STATUS:"
docker exec $CONTAINER_NAME supervisorctl status 2>&1 | head -15
echo ""
echo "💡 QUICK COMMANDS:"
echo "   Connect:    ssh -p $SSH_PORT carbon@${SERVER_IP}"
echo "   Logs:       docker logs -f $CONTAINER_NAME"
echo "   Shell:      docker exec -it $CONTAINER_NAME bash"
echo "   Stop:       docker stop $CONTAINER_NAME"
echo ""
echo "📝 CONFIGURATION:"
echo "   Edit: .env.pi-server"
echo "   Docs: See RASPBERRY-PI.md"
echo ""
echo "═══════════════════════════════════════════════════════════"
