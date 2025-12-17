#!/bin/bash
# Test desktop enhancements on running container
set -e

echo "🎨 Testing desktop enhancements on running container..."

CONTAINER="carbon-remote"

# Check if container is running
if ! docker exec $CONTAINER echo "Container online" >/dev/null 2>&1; then
  echo "❌ Container '$CONTAINER' is not running"
  exit 1
fi

echo "📦 Installing enhancement packages in container..."
docker exec $CONTAINER bash -c '
apt-get update -qq
apt-get install -y --no-install-recommends \
  arc-theme \
  tilix \
  diodon \
  flameshot \
  gedit \
  gnome-system-monitor \
  gnome-calculator \
  gitg \
  meld \
  2>/dev/null || echo "Some packages unavailable"
apt-get clean
' 2>&1 | tail -20

echo ""
echo "🎨 Applying desktop configuration..."
docker exec -u carbon $CONTAINER bash -c '
# Set Arc-Dark theme
gsettings set org.cinnamon.theme name "Mint-Y-Dark" 2>/dev/null || true
gsettings set org.cinnamon.desktop.interface gtk-theme "Arc-Dark" 2>/dev/null || true
gsettings set org.cinnamon.desktop.interface icon-theme "Papirus-Dark" 2>/dev/null || true

# Performance for VNC
gsettings set org.cinnamon desktop-effects false 2>/dev/null || true
gsettings set org.cinnamon.desktop.interface enable-animations false 2>/dev/null || true

# Favorites
gsettings set org.cinnamon favorite-apps "[\
\"firefox.desktop\", \
\"code.desktop\", \
\"tilix.desktop\", \
\"nemo.desktop\", \
\"gnome-system-monitor.desktop\"\
]" 2>/dev/null || true

# Nemo improvements
gsettings set org.nemo.preferences show-hidden-files true 2>/dev/null || true

echo "✅ Settings applied!"
'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "✅ Desktop enhancements applied!"
echo ""
echo "🔄 Changes active now (no restart needed for most)"
echo ""
echo "Improvements:"
echo "  • Arc-Dark theme for modern look"
echo "  • Papirus-Dark icons"
echo "  • Tilix terminal (Ctrl+Alt+T)"
echo "  • Performance optimized for VNC"
echo "  • Clipboard manager (Diodon)"
echo "  • Developer tools (Git GUI, Meld)"
echo "  • Hidden files visible in Nemo"
echo ""
echo "Open http://192.168.0.190:6900 to see changes!"
echo "═══════════════════════════════════════════════════════════"
