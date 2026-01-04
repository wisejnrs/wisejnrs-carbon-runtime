#!/usr/bin/env bash
set -euo pipefail

echo "Installing Orchidea theme - Premium Cinnamon experience..."

DEFAULT_USER="${DEFAULT_USER:-carbon}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[orchidea]${NC} $*"; }
step() { echo -e "${BLUE}▶${NC} $*"; }

# ========================================
# 1. INSTALL ORCHIDEA THEME
# ========================================

log "Downloading Orchidea theme from Cinnamon Spices..."

cd /tmp

# Download Orchidea theme
# Method 1: Direct from Cinnamon Spices
wget -q "https://cinnamon-spices.linuxmint.com/files/themes/Orchidea.zip" -O orchidea.zip || \
curl -sL "https://cinnamon-spices.linuxmint.com/files/themes/Orchidea.zip" -o orchidea.zip || true

if [ -f orchidea.zip ]; then
    unzip -q orchidea.zip -d /tmp/orchidea-extract

    # Find the theme directory
    THEME_DIR=$(find /tmp/orchidea-extract -type d -name "Orchidea*" | head -1)

    if [ -n "$THEME_DIR" ]; then
        # Copy to system themes
        cp -r "$THEME_DIR" /usr/share/themes/Orchidea
        step "Orchidea theme installed to /usr/share/themes/Orchidea"
    fi

    rm -rf /tmp/orchidea-extract orchidea.zip
else
    log "Could not download Orchidea, will use fallback themes"
fi

# ========================================
# 2. CONFIGURE ORCHIDEA AS DEFAULT
# ========================================

log "Configuring Orchidea theme settings..."

cat > /etc/skel/.config/cinnamon/orchidea-settings.sh <<'EOFORCHID'
#!/bin/bash
# Orchidea theme configuration
export DISPLAY=:1

# Set Orchidea theme (Cinnamon + GTK + WM)
dbus-launch gsettings set org.cinnamon.theme name 'Orchidea' || \
dbus-launch gsettings set org.cinnamon.theme name 'Mint-Y-Dark'

dbus-launch gsettings set org.cinnamon.desktop.interface gtk-theme 'Orchidea' || \
dbus-launch gsettings set org.cinnamon.desktop.interface gtk-theme 'Arc-Dark'

dbus-launch gsettings set org.cinnamon.desktop.wm.preferences theme 'Orchidea' || \
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences theme 'Numix'

# Icon theme - use WhiteSur or Papirus with Orchidea
dbus-launch gsettings set org.cinnamon.desktop.interface icon-theme 'WhiteSur-dark' || \
dbus-launch gsettings set org.cinnamon.desktop.interface icon-theme 'Papirus-Dark'

# Window controls on RIGHT (as requested)
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences button-layout ':minimize,maximize,close'

# Top panel configuration
dbus-launch gsettings set org.cinnamon panels-height "['1:32']"
dbus-launch gsettings set org.cinnamon panel-zone-icon-sizes '[{"panelId":1,"left":24,"center":0,"right":20}]'

# Panel favorites - Chrome, VS Code first!
dbus-launch gsettings set org.cinnamon favorite-apps "[\
'google-chrome.desktop', \
'code.desktop', \
'firefox.desktop', \
'org.gnome.Terminal.desktop', \
'nemo.desktop', \
'gnome-system-monitor.desktop'\
]"

# Animations
dbus-launch gsettings set org.cinnamon.desktop.interface enable-animations true

# Fonts
dbus-launch gsettings set org.cinnamon.desktop.interface font-name 'Ubuntu 11'
dbus-launch gsettings set org.cinnamon.desktop.wm.preferences titlebar-font 'Ubuntu Medium 11'

# Cursor
dbus-launch gsettings set org.cinnamon.desktop.interface cursor-size 24

# Wallpaper (Big Sur if available)
if [ -f /usr/share/backgrounds/macos-bigsur-hd/bigsur-layers-dark.jpg ]; then
    dbus-launch gsettings set org.cinnamon.desktop.background picture-uri 'file:///usr/share/backgrounds/macos-bigsur-hd/bigsur-layers-dark.jpg'
elif [ -f /usr/share/backgrounds/macos-bigsur/bigsur-mountains.jpg ]; then
    dbus-launch gsettings set org.cinnamon.desktop.background picture-uri 'file:///usr/share/backgrounds/macos-bigsur/bigsur-mountains.jpg'
fi

dbus-launch gsettings set org.cinnamon.desktop.background picture-options 'zoom'

echo "Orchidea theme configured!"
EOFORCHID

chmod +x /etc/skel/.config/cinnamon/orchidea-settings.sh

# ========================================
# 3. AUTOSTART ORCHIDEA CONFIGURATION
# ========================================

cat > /etc/skel/.config/autostart/orchidea-theme.desktop <<'EOFDESK'
[Desktop Entry]
Type=Application
Name=Orchidea Theme
Exec=/bin/bash ~/.config/cinnamon/orchidea-settings.sh
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
Comment=Apply Orchidea theme on login
StartupNotify=false
EOFDESK

# ========================================
# 4. APPLY TO CARBON USER (if exists)
# ========================================

if id -u "$DEFAULT_USER" >/dev/null 2>&1; then
    log "Applying Orchidea to carbon user..."
    mkdir -p /home/$DEFAULT_USER/.config/cinnamon
    mkdir -p /home/$DEFAULT_USER/.config/autostart
    cp /etc/skel/.config/cinnamon/orchidea-settings.sh /home/$DEFAULT_USER/.config/cinnamon/ || true
    cp /etc/skel/.config/autostart/orchidea-theme.desktop /home/$DEFAULT_USER/.config/autostart/ || true
    chown -R $DEFAULT_USER:$DEFAULT_USER /home/$DEFAULT_USER/.config || true
else
    log "Carbon user will get theme from /etc/skel on creation"
fi

echo ""
log "✅ Orchidea theme installed!"
echo ""
echo "Orchidea features:"
echo "  ✓ Beautiful, modern Cinnamon theme"
echo "  ✓ Clean, professional window decorations"
echo "  ✓ Elegant panel design"
echo "  ✓ Great colors and contrast"
echo "  ✓ Window controls on RIGHT"
echo "  ✓ Chrome & VS Code in panel"
echo ""
echo "Access via: http://localhost:6900"
echo ""
