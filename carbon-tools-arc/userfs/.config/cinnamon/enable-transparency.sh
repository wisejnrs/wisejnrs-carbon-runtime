#!/bin/bash
# Enable desktop compositing and transparency

# Enable desktop effects
dconf write /org/cinnamon/desktop-effects true
dconf write /org/cinnamon/desktop-effects-on-dialogs true
dconf write /org/cinnamon/desktop-effects-on-menus true

# Enable transparency effects
gsettings set org.cinnamon.desktop.interface enable-animations true

# Set window effects for transparency
gsettings set org.cinnamon startup-animation true
gsettings set org.cinnamon desktop-effects-workspace true
gsettings set org.cinnamon desktop-effects-minimize-effect 'traditional'
gsettings set org.cinnamon desktop-effects-maximize-effect 'none'
gsettings set org.cinnamon desktop-effects-unmaximize-effect 'none'
gsettings set org.cinnamon desktop-effects-close-effect 'traditional'
gsettings set org.cinnamon desktop-effects-map-effect 'traditional'

# Enable Muffin compositor
gsettings set org.cinnamon.muffin unredirect-fullscreen-windows false

echo "✅ Compositing and transparency enabled!"
echo "Note: This may reduce performance slightly in remote sessions"
