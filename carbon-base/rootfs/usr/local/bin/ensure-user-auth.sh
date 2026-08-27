#!/usr/bin/env bash
set -euo pipefail

# Ensure carbon user can authenticate via PAM for xRDP
echo "Ensuring carbon user authentication is configured..."

# Use environment variable for password, fallback to default
CARBON_PASSWORD="${CARBON_PASSWORD:-Carbon123#}"

# Re-set the password to ensure it's properly hashed in shadow file
echo "carbon:${CARBON_PASSWORD}" | chpasswd

# Ensure carbon user is in necessary groups
usermod -aG xrdp carbon 2>/dev/null || true
usermod -aG ssl-cert carbon 2>/dev/null || true

# Unlock the account if it's locked
passwd -u carbon 2>/dev/null || true

# Ensure home directory permissions are correct (non-recursive to avoid slowdown)
chown carbon:carbon /home/carbon
chmod 755 /home/carbon

# Ensure .Xauthority exists and has correct permissions
if [ ! -f /home/carbon/.Xauthority ]; then
    touch /home/carbon/.Xauthority
    chown carbon:carbon /home/carbon/.Xauthority
    chmod 600 /home/carbon/.Xauthority
fi

echo "Carbon user authentication configured successfully"
