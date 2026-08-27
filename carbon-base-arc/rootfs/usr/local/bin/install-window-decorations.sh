#!/usr/bin/env bash
set -euo pipefail

echo "Installing beautiful window decorations..."

DEFAULT_USER="${DEFAULT_USER:-carbon}"

# ========================================
# 1. INSTALL MODERN WINDOW THEMES
# ========================================

log() { echo "[window-decorations] $*"; }

log "Installing modern Metacity/Muffin themes..."

# Install Numix theme (beautiful, modern buttons)
apt-get update -qq
apt-get install -y --no-install-recommends \
    numix-gtk-theme \
    numix-icon-theme \
    numix-icon-theme-circle \
    2>/dev/null || true

# ========================================
# 2. INSTALL MACOS-STYLE WINDOW THEME
# ========================================

log "Installing macOS-style window decorations..."
cd /tmp

# Get WhiteSur window decorations (best macOS clone)
if [ ! -d "/usr/share/themes/WhiteSur-Dark" ]; then
    git clone --depth=1 https://github.com/vinceliuice/WhiteSur-gtk-theme.git
    cd WhiteSur-gtk-theme

    # Install with macOS window buttons
    ./install.sh \
        -d /usr/share/themes \
        -n WhiteSur \
        -c Dark \
        -N glassy \
        --round \
        2>/dev/null || true

    cd /tmp
    rm -rf WhiteSur-gtk-theme
fi

# ========================================
# 3. ALTERNATIVE: ARC THEME (CLEAN BUTTONS)
# ========================================

# Arc theme already installed, has nice buttons as fallback
log "Arc theme available as fallback..."

# ========================================
# 4. CREATE CUSTOM METACITY THEME
# ========================================

log "Creating custom window decoration theme..."

mkdir -p /usr/share/themes/Carbon-Premium/metacity-1

cat > /usr/share/themes/Carbon-Premium/metacity-1/metacity-theme-3.xml <<'EOFTHEME'
<?xml version="1.0"?>
<metacity_theme>
<info>
  <name>Carbon-Premium</name>
  <author>Carbon</author>
  <date>2025</date>
  <description>Premium window decorations with beautiful buttons</description>
</info>

<frame_geometry name="normal" has_title="true" rounded_top_left="8" rounded_top_right="8">
  <distance name="left_width" value="1"/>
  <distance name="right_width" value="1"/>
  <distance name="bottom_height" value="1"/>
  <distance name="left_titlebar_edge" value="6"/>
  <distance name="right_titlebar_edge" value="6"/>
  <distance name="title_vertical_pad" value="4"/>
  <border name="title_border" left="10" right="10" top="4" bottom="4"/>
  <border name="button_border" left="2" right="2" top="4" bottom="4"/>
</frame_geometry>

<!-- Title bar background -->
<draw_ops name="title_gradient">
  <gradient type="vertical" x="0" y="0" width="width" height="height">
    <color value="blend/#2d2d2d/#1a1a1a/0.9"/>
  </gradient>
</draw_ops>

<!-- Close button (RED) -->
<draw_ops name="close_button">
  <circle color="#ff5f56" x="width/2" y="height/2" radius="6" filled="true"/>
  <line color="#8b0000" x1="width/2-3" y1="height/2-3" x2="width/2+3" y2="height/2+3" width="2"/>
  <line color="#8b0000" x1="width/2+3" y1="height/2-3" x2="width/2-3" y2="height/2+3" width="2"/>
</draw_ops>

<!-- Minimize button (YELLOW) -->
<draw_ops name="minimize_button">
  <circle color="#ffbd2e" x="width/2" y="height/2" radius="6" filled="true"/>
  <line color="#996600" x1="width/2-3" y1="height/2" x2="width/2+3" y2="height/2" width="2"/>
</draw_ops>

<!-- Maximize button (GREEN) -->
<draw_ops name="maximize_button">
  <circle color="#28c940" x="width/2" y="height/2" radius="6" filled="true"/>
</draw_ops>

<frame_style name="normal" geometry="normal">
  <piece position="entire_background">
    <draw_ops>
      <rectangle color="#2d2d2d" x="0" y="0" width="width" height="height" filled="true"/>
    </draw_ops>
  </piece>
  <piece position="title">
    <draw_ops>
      <title color="#ffffff" x="16" y="0"/>
    </draw_ops>
  </piece>
  <button function="close" state="normal" draw_ops="close_button"/>
  <button function="minimize" state="normal" draw_ops="minimize_button"/>
  <button function="maximize" state="normal" draw_ops="maximize_button"/>
</frame_style>

<frame_style_set name="normal">
  <frame focus="yes" state="normal" style="normal"/>
  <frame focus="no" state="normal" style="normal"/>
</frame_style_set>

<window type="normal" style_set="normal"/>

</metacity_theme>
EOFTHEME

log "Custom window theme created"

# ========================================
# 5. CONFIGURE DEFAULT SETTINGS
# ========================================

log "Setting default window decoration preferences..."

# Create config script
cat > /etc/skel/.config/cinnamon/window-decorations.sh <<'EOFWIN'
#!/bin/bash
export DISPLAY=:1

# Use WhiteSur theme for windows (best macOS look)
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences theme 'WhiteSur-Dark' 2>/dev/null || \
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences theme 'Arc-Dark' || \
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences theme 'Mint-Y-Dark'

# Window controls on RIGHT with proper spacing
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences button-layout ':minimize,maximize,close'

# Title bar font
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences titlebar-font 'Ubuntu Medium 11'

# Enhanced window behavior
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences action-double-click-titlebar 'toggle-maximize'
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences resize-with-right-button true

echo "Window decorations configured"
EOFWIN

chmod +x /etc/skel/.config/cinnamon/window-decorations.sh

log "Window decorations installation complete!"
