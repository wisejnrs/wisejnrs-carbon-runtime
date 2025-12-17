#!/bin/bash
set -euo pipefail

# Configure VirtualGL for container use
echo "Configuring VirtualGL for container environment..."

# Set VirtualGL environment variables
export VGL_DISPLAY=":0"
export VGL_READBACK="sync"
export VGL_FORCEALPHA=1
export PATH="/opt/VirtualGL/bin:$PATH"

# Create VirtualGL configuration directory
mkdir -p /etc/opt/VirtualGL

# Configure VirtualGL server settings
cat > /etc/opt/VirtualGL/vgl_xauth_key << 'EOF'
VGL_DISPLAY=:0
VGL_READBACK=sync
VGL_FORCEALPHA=1
EOF

# Set proper permissions
chmod 644 /etc/opt/VirtualGL/vgl_xauth_key

# Add VirtualGL environment to system profile
cat > /etc/profile.d/virtualgl.sh << 'EOF'
export VGL_DISPLAY=":0"
export VGL_READBACK="sync"
export VGL_FORCEALPHA=1
export PATH="/opt/VirtualGL/bin:$PATH"
EOF

chmod 644 /etc/profile.d/virtualgl.sh

echo "VirtualGL configuration completed."