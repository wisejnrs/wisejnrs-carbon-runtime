#!/bin/bash
# Set favorite applications in panel

# Favorites: Terminal, Firefox, VS Code (optimized), Files, System Monitor, GPU Monitor, Jupyter
gsettings set org.cinnamon favorite-apps "[\
'tilix.desktop', \
'firefox.desktop', \
'code-optimized.desktop', \
'nemo.desktop', \
'gnome-system-monitor.desktop', \
'nvtop.desktop', \
'nvidia-settings.desktop'\
]"
