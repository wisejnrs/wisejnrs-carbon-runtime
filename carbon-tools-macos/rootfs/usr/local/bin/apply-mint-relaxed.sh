#!/usr/bin/env bash
set -e

# Apply for the logged-in user once (runs on first Cinnamon session via autostart)
MARK="$HOME/.config/.mint_relaxed_applied"
mkdir -p "$(dirname "$MARK")"

if [ ! -f "$MARK" ]; then
  gsettings set org.cinnamon.desktop.interface gtk-theme 'Mint-Relaxed' || true
  gsettings set org.cinnamon.desktop.interface icon-theme 'Mint-Relaxed-Icons' || true
  gsettings set org.cinnamon.theme name 'Mint-Relaxed' || true
  gsettings set org.cinnamon.desktop.wm.preferences theme 'Mint-Relaxed' || true
  touch "$MARK"
fi