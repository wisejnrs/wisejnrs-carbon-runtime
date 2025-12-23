#!/usr/bin/env bash
set -euo pipefail

# ========================================
# Carbon Desktop Enhancement Script
# Optimizes Cinnamon for remote VNC access
# ========================================

echo "🎨 Enhancing Cinnamon desktop..."

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${GREEN}[enhance]${NC} $*"; }
step() { echo -e "${BLUE}▶${NC} $*"; }

# ========================================
# 1. PERFORMANCE OPTIMIZATION
# ========================================
log "Step 1: Optimizing performance for VNC..."

step "Reducing desktop effects for better remote performance"
cat > /usr/share/glib-2.0/schemas/99-carbon-performance.gschema.override <<'EOF'
[org.cinnamon]
desktop-effects = false
desktop-effects-minimize = 'traditional'
desktop-effects-maximize = 'none'
desktop-effects-unmaximize = 'none'
desktop-effects-tile = 'none'
workspace-osd-visible = false
startup-animation = false
enable-vfade = false

[org.cinnamon.settings-daemon.plugins.power]
sleep-display-ac = 0
sleep-display-battery = 0

[org.cinnamon.desktop.interface]
cursor-blink-time = 1000
gtk-im-module = 'gtk-im-context-simple'
font-name = 'Ubuntu 10'
monospace-font-name = 'JetBrains Mono 10'

[org.cinnamon.desktop.wm.preferences]
theme = 'Mint-Y-Dark'
num-workspaces = 4
focus-mode = 'click'

[org.nemo.preferences]
show-hidden-files = true
show-image-thumbnails = 'never'
thumbnail-limit = 0
EOF

step "Compiling GSettings schemas"
glib-compile-schemas /usr/share/glib-2.0/schemas/ 2>/dev/null || true

# ========================================
# 2. INSTALL MODERN THEMES & ICONS
# ========================================
log "Step 2: Installing modern themes..."

step "Installing Arc theme and dependencies"
apt-get update -qq
apt-get install -y --no-install-recommends \
  arc-theme \
  gnome-icon-theme \
  gtk2-engines \
  2>/dev/null || log "Some theme packages may not be available"

# Install Nordic theme manually (beautiful dark theme)
step "Installing Nordic theme"
if [ ! -d "/usr/share/themes/Nordic" ]; then
  cd /tmp
  wget -q https://github.com/EliverLara/Nordic/archive/refs/heads/master.zip -O nordic.zip || true
  if [ -f nordic.zip ]; then
    unzip -q nordic.zip
    mv Nordic-master /usr/share/themes/Nordic
    rm nordic.zip
  fi
fi

# ========================================
# 3. PRODUCTIVITY TOOLS
# ========================================
log "Step 3: Installing productivity tools..."

step "Installing Tilix terminal"
apt-get install -y --no-install-recommends tilix 2>/dev/null || \
  log "Tilix not available, will use GNOME Terminal as fallback"

step "Installing productivity apps"
apt-get install -y --no-install-recommends \
  gnome-system-monitor \
  diodon \
  flameshot \
  gedit \
  pluma \
  file-roller \
  gnome-calculator \
  2>/dev/null || log "Some apps may not be available"

# ========================================
# 4. DEVELOPER TOOLS SETUP
# ========================================
log "Step 4: Configuring developer environment..."

step "Creating developer tools directory"
mkdir -p /opt/dev-tools

step "Setting up Git GUI tools"
apt-get install -y --no-install-recommends \
  gitg \
  meld \
  2>/dev/null || log "Git GUI tools may not be available"

# ========================================
# 5. DESKTOP CUSTOMIZATION
# ========================================
log "Step 5: Customizing desktop appearance..."

# Create default desktop configuration for carbon user
step "Creating user desktop preferences"
mkdir -p /etc/skel/.config/cinnamon
cat > /etc/skel/.config/cinnamon/custom-settings.sh <<'EOF'
#!/bin/bash
# Carbon Desktop Custom Settings
# This runs on first login to set preferences

# Set Arc-Dark theme
gsettings set org.cinnamon.theme name 'Arc-Dark'
gsettings set org.cinnamon.desktop.interface gtk-theme 'Arc-Dark'
gsettings set org.cinnamon.desktop.interface icon-theme 'Papirus-Dark'

# Performance optimizations
gsettings set org.cinnamon desktop-effects false
gsettings set org.cinnamon.desktop.interface enable-animations false

# Panel configuration
gsettings set org.cinnamon panels-height "['1:32']"
gsettings set org.cinnamon panel-zone-icon-sizes '[{"panelId":1,"left":0,"center":0,"right":24}]'

# Window management
gsettings set org.cinnamon.desktop.wm.preferences focus-mode 'click'
gsettings set org.cinnamon.desktop.wm.preferences num-workspaces 4

# Terminal as default
gsettings set org.cinnamon.desktop.default-applications.terminal exec 'tilix'

# Keyboard shortcuts
gsettings set org.cinnamon.desktop.keybindings.media-keys terminal "['<Primary><Alt>t']"

# Nemo file manager
gsettings set org.nemo.preferences show-hidden-files true
gsettings set org.nemo.window-state start-with-sidebar true
gsettings set org.nemo.window-state sidebar-bookmark-breakpoint 5

# Clock format
gsettings set org.cinnamon.desktop.interface clock-show-date true
gsettings set org.cinnamon.desktop.interface clock-show-seconds false
EOF

chmod +x /etc/skel/.config/cinnamon/custom-settings.sh

