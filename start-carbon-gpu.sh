#!/bin/bash
# Start carbon-base with GPU and VNC support
set -e

echo "🚀 Starting carbon-base with GPU and VNC enabled..."

# Clean up existing container
docker stop carbon-gpu 2>/dev/null || true
docker rm carbon-gpu 2>/dev/null || true

# Get server IP for display
SERVER_IP=$(hostname -I | awk '{print $1}')

# Start with GPU support and all services
docker run -d \
  --name carbon-gpu \
  --gpus all \
  --runtime=nvidia \
  -v /tmp/carbon-gpu-data:/data \
  -p 0.0.0.0:2222:2222 \
  -p 0.0.0.0:3390:3389 \
  -p 0.0.0.0:6900:6900 \
  -p 0.0.0.0:5900:5901 \
  -p 0.0.0.0:5432:5432 \
  -p 0.0.0.0:27017:27017 \
  -p 0.0.0.0:6379:6379 \
  -p 0.0.0.0:11434:11434 \
  -e NVIDIA_VISIBLE_DEVICES=all \
  -e NVIDIA_DRIVER_CAPABILITIES=all \
  wisejnrs/carbon-base:latest-gpu

echo "⏳ Waiting 30 seconds for services to initialize..."
sleep 30

echo ""
echo "✅ Carbon-base is running with GPU support!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║            🌐 ACCESS INFORMATION                          ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🖥️  DESKTOP ACCESS:"
echo "   🌐 Web (noVNC):  http://${SERVER_IP}:6900"
echo "                    http://localhost:6900 (local)"
echo "   🖥️  RDP (xrdp):   ${SERVER_IP}:3390"
echo "                    User: carbon, Pass: Carbon123#"
echo "   🔌 VNC Client:   ${SERVER_IP}:5900"
echo "                    Password: Carbon123#"
echo ""
echo "🔐 SSH ACCESS:"
echo "   ssh -p 2222 carbon@${SERVER_IP}"
echo "   Password: Carbon123#"
echo ""
echo "🤖 AI/ML SERVICES:"
echo "   Ollama API:      http://${SERVER_IP}:11434"
echo "   vLLM (if enabled): Check container logs"
echo ""
echo "🗄️  DATABASES:"
echo "   PostgreSQL:      ${SERVER_IP}:5432 (user: postgres/carbon)"
echo "   MongoDB:         ${SERVER_IP}:27017 (user: carbon)"
echo "   Redis:           ${SERVER_IP}:6379"
echo ""
echo "🎮 GPU STATUS:"
docker exec carbon-gpu nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo "   GPU info unavailable (may need driver setup)"
echo ""
echo "📊 SERVICE STATUS:"
docker exec carbon-gpu supervisorctl status 2>&1 | head -15
echo ""
echo "🛑 TO STOP:"
echo "   docker stop carbon-gpu && docker rm carbon-gpu"
echo ""
echo "═══════════════════════════════════════════════════════════"
