#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║     🖥️  CARBON-BASE DESKTOP TEST - LIVE DEMO 🖥️         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# Clean up any existing test
docker stop carbon-demo 2>/dev/null || true
docker rm carbon-demo 2>/dev/null || true

echo "🚀 Starting carbon-base desktop container..."
docker run -d \
  --name carbon-demo \
  -v /tmp/carbon-demo-data:/data \
  -p 6900:6900 \
  -p 5432:5432 \
  -p 27017:27017 \
  -p 6379:6379 \
  wisejnrs/carbon-base:latest-minimal

echo "⏳ Waiting 35 seconds for all services to start..."
sleep 35

echo ""
echo "✅ Container started successfully!"
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║                  🌐 ACCESS INFORMATION                    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "🌐 WEB DESKTOP ACCESS:"
echo "   → http://localhost:6900"
echo "   → Click 'Connect' button"
echo "   → Full Cinnamon desktop loads in browser!"
echo ""
echo "🖥️  VNC CLIENT ACCESS (alternative):"
echo "   → Host: localhost"
echo "   → Port: 5900"
echo "   → Password: (stored in container)"
echo ""
echo "🗄️  DATABASE ACCESS:"
echo "   → PostgreSQL: localhost:5432 (user: postgres)"
echo "   → MongoDB:    localhost:27017"
echo "   → Redis:      localhost:6379"
echo ""
echo "🔍 SERVICE STATUS:"
docker exec carbon-demo supervisorctl status 2>&1 | grep -E "RUNNING|FATAL" || true
echo ""
echo "📊 CONTAINER INFO:"
echo "   Name: carbon-demo"
echo "   Data: /tmp/carbon-demo-data"
echo ""
echo "🎯 TO STOP:"
echo "   docker stop carbon-demo && docker rm carbon-demo"
echo ""
echo "═══════════════════════════════════════════════════════════"
echo "Open http://localhost:6900 NOW to see the desktop! 🚀"
echo "═══════════════════════════════════════════════════════════"
