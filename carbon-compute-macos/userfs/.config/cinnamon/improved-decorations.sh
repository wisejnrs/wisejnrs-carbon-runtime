#!/bin/bash
# Improved window decorations using Arc-Dark theme

# Modern, polished Arc-Dark theme (actually installed)
gsettings set org.cinnamon.theme name 'Arc-Dark'
gsettings set org.cinnamon.desktop.interface gtk-theme 'Arc-Dark'
gsettings set org.cinnamon.desktop.interface icon-theme 'Yaru'

# Window decorations with Arc-Dark (clean, modern borders)
gsettings set org.cinnamon.desktop.wm.preferences theme 'Arc-Dark'
gsettings set org.cinnamon.desktop.wm.preferences button-layout ':minimize,maximize,close'
gsettings set org.cinnamon.desktop.wm.preferences action-double-click-titlebar 'toggle-maximize'
gsettings set org.cinnamon.desktop.wm.preferences action-middle-click-titlebar 'lower'
gsettings set org.cinnamon.desktop.wm.preferences resize-with-right-button true

# Enhanced window effects
gsettings set org.cinnamon.desktop.interface enable-animations true

# Muffin window manager - better window handling
gsettings set org.cinnamon.muffin attach-modal-dialogs true
gsettings set org.cinnamon.muffin draggable-border-width 15
gsettings set org.cinnamon.muffin tile-maximize true
gsettings set org.cinnamon.muffin placement-mode 'center'
gsettings set org.cinnamon.muffin workspace-cycle true
gsettings set org.cinnamon.muffin edge-tiling true

# Window focus and behavior
gsettings set org.cinnamon.desktop.wm.preferences focus-mode 'click'
gsettings set org.cinnamon.desktop.wm.preferences auto-raise false
gsettings set org.cinnamon.desktop.wm.preferences raise-on-click true

# Panel configuration (sleek, modern)
gsettings set org.cinnamon panels-height "['1:40']"
gsettings set org.cinnamon panel-zone-icon-sizes '[{"panelId":1,"left":24,"center":0,"right":20}]'
gsettings set org.cinnamon panels-enabled "['1:0:top']"
gsettings set org.cinnamon panel-edit-mode false
gsettings set org.cinnamon panels-autohide "['1:false']"
gsettings set org.cinnamon panels-scale-text-icons true

# Desktop visual effects
gsettings set org.cinnamon startup-animation true
gsettings set org.cinnamon workspace-expo-view-as-grid true

# Better fonts
gsettings set org.cinnamon.desktop.interface font-name 'Ubuntu 11'
gsettings set org.cinnamon.desktop.wm.preferences titlebar-font 'Ubuntu Medium 11'

echo "✅ Arc-Dark theme with improved window decorations applied!"
echo "Window borders are now clean and modern with Arc-Dark styling"