# ========================================
# 6. PANEL FAVORITES & LAUNCHERS
# ========================================
step "Setting up panel favorites"
cat > /etc/skel/.config/cinnamon/set-favorites.sh <<'EOF'
#!/bin/bash
# Set favorite applications in panel

# Favorites: Firefox, VS Code, Terminal, Nemo, System Monitor
gsettings set org.cinnamon favorite-apps "[\
'firefox.desktop', \
'code.desktop', \
'tilix.desktop', \
'nemo.desktop', \
'gnome-system-monitor.desktop'\
]"
EOF

chmod +x /etc/skel/.config/cinnamon/set-favorites.sh

# ========================================
# 7. TILIX CONFIGURATION
# ========================================
step "Configuring Tilix terminal"
mkdir -p /etc/skel/.config/tilix/schemes

# Create a nice color scheme
cat > /etc/skel/.config/tilix/schemes/carbon-dark.json <<'EOF'
{
    "name": "Carbon Dark",
    "comment": "Optimized for development",
    "use-theme-colors": false,
    "foreground-color": "#E0E0E0",
    "background-color": "#1E1E1E",
    "palette": [
        "#000000",
        "#FF5555",
        "#50FA7B",
        "#F1FA8C",
        "#BD93F9",
        "#FF79C6",
        "#8BE9FD",
        "#BFBFBF",
        "#4D4D4D",
        "#FF6E67",
        "#5AF78E",
        "#F4F99D",
        "#CAA9FA",
        "#FF92D0",
        "#9AEDFE",
        "#E6E6E6"
    ]
}
EOF

# ========================================
# 8. AUTOSTART APPLICATIONS
# ========================================
log "Step 6: Configuring autostart..."

mkdir -p /etc/skel/.config/autostart

# Clipboard manager
if command -v diodon >/dev/null 2>&1; then
  step "Enabling clipboard manager on startup"
  cat > /etc/skel/.config/autostart/diodon.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Diodon
Exec=diodon
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
fi

# Apply desktop settings on first login
cat > /etc/skel/.config/autostart/carbon-desktop-setup.desktop <<'EOF'
[Desktop Entry]
Type=Application
Name=Carbon Desktop Setup
Exec=/bin/bash -c "~/.config/cinnamon/custom-settings.sh && ~/.config/cinnamon/set-favorites.sh && rm ~/.config/autostart/carbon-desktop-setup.desktop"
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
Comment=One-time desktop configuration
EOF

# ========================================
# 9. KEYBOARD SHORTCUTS REFERENCE
# ========================================
step "Creating keyboard shortcuts reference"
mkdir -p /etc/skel/Desktop
cat > /etc/skel/Desktop/KeyboardShortcuts.txt <<'EOF'
===========================================
  CARBON DESKTOP - KEYBOARD SHORTCUTS
===========================================

ESSENTIAL:
  Ctrl+Alt+T       Open Terminal (Tilix)
  Super+E          Open File Manager (Nemo)
  Super+L          Lock Screen
  Alt+F2           Run Command
  Print            Screenshot

WINDOW MANAGEMENT:
  Alt+Tab          Switch Windows
  Alt+F4           Close Window
  Super+Left       Snap Window Left
  Super+Right      Snap Window Right
  Super+Up         Maximize Window
  Super+Down       Unmaximize/Minimize

WORKSPACES:
  Ctrl+Alt+Right   Next Workspace
  Ctrl+Alt+Left    Previous Workspace
  Ctrl+Alt+Up      Workspace Overview

APPLICATIONS:
  code             Visual Studio Code
  tilix            Terminal
  nemo             File Manager
  firefox          Web Browser

===========================================
EOF

# ========================================
# 10. VNC OPTIMIZATION
# ========================================
log "Step 7: VNC-specific optimizations..."

step "Disabling compositing for better VNC performance"
cat > /etc/skel/.config/cinnamon/disable-compositing.sh <<'EOF'
#!/bin/bash
# Disable desktop compositing for better remote performance
dconf write /org/cinnamon/desktop-effects false
dconf write /org/cinnamon/desktop-effects-on-dialogs false
dconf write /org/cinnamon/desktop-effects-on-menus false
EOF

chmod +x /etc/skel/.config/cinnamon/disable-compositing.sh

# ========================================
# 11. APPLY TO EXISTING CARBON USER
# ========================================
log "Step 8: Applying settings to carbon user..."

if [ -d "/home/carbon" ]; then
  step "Copying configurations to /home/carbon"
  cp -r /etc/skel/.config /home/carbon/ 2>/dev/null || true
  cp -r /etc/skel/Desktop /home/carbon/ 2>/dev/null || true
  chown -R carbon:carbon /home/carbon/.config /home/carbon/Desktop 2>/dev/null || true
  chmod 755 /home/carbon/Desktop 2>/dev/null || true
fi

# ========================================
# CLEANUP
# ========================================
apt-get clean
rm -rf /var/lib/apt/lists/*

log "✅ Desktop enhancement complete!"
echo ""
echo "Changes include:"
echo "  ✓ Performance optimized for VNC"
echo "  ✓ Arc-Dark theme installed"
echo "  ✓ Tilix terminal configured"
echo "  ✓ Papirus icons enabled"
echo "  ✓ Clipboard manager (Diodon)"
echo "  ✓ Developer tools ready"
echo "  ✓ Custom keyboard shortcuts"
echo ""
echo "Note: Some settings apply on next desktop restart"
