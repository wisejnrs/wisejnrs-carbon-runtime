#!/bin/bash
# Add transparency to Cinnamon panel

# Create custom theme directory based on Arc-Dark
THEME_DIR="/home/carbon/.themes/Arc-Dark-Transparent"
mkdir -p "$THEME_DIR/cinnamon"

# Copy Arc-Dark cinnamon theme
cp -r /usr/share/themes/Arc-Dark/cinnamon/* "$THEME_DIR/cinnamon/"

# Add panel transparency to CSS
cat >> "$THEME_DIR/cinnamon/cinnamon.css" << 'EOF'

/* Custom panel transparency */
#panel {
    background-color: rgba(47, 52, 63, 0.85) !important;
    /* 0.85 = 85% opacity, adjust 0.0-1.0 for more/less transparency */
}

.panel-top {
    background-color: rgba(47, 52, 63, 0.85) !important;
}

.panel-bottom {
    background-color: rgba(47, 52, 63, 0.85) !important;
}

.panel-left {
    background-color: rgba(47, 52, 63, 0.85) !important;
}

.panel-right {
    background-color: rgba(47, 52, 63, 0.85) !important;
}
EOF

# Apply the custom theme
DISPLAY=:1 gsettings set org.cinnamon.theme name 'Arc-Dark-Transparent'

echo "✅ Panel transparency enabled!"
echo "Panel is now semi-transparent (85% opacity)"
echo "Edit ~/.themes/Arc-Dark-Transparent/cinnamon/cinnamon.css to adjust"
echo "Change the 0.85 value (0.0=fully transparent, 1.0=fully opaque)"
