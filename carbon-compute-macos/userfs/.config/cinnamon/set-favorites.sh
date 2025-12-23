#!/bin/bash
# Set favorite applications in panel

# Favorites: Terminal (Tilix), Firefox, VS Code, Files, System Monitor
gsettings set org.cinnamon favorite-apps "[\
'tilix.desktop', \
'firefox.desktop', \
'code.desktop', \
'nemo.desktop', \
'gnome-system-monitor.desktop'\
]"
