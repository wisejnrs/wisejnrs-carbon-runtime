#!/usr/bin/env bash
set -euo pipefail

echo "[xterm-deluxe] installing fonts + wiring defaults…"
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
  xterm glib2.0-bin dconf-cli \
  fonts-jetbrains-mono fonts-firacode fonts-powerline \
  unzip curl ca-certificates

# Nerd Fonts (JetBrainsMono + FiraCode) — small subset for terminals
install -d -m 0755 /usr/local/share/fonts/NerdFonts/JetBrainsMono /usr/local/share/fonts/NerdFonts/FiraCode

curl -fsSL https://github.com/ryanoasis/nerd-fonts/releases/latest/download/JetBrainsMono.zip \
  -o /tmp/JetBrainsMonoNF.zip || true
curl -fsSL https://github.com/ryanoasis/nerd-fonts/releases/latest/download/FiraCode.zip \
  -o /tmp/FiraCodeNF.zip || true

if [ -s /tmp/JetBrainsMonoNF.zip ]; then
  unzip -qo /tmp/JetBrainsMonoNF.zip -d /usr/local/share/fonts/NerdFonts/JetBrainsMono
fi
if [ -s /tmp/FiraCodeNF.zip ]; then
  unzip -qo /tmp/FiraCodeNF.zip -d /usr/local/share/fonts/NerdFonts/FiraCode
fi
rm -f /tmp/JetBrainsMonoNF.zip /tmp/FiraCodeNF.zip

# Refresh font cache
fc-cache -f >/dev/null 2>&1 || true

# Global app-defaults so xterm picks sensible defaults even without ~/.Xresources
install -d -m 0755 /etc/X11/app-defaults
cp -f /usr/local/share/xterm-deluxe/XTerm.appdefaults /etc/X11/app-defaults/XTerm

# Seed /etc/skel so new users (incl. carbon created by useradd -m) inherit it
install -d -m 0755 /etc/skel
cp -f /usr/local/share/xterm-deluxe/Xresources.skel /etc/skel/.Xresources

echo "[xterm-deluxe] done."