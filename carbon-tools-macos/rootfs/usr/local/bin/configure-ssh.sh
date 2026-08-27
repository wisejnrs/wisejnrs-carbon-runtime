#!/usr/bin/env bash
set -euo pipefail

echo "Configuring SSH server..."

# SSH port (configurable via environment)
SSH_PORT="${SSH_PORT:-2222}"
PERMIT_ROOT_LOGIN="${PERMIT_ROOT_LOGIN:-no}"
PASSWORD_AUTH="${PASSWORD_AUTH:-yes}"

# Create SSH host keys if they don't exist
if [ ! -f /etc/ssh/ssh_host_rsa_key ]; then
    echo "Generating SSH host keys..."
    ssh-keygen -A
fi

# Configure sshd
cat > /etc/ssh/sshd_config << EOF
# Carbon SSH Configuration
Port ${SSH_PORT}
Protocol 2

# Authentication
PermitRootLogin ${PERMIT_ROOT_LOGIN}
PasswordAuthentication ${PASSWORD_AUTH}
PubkeyAuthentication yes
ChallengeResponseAuthentication no
UsePAM yes

# Security
PermitEmptyPasswords no
X11Forwarding yes
X11UseLocalhost no
PrintMotd no
AcceptEnv LANG LC_*

# Subsystems
Subsystem sftp /usr/lib/openssh/sftp-server

# Allow carbon user
AllowUsers carbon
EOF

# Create .ssh directory template in /etc/skel (carbon user may not exist yet during build)
mkdir -p /etc/skel/.ssh
chmod 700 /etc/skel/.ssh
touch /etc/skel/.ssh/authorized_keys
chmod 600 /etc/skel/.ssh/authorized_keys

# If carbon user already exists, apply now
if id -u carbon >/dev/null 2>&1; then
    mkdir -p /home/carbon/.ssh
    chown carbon:carbon /home/carbon/.ssh
    chmod 700 /home/carbon/.ssh
    if [ ! -f /home/carbon/.ssh/authorized_keys ]; then
        touch /home/carbon/.ssh/authorized_keys
        chown carbon:carbon /home/carbon/.ssh/authorized_keys
        chmod 600 /home/carbon/.ssh/authorized_keys
    fi
    echo "SSH configured for carbon user"
else
    echo "Carbon user will get .ssh from /etc/skel on creation"
fi

# Ensure run directory exists
mkdir -p /run/sshd
chmod 755 /run/sshd

echo "SSH server configured on port ${SSH_PORT}"
echo "  PermitRootLogin: ${PERMIT_ROOT_LOGIN}"
echo "  PasswordAuth: ${PASSWORD_AUTH}"
echo ""
echo "To connect:"
echo "  ssh -p ${SSH_PORT} carbon@<host>"
echo ""
echo "To add your public key:"
echo "  docker cp ~/.ssh/id_rsa.pub carbon-base:/home/carbon/.ssh/authorized_keys"
echo ""
