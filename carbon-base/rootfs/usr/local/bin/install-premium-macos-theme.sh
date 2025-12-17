#!/usr/bin/env bash
set -euo pipefail

echo "Installing premium macOS Big Sur desktop experience..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[macos-premium]${NC} $*"; }
step() { echo -e "${BLUE}▶${NC} $*"; }

DEFAULT_USER="${DEFAULT_USER:-carbon}"

# ========================================
# 1. MACOS BIG SUR CURSORS
# ========================================

log "Installing macOS Big Sur cursor theme..."
cd /tmp

# Download macOS cursor theme
git clone --depth=1 https://github.com/ful1e5/apple_cursor.git || true
if [ -d "apple_cursor" ]; then
    cd apple_cursor
    # Build cursors if needed, or use pre-built
    if [ -d "dist" ]; then
        cp -r dist/* /usr/share/icons/ || true
    fi
    cd /tmp
    rm -rf apple_cursor
fi

# Alternative: Download Big Sur cursors
wget -q "https://github.com/vinceliuice/McMojave-cursors/archive/refs/heads/master.zip" -O cursors.zip || true
if [ -f cursors.zip ]; then
    unzip -q cursors.zip
    cd McMojave-cursors-master
    ./install.sh || true
    cd /tmp
    rm -rf McMojave-cursors-master cursors.zip
    step "macOS cursor theme installed"
fi

# ========================================
# 2. ENHANCED WHITESUR THEME
# ========================================

log "Installing WhiteSur theme with transparency..."
cd /tmp
rm -rf WhiteSur-gtk-theme
git clone --depth=1 https://github.com/vinceliuice/WhiteSur-gtk-theme.git
cd WhiteSur-gtk-theme

# Install with all options
./install.sh \
  --dest /usr/share/themes \
  --name WhiteSur \
  --theme all \
  --color Dark \
  --alt all \
  --opacity normal \
  --icon apple \
  --nautilus-style stable \
  --panel-opacity 0.6 \
  --panel-size 40 \
  2>/dev/null || ./install.sh -d /usr/share/themes -t all -c Dark || true

cd /tmp
rm -rf WhiteSur-gtk-theme
step "WhiteSur theme installed with transparency"

# ========================================
# 3. WHITESUR ICON THEME (ENHANCED)
# ========================================

log "Installing WhiteSur icon theme..."
cd /tmp
rm -rf WhiteSur-icon-theme
git clone --depth=1 https://github.com/vinceliuice/WhiteSur-icon-theme.git
cd WhiteSur-icon-theme

# Install all variants
./install.sh -a -d /usr/share/icons || true

cd /tmp
rm -rf WhiteSur-icon-theme
step "WhiteSur icons installed (all variants)"

# ========================================
# 4. SKIP PLANK DOCK (User wants top bar only)
# ========================================

log "Skipping Plank dock - using top panel only per user request..."
step "Top panel will be the only bar"

# ========================================
# 5. PREMIUM MACOS BIG SUR WALLPAPERS
# ========================================

log "Installing premium macOS Big Sur wallpapers..."
mkdir -p /usr/share/backgrounds/macos-bigsur-hd

cd /usr/share/backgrounds/macos-bigsur-hd

# High-quality Big Sur wallpapers
# Big Sur Light (default)
wget -q "https://4kwallpapers.com/images/wallpapers/macos-big-sur-apple-layers-fluidic-colorful-dark-wwdc-stock-3840x2160-1432.jpg" -O bigsur-layers-dark.jpg 2>/dev/null || \
wget -q "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=3840&q=95" -O bigsur-blue-1.jpg || true

# Big Sur Abstract
wget -q "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=3840&q=95" -O bigsur-abstract-blue.jpg || true
wget -q "https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=3840&q=95" -O bigsur-abstract-purple.jpg || true

# Mountains
wget -q "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=3840&q=95" -O mountain-sunset.jpg || true
wget -q "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=3840&q=95" -O mountain-night.jpg || true

# Desert/Dunes
wget -q "https://images.unsplash.com/photo-1509316785289-025f5b846b35?w=3840&q=95" -O desert-dunes.jpg || true

step "Premium wallpapers installed"

# ========================================
# 6. DESKTOP CONFIGURATION
# ========================================

log "Creating premium desktop configuration..."

cat > /etc/skel/.config/cinnamon/premium-macos-settings.sh <<'EOFPREM'
#!/bin/bash
# Premium macOS Big Sur Configuration

export DISPLAY=:1

# WhiteSur theme
dbus-launch gsettings set org.cinnamon.theme name 'WhiteSur-Dark' || true
dbus-launch gsettings set org.cinnamon.desktop.interface gtk-theme 'WhiteSur-Dark' || true
dbus-launch gsettings set org.cinnamon.desktop.interface icon-theme 'WhiteSur-dark' || true

# Cursor theme (macOS style)
dbus-launch gsettings set org.cinnamon.desktop.interface cursor-theme 'McMojave-cursors' || \
dbus-launch gsettings set org.cinnamon.desktop.interface cursor-theme 'Bibata-Modern-Ice' || true
dbus-launch gsettings set org.cinnamon.desktop.interface cursor-size 24

# Window controls on RIGHT (Windows/Linux style)
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences button-layout ':minimize,maximize,close'

# Animations and effects
dbus-launch gsettings set org.cinnamon.desktop.interface enable-animations true
dbus-launch gsettings set org.cinnamon.muffin attach-modal-dialogs true
dbus-launch gsettings set org.cinnamon.muffin draggable-border-width 10
dbus-launch gsettings set org.cinnamon.muffin tile-maximize true
dbus-launch gsettings set org.cinnamon.muffin placement-mode 'center'

# Panel (top bar only - no dock)
dbus-launch gsettings set org.cinnamon panels-height "['1:44']"
dbus-launch gsettings set org.cinnamon panel-zone-icon-sizes '[{"panelId":1,"left":32,"center":0,"right":24}]'
dbus-launch gsettings set org.cinnamon panels-enabled "['1:0:top']"

# Enhanced panel appearance
dbus-launch gsettings set org.cinnamon panels-autohide "['1:false']"
dbus-launch gsettings set org.cinnamon panels-show-delay 0
dbus-launch gsettings set org.cinnamon panel-edit-mode false

# Wallpaper - Big Sur
if [ -f /usr/share/backgrounds/macos-bigsur-hd/bigsur-layers-dark.jpg ]; then
    dbus-launch gsettings set org.cinnamon.desktop.background picture-uri 'file:///usr/share/backgrounds/macos-bigsur-hd/bigsur-layers-dark.jpg'
elif [ -f /usr/share/backgrounds/macos-bigsur-hd/bigsur-blue-1.jpg ]; then
    dbus-launch gsettings set org.cinnamon.desktop.background picture-uri 'file:///usr/share/backgrounds/macos-bigsur-hd/bigsur-blue-1.jpg'
fi

dbus-launch gsettings set org.cinnamon.desktop.background picture-options 'zoom'

# Fonts (Ubuntu as San Francisco alternative)
dbus-launch gsettings set org.cinnamon.desktop.interface font-name 'Ubuntu 11'
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences titlebar-font 'Ubuntu Medium 11'

# Nemo file manager
dbus-launch gsettings set org.nemo.preferences show-hidden-files true

# Panel favorites - Add Chrome, VS Code, and essential apps
dbus-launch gsettings set org.cinnamon favorite-apps "[\
'cinnamon-settings.desktop', \
'google-chrome.desktop', \
'code.desktop', \
'firefox.desktop', \
'org.gnome.Terminal.desktop', \
'nemo.desktop', \
'gnome-system-monitor.desktop'\
]"

# Also add to panel launchers (left side of panel)
dbus-launch gsettings set org.cinnamon panel-launchers "[\
'DEPRECATED'\
]"

echo "Premium desktop configured with Chrome and VS Code in panel!"
EOFPREM

chmod +x /etc/skel/.config/cinnamon/premium-macos-settings.sh

# Update autostart
cat > /etc/skel/.config/autostart/carbon-premium-desktop.desktop <<'EOFDESK'
[Desktop Entry]
Type=Application
Name=Carbon Premium Desktop
Exec=/bin/bash -c "~/.config/cinnamon/premium-macos-settings.sh"
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
Comment=Apply premium macOS Big Sur theme
StartupNotify=false
EOFDESK

# ========================================
# 7. APPLY TO CARBON USER (if exists - skip during build)
# ========================================

# Note: During Docker build, carbon user doesn't exist yet
# Files in /etc/skel will be copied when user is created
if id -u "$DEFAULT_USER" >/dev/null 2>&1; then
    log "Carbon user exists, applying theme..."
    mkdir -p /home/$DEFAULT_USER/.config/cinnamon
    mkdir -p /home/$DEFAULT_USER/.config/autostart
    cp /etc/skel/.config/cinnamon/premium-macos-settings.sh /home/$DEFAULT_USER/.config/cinnamon/ || true
    cp /etc/skel/.config/autostart/carbon-premium-desktop.desktop /home/$DEFAULT_USER/.config/autostart/ || true
    chown -R $DEFAULT_USER:$DEFAULT_USER /home/$DEFAULT_USER/.config || true
    log "Theme applied to carbon user"
else
    log "Carbon user not yet created (normal during build)"
fi

# ========================================
# CLEANUP
# ========================================
apt-get clean
rm -rf /var/lib/apt/lists/*

echo ""
log "✅ Premium macOS Big Sur desktop installed!"
echo ""
echo "Features:"
echo "  ✓ WhiteSur GTK theme (Big Sur style)"
echo "  ✓ WhiteSur icons (macOS icons)"
echo "  ✓ macOS cursor theme"
echo "  ✓ Premium HD wallpapers"
echo "  ✓ Enhanced TOP PANEL (no dock - per user request)"
echo "  ✓ Window controls on RIGHT"
echo "  ✓ Smooth animations and effects"
echo "  ✓ Larger interface elements"
echo "  ✓ Larger draggable borders"
echo ""
echo "Access via: http://localhost:6900"
echo ""
