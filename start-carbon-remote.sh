#!/bin/bash
# Start carbon-base for remote access

echo "🚀 Starting carbon-base with remote access enabled..."

# Clean up existing
docker stop carbon-remote 2>/dev/null || true
docker rm carbon-remote 2>/dev/null || true

# Start with all interfaces bound (0.0.0.0)
docker run -d \
  --name carbon-remote \
  -v /tmp/carbon-remote-data:/data \
  -p 0.0.0.0:2222:2222 \
  -p 0.0.0.0:3390:3389 \
  -p 0.0.0.0:6900:6900 \
  -p 0.0.0.0:5900:5901 \
  -p 0.0.0.0:5432:5432 \
  -p 0.0.0.0:27017:27017 \
  -p 0.0.0.0:6379:6379 \
  wisejnrs/carbon-base:latest-minimal

echo "⏳ Waiting for services to start..."
sleep 35

# Get server IP
SERVER_IP=$(hostname -I | awk '{print $1}')

echo ""
echo "✅ Carbon-base is running and accessible remotely!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║            🌐 REMOTE ACCESS INFORMATION                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "From ANY computer on your network, access:"
echo ""
echo "🌐 Web Desktop (noVNC):"
echo "   → http://${SERVER_IP}:6900"
echo "   → No VNC client needed - just a web browser!"
echo ""
echo "🖥️  Remote Desktop (RDP):"
echo "   → Host: ${SERVER_IP}:3390"
echo "   → User: carbon, Pass: Carbon123#"
echo "   → (Port 3390 to avoid conflict with Windows RDP)"
echo ""
echo "🖥️  VNC Client:"
echo "   → Host: ${SERVER_IP}"
echo "   → Port: 5900"
echo "   → Use any VNC viewer (TigerVNC, RealVNC, etc.)"
echo ""
echo "🗄️  Databases:"
echo "   → PostgreSQL: ${SERVER_IP}:5432"
echo "   → MongoDB:    ${SERVER_IP}:27017"
echo "   → Redis:      ${SERVER_IP}:6379"
echo ""
echo "📱 From your laptop/phone/tablet:"
echo "   Just navigate to: http://${SERVER_IP}:6900"
echo ""
echo "🛑 TO STOP:"
echo "   docker stop carbon-remote && docker rm carbon-remote"
echo ""
echo "═══════════════════════════════════════════════════════════"
docker exec carbon-remote supervisorctl status 2>&1 | head -10
