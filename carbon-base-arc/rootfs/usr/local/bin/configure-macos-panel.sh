#!/usr/bin/env bash
set -euo pipefail

echo "Configuring macOS-style top panel..."

DEFAULT_USER="${DEFAULT_USER:-carbon}"

# ========================================
# CREATE MACOS-STYLE PANEL CONFIGURATION
# ========================================

cat > /etc/skel/.config/cinnamon/macos-panel-layout.sh <<'EOFPANEL'
#!/bin/bash
# macOS-style panel layout
export DISPLAY=:1
export DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$(id -u)/bus

# Panel configuration for macOS look
# Left: Menu + App icons
# Center: Clock/Calendar (like macOS)
# Right: System icons (sound, network, power)

# Panel height and appearance
dbus-launch gsettings set org.cinnamon panels-height "['1:32']"

# Panel zones with macOS-style layout
# Left zone: application menu and launchers
# Center zone: clock (macOS style!)
# Right zone: system tray icons

dbus-launch gsettings set org.cinnamon panel-zone-icon-sizes '[{"panelId":1,"left":24,"center":0,"right":20}]'
dbus-launch gsettings set org.cinnamon panel-zone-symbolic-icon-sizes '[{"panelId":1,"left":20,"center":0,"right":18}]'

# Panel styling
dbus-launch gsettings set org.cinnamon panels-autohide "['1:false']"
dbus-launch gsettings set org.cinnamon panels-show-delay 0
dbus-launch gsettings set org.cinnamon panels-hide-delay 0
dbus-launch gsettings set org.cinnamon panel-edit-mode false

# Hot corners (like macOS Mission Control)
dbus-launch gsettings set org.cinnamon hotcorner-layout "['expo:false:0', 'scale:false:0', 'scale:false:0', 'desktop:false:0']"

echo "macOS-style panel configured!"
EOFPANEL

chmod +x /etc/skel/.config/cinnamon/macos-panel-layout.sh

# Apply to carbon user (if exists)
if id -u "$DEFAULT_USER" >/dev/null 2>&1 && [ -d "/home/$DEFAULT_USER" ]; then
    mkdir -p /home/$DEFAULT_USER/.config/cinnamon
    cp /etc/skel/.config/cinnamon/macos-panel-layout.sh /home/$DEFAULT_USER/.config/cinnamon/ || true
    chown $DEFAULT_USER:$DEFAULT_USER /home/$DEFAULT_USER/.config/cinnamon/macos-panel-layout.sh || true
fi

# Create autostart entry
cat > /etc/skel/.config/autostart/macos-panel.desktop <<'EOFDESK'
[Desktop Entry]
Type=Application
Name=macOS Panel Layout
Exec=/bin/bash ~/.config/cinnamon/macos-panel-layout.sh
Hidden=false
NoDisplay=true
X-GNOME-Autostart-enabled=true
StartupNotify=false
EOFDESK

if id -u "$DEFAULT_USER" >/dev/null 2>&1 && [ -d "/home/$DEFAULT_USER" ]; then
    mkdir -p /home/$DEFAULT_USER/.config/autostart
    cp /etc/skel/.config/autostart/macos-panel.desktop /home/$DEFAULT_USER/.config/autostart/ || true
    chown $DEFAULT_USER:$DEFAULT_USER /home/$DEFAULT_USER/.config/autostart/macos-panel.desktop || true
fi

echo "macOS-style top panel configuration complete!"
