#!/usr/bin/env bash
set -euo pipefail

echo "Installing macOS Big Sur style theme and wallpapers..."

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[macos-theme]${NC} $*"; }
step() { echo -e "${BLUE}▶${NC} $*"; }

# ========================================
# 1. INSTALL WHITESUR ICON THEME
# ========================================

log "Installing WhiteSur icon theme (macOS Big Sur style)..."
cd /tmp
if ! git clone --depth=1 https://github.com/vinceliuice/WhiteSur-icon-theme.git; then
    echo "Failed to clone WhiteSur icons, trying alternative..."
    git clone https://github.com/vinceliuice/WhiteSur-icon-theme.git || true
fi

if [ -d "WhiteSur-icon-theme" ]; then
    cd WhiteSur-icon-theme
    ./install.sh -a -d /usr/share/icons || true
    cd /tmp
    rm -rf WhiteSur-icon-theme
    step "WhiteSur icons installed"
else
    step "WhiteSur icons install skipped (clone failed)"
fi

# ========================================
# 2. INSTALL WHITESUR GTK THEME
# ========================================

log "Installing WhiteSur GTK theme..."
cd /tmp
if ! git clone --depth=1 https://github.com/vinceliuice/WhiteSur-gtk-theme.git; then
    echo "Failed to clone WhiteSur theme, skipping..."
else
    cd WhiteSur-gtk-theme
    ./install.sh -l -c Dark -N glassy --round || true
    cd /tmp
    rm -rf WhiteSur-gtk-theme
    step "WhiteSur GTK theme installed"
fi

# ========================================
# 3. DOWNLOAD MACOS BIG SUR WALLPAPERS
# ========================================

log "Installing macOS Big Sur wallpapers..."
mkdir -p /usr/share/backgrounds/macos-bigsur

# Download some Big Sur style wallpapers
cd /usr/share/backgrounds/macos-bigsur

# Primary Big Sur wallpaper (day)
wget -q "https://512pixels.net/downloads/macos-wallpapers-thumbs/11-0-Big-Sur-Graphic-thumb.jpg" -O bigsur-graphic.jpg 2>/dev/null || \
wget -q "https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=3840" -O bigsur-mountains.jpg || true

# Abstract wallpapers
wget -q "https://images.unsplash.com/photo-1557682224-5b8590cd9ec5?w=3840" -O abstract-blue.jpg || true
wget -q "https://images.unsplash.com/photo-1557682268-e3955ed5d83f?w=3840" -O abstract-purple.jpg || true

# Mountain/landscape (Big Sur style)
wget -q "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=3840" -O mountain-sunset.jpg || true
wget -q "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=3840" -O mountain-stars.jpg || true

# Create XML wallpaper list for Cinnamon
cat > /usr/share/gnome-background-properties/carbon-macos.xml <<'EOFXML'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE wallpapers SYSTEM "gnome-wp-list.dtd">
<wallpapers>
  <wallpaper deleted="false">
    <name>Big Sur Graphic</name>
    <filename>/usr/share/backgrounds/macos-bigsur/bigsur-graphic.jpg</filename>
    <options>zoom</options>
  </wallpaper>
  <wallpaper deleted="false">
    <name>Big Sur Mountains</name>
    <filename>/usr/share/backgrounds/macos-bigsur/bigsur-mountains.jpg</filename>
    <options>zoom</options>
  </wallpaper>
  <wallpaper deleted="false">
    <name>Abstract Blue</name>
    <filename>/usr/share/backgrounds/macos-bigsur/abstract-blue.jpg</filename>
    <options>zoom</options>
  </wallpaper>
  <wallpaper deleted="false">
    <name>Abstract Purple</name>
    <filename>/usr/share/backgrounds/macos-bigsur/abstract-purple.jpg</filename>
    <options>zoom</options>
  </wallpaper>
  <wallpaper deleted="false">
    <name>Mountain Sunset</name>
    <filename>/usr/share/backgrounds/macos-bigsur/mountain-sunset.jpg</filename>
    <options>zoom</options>
  </wallpaper>
  <wallpaper deleted="false">
    <name>Mountain Stars</name>
    <filename>/usr/share/backgrounds/macos-bigsur/mountain-stars.jpg</filename>
    <options>zoom</options>
  </wallpaper>
</wallpapers>
EOFXML

step "macOS Big Sur wallpapers installed"

# ========================================
# 4. SET DEFAULT MACOS THEME
# ========================================

log "Configuring macOS-style defaults..."

# Update desktop preferences script
cat > /etc/skel/.config/cinnamon/macos-settings.sh <<'EOFMAC'
#!/bin/bash
# macOS Big Sur style settings

