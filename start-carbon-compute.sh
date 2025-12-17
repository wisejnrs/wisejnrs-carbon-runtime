#!/bin/bash
# Start carbon-compute with GPU, Jupyter, code-server, and Spark
set -e

echo "🚀 Starting carbon-compute with full ML/AI stack..."

# Clean up existing container
docker stop carbon-compute 2>/dev/null || true
docker rm carbon-compute 2>/dev/null || true

# Get server IP for display
SERVER_IP=$(hostname -I | awk '{print $1}')

# Start with GPU support and all services
docker run -d \
  --name carbon-compute \
  --gpus all \
  --runtime=nvidia \
  -v /tmp/carbon-compute-data:/data \
  -v /tmp/carbon-compute-work:/work \
  -p 0.0.0.0:2222:2222 \
  -p 0.0.0.0:3390:3389 \
  -p 0.0.0.0:6900:6900 \
  -p 0.0.0.0:5900:5901 \
  -p 0.0.0.0:8888:8888 \
  -p 0.0.0.0:9999:9999 \
  -p 0.0.0.0:5432:5432 \
  -p 0.0.0.0:27017:27017 \
  -p 0.0.0.0:6379:6379 \
  -p 0.0.0.0:11434:11434 \
  -p 0.0.0.0:7077:7077 \
  -p 0.0.0.0:8080:8080 \
  -p 0.0.0.0:8081:8081 \
  -e NVIDIA_VISIBLE_DEVICES=all \
  -e NVIDIA_DRIVER_CAPABILITIES=all \
  -e CODE_SERVER_PASSWORD=Carbon123# \
  wisejnrs/carbon-compute:latest

echo "⏳ Waiting 40 seconds for services to initialize..."
sleep 40

echo ""
echo "✅ Carbon-compute is running with full ML/AI stack!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║         🧪 CARBON COMPUTE - ACCESS INFORMATION           ║"
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
echo "📓 DEVELOPMENT ENVIRONMENTS:"
echo "   Jupyter Lab:     http://${SERVER_IP}:8888"
echo "                    http://localhost:8888 (local)"
echo "   code-server:     http://${SERVER_IP}:9999"
echo "                    http://localhost:9999 (local)"
echo "                    Password: Carbon123#"
echo ""
echo "🤖 AI/ML SERVICES:"
echo "   Ollama API:      http://${SERVER_IP}:11434"
echo "   vLLM (if enabled): Check container logs"
echo ""
echo "⚡ SPARK CLUSTER:"
echo "   Master UI:       http://${SERVER_IP}:8080"
echo "   Worker UI:       http://${SERVER_IP}:8081"
echo "   Master URL:      spark://${SERVER_IP}:7077"
echo ""
echo "🗄️  DATABASES:"
echo "   PostgreSQL:      ${SERVER_IP}:5432 (user: postgres/carbon)"
echo "   MongoDB:         ${SERVER_IP}:27017 (user: carbon)"
echo "   Redis:           ${SERVER_IP}:6379"
echo ""
echo "🎮 GPU STATUS:"
docker exec carbon-compute nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo "   GPU info unavailable (may need driver setup)"
echo ""
echo "📊 SERVICE STATUS:"
docker exec carbon-compute supervisorctl status 2>&1 | head -20
echo ""
echo "📝 JUPYTER TOKEN (if needed):"
docker exec carbon-compute bash -c "jupyter server list 2>/dev/null | grep -oP 'token=\K[^ ]+' | head -1" || echo "   Use noVNC/xrdp to access desktop and check logs"
echo ""
echo "🛑 TO STOP:"
echo "   docker stop carbon-compute && docker rm carbon-compute"
echo ""
echo "═══════════════════════════════════════════════════════════"
