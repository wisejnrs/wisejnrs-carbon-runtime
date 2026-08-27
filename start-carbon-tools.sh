#!/bin/bash
# Start carbon-tools with creative and security tools
set -e

echo "🚀 Starting carbon-tools with creative, security, and DevOps tools..."

# Parse arguments
USE_GPU=false
if [[ "$1" == "--gpu" ]]; then
  USE_GPU=true
  IMAGE_TAG="latest-gpu"
else
  IMAGE_TAG="latest-minimal"
fi

# Clean up existing container
docker stop carbon-tools 2>/dev/null || true
docker rm carbon-tools 2>/dev/null || true

# Get server IP for display
SERVER_IP=$(hostname -I | awk '{print $1}')

# Build docker run command
DOCKER_CMD="docker run -d \
  --name carbon-tools \
  -v /tmp/carbon-tools-data:/data \
  -v /tmp/carbon-tools-work:/work"

# Add GPU support if requested
if [ "$USE_GPU" = true ]; then
  DOCKER_CMD="$DOCKER_CMD \
  --gpus all \
  --runtime=nvidia \
  -e NVIDIA_VISIBLE_DEVICES=all \
  -e NVIDIA_DRIVER_CAPABILITIES=all"
fi

# Add port mappings and image
DOCKER_CMD="$DOCKER_CMD \
  -p 0.0.0.0:2222:2222 \
  -p 0.0.0.0:3390:3389 \
  -p 0.0.0.0:6900:6900 \
  -p 0.0.0.0:5900:5901 \
  -p 0.0.0.0:5432:5432 \
  -p 0.0.0.0:27017:27017 \
  -p 0.0.0.0:6379:6379 \
  -p 0.0.0.0:8080:8080 \
  -p 0.0.0.0:3000:3000 \
  wisejnrs/carbon-tools:${IMAGE_TAG}"

# Execute
eval $DOCKER_CMD

echo "⏳ Waiting 35 seconds for services to initialize..."
sleep 35

echo ""
echo "✅ Carbon-tools is running!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║          🛠️  CARBON TOOLS - ACCESS INFORMATION           ║"
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
echo "🎨 CREATIVE TOOLS (Available in Desktop):"
echo "   • Blender (3D modeling)"
echo "   • GIMP (image editing)"
echo "   • Inkscape (vector graphics)"
echo "   • Krita (digital painting)"
echo "   • Kdenlive (video editing)"
echo "   • Audacity (audio editing)"
echo "   • OBS Studio (streaming/recording)"
echo "   • Scribus (desktop publishing)"
echo ""
echo "🔒 SECURITY TOOLS (CLI):"
echo "   • nmap, nikto, sqlmap"
echo "   • Wireshark (GUI in desktop)"
echo "   • Hydra, hashcat"
echo "   • theHarvester, sherlock"
echo "   • SecLists: /usr/share/seclists"
echo ""
echo "🎮 RETRO EMULATION (Available in Desktop):"
echo "   • VICE (C64)"
echo "   • RetroArch (multi-system)"
echo "   • MAME (arcade)"
echo "   • ROMs directory: /roms"
echo ""
echo "☁️  DEVOPS TOOLS (CLI):"
echo "   • Docker CLI"
echo "   • kubectl"
echo "   • Terraform"
echo "   • Ansible"
echo "   • GitHub CLI (gh)"
echo ""
echo "🗄️  DATABASES:"
echo "   PostgreSQL:      ${SERVER_IP}:5432 (user: postgres/carbon)"
echo "   MongoDB:         ${SERVER_IP}:27017 (user: carbon)"
echo "   Redis:           ${SERVER_IP}:6379"
echo ""
if [ "$USE_GPU" = true ]; then
  echo "🎮 GPU STATUS:"
  docker exec carbon-tools nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader 2>/dev/null || echo "   GPU info unavailable"
  echo ""
fi
echo "📊 SERVICE STATUS:"
docker exec carbon-tools supervisorctl status 2>&1 | head -15
echo ""
echo "💡 TIP: Access the desktop via noVNC (web browser) or xrdp (RDP client)"
echo "    to use the GUI creative tools, games, and emulators!"
echo ""
echo "🛑 TO STOP:"
echo "   docker stop carbon-tools && docker rm carbon-tools"
echo ""
echo "═══════════════════════════════════════════════════════════"