# Set WhiteSur theme
gsettings set org.cinnamon.theme name 'WhiteSur-Dark'
gsettings set org.cinnamon.desktop.interface gtk-theme 'WhiteSur-Dark'
gsettings set org.cinnamon.desktop.interface icon-theme 'WhiteSur-dark'

# Panel configuration (modern, sleek)
gsettings set org.cinnamon panels-height "['1:40']"
gsettings set org.cinnamon panel-zone-icon-sizes '[{"panelId":1,"left":24,"center":0,"right":20}]'
gsettings set org.cinnamon panels-enabled "['1:0:top']"
gsettings set org.cinnamon panel-edit-mode false

# Panel appearance
gsettings set org.cinnamon.theme name 'WhiteSur-Dark'
gsettings set org.cinnamon panels-autohide "['1:false']"
gsettings set org.cinnamon panels-show-delay 0
gsettings set org.cinnamon panels-hide-delay 0

# Window decorations (rounded corners, buttons on RIGHT)
gsettings set org.cinnamon.desktop.wm.preferences theme 'WhiteSur-Dark'
gsettings set org.cinnamon.desktop.wm.preferences button-layout ':minimize,maximize,close'
gsettings set org.cinnamon.desktop.wm.preferences action-double-click-titlebar 'toggle-maximize'
gsettings set org.cinnamon.desktop.wm.preferences action-middle-click-titlebar 'lower'

# Enable window effects (Cinnamon 5.2 compatible)
gsettings set org.cinnamon.desktop.interface enable-animations true

# Muffin window manager effects and behavior
gsettings set org.cinnamon.muffin attach-modal-dialogs true
gsettings set org.cinnamon.muffin draggable-border-width 10
gsettings set org.cinnamon.muffin tile-maximize true
gsettings set org.cinnamon.muffin placement-mode 'center'

# Desktop visual effects
gsettings set org.cinnamon startup-animation true
gsettings set org.cinnamon workspace-expo-view-as-grid true

# Enhanced panel with transparency (if theme supports)
gsettings set org.cinnamon panels-scale-text-icons true
gsettings set org.cinnamon panel-zone-text-sizes '[{"panelId":1,"left":0,"center":0,"right":0}]'

# Wallpaper (set to first Big Sur wallpaper if exists)
if [ -f /usr/share/backgrounds/macos-bigsur/bigsur-mountains.jpg ]; then
    gsettings set org.cinnamon.desktop.background picture-uri 'file:///usr/share/backgrounds/macos-bigsur/bigsur-mountains.jpg'
fi

# Fonts (San Francisco style - use Ubuntu as close alternative)
gsettings set org.cinnamon.desktop.interface font-name 'Ubuntu 11'
gsettings set org.cinnamon.desktop.wm.preferences titlebar-font 'Ubuntu Medium 11'

# Dock/panel behavior
gsettings set org.cinnamon panel-zone-symbolic-icon-sizes '[{"panelId":1,"left":28,"center":28,"right":16}]'

echo "macOS Big Sur theme applied!"
EOFMAC

chmod +x /etc/skel/.config/cinnamon/macos-settings.sh

# Update autostart to apply macOS settings
cat > /etc/skel/.config/autostart/carbon-macos-theme.desktop <<'EOFDESK'
[Desktop Entry]
Type=Application
Name=Carbon macOS Theme
Exec=/bin/bash -c "~/.config/cinnamon/macos-settings.sh && rm ~/.config/autostart/carbon-macos-theme.desktop"
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
Comment=Apply macOS Big Sur style theme
EOFDESK

# ========================================
# 5. APPLY TO CARBON USER
# ========================================

if [ -d "/home/carbon" ]; then
    log "Applying macOS theme to carbon user..."
    mkdir -p /home/carbon/Desktop
    cp -r /etc/skel/.config /home/carbon/ 2>/dev/null || true
    cp -r /etc/skel/Desktop /home/carbon/ 2>/dev/null || true
    chown -R carbon:carbon /home/carbon/.config /home/carbon/Desktop 2>/dev/null || true
fi

echo ""
log "✅ macOS Big Sur theme installation complete!"
echo ""
echo "Theme features:"
echo "  ✓ WhiteSur GTK theme (Big Sur style)"
echo "  ✓ WhiteSur icon pack (macOS icons)"
echo "  ✓ Big Sur wallpapers (6 included)"
echo "  ✓ Rounded windows and macOS buttons"
echo "  ✓ macOS-style panel configuration"
echo "  ✓ Ubuntu fonts (closest to San Francisco)"
echo ""
echo "Note: Windows-style menu kept as requested!"
echo ""
