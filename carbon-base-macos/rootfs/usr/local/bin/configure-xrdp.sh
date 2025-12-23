#!/usr/bin/env bash
set -euo pipefail

# Configure xrdp for VNC passthrough
echo "Configuring xrdp..."

# Create xrdp config directory
mkdir -p /etc/xrdp

# Get container name and image info
CONTAINER_NAME="${HOSTNAME}"
DOCKER_IMAGE="${DOCKER_NAME:-Carbon}"

# Configure xrdp to use VNC backend with custom branding
cat > /etc/xrdp/xrdp.ini << EOF
[Globals]
; listening port
port=3389
; Branding
ls_title=${DOCKER_IMAGE} - ${CONTAINER_NAME}
ls_logo_filename=
ls_top_window_bg_color=009cb5
ls_bg_color=dedede
ls_width=350
ls_height=430
ls_btn_ok_x_margin=10
ls_btn_ok_y_margin=10
ls_btn_ok_width=85
ls_btn_ok_height=30
ls_btn_cancel_x_margin=10
ls_btn_cancel_y_margin=10
ls_btn_cancel_width=85
ls_btn_cancel_height=30
ls_label_x_pos=10
ls_label_width=60
ls_input_x_pos=110
ls_input_width=230
; Session types
[Xvnc]
name=Xvnc Session
lib=libvnc.so
username=ask
password=ask
ip=127.0.0.1
port=5901

[vnc-any]
name=VNC Any
lib=libvnc.so
ip=127.0.0.1
port=5901
username=na
password=ask
EOF

# Configure sesman to allow any user
cat > /etc/xrdp/sesman.ini << 'EOF'
[Globals]
ListenPort=3350
EnableUserWindowManager=true
UserWindowManager=cinnamon-session
DefaultWindowManager=cinnamon-session

[Security]
AllowRootLogin=true
MaxLoginRetry=4
TerminalServerUsers=tsusers
TerminalServerAdmins=tsadmins

[Sessions]
X11DisplayOffset=10
MaxSessions=50
KillDisconnected=false
IdleTimeLimit=0
DisconnectedTimeLimit=0
Policy=Default

[Logging]
LogFile=/var/log/xrdp-sesman.log
LogLevel=INFO
EnableSyslog=true
SyslogLevel=INFO
EOF

# Configure PAM for xRDP authentication
cat > /etc/pam.d/xrdp-sesman << 'EOF'
#%PAM-1.0
@include common-auth
@include common-account
@include common-session
@include common-password
session required pam_loginuid.so
session optional pam_systemd.so
EOF

# Ensure SSL certificate exists for xRDP
if [ ! -f /etc/xrdp/rsakeys.ini ]; then
    cd /etc/xrdp
    if [ -f /etc/xrdp/key.pem ] && [ -f /etc/xrdp/cert.pem ]; then
        echo "xRDP SSL certificates already exist"
    else
        # Create self-signed certificate
        openssl req -x509 -newkey rsa:2048 -nodes \
            -keyout /etc/xrdp/key.pem \
            -out /etc/xrdp/cert.pem \
            -days 365 \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null || true
        chmod 400 /etc/xrdp/key.pem
        chmod 444 /etc/xrdp/cert.pem
    fi
fi

# Ensure xrdp can write to its directories
mkdir -p /var/run/xrdp /var/log
chmod 755 /var/run/xrdp

# Create a custom login screen message
cat > /etc/xrdp/login-message.txt << EOF
═══════════════════════════════════════════════
   🚀 CARBON DEVELOPMENT ENVIRONMENT
═══════════════════════════════════════════════

  Container: ${CONTAINER_NAME}
  Image:     ${DOCKER_IMAGE}
  Access:    xRDP (Remote Desktop Protocol)

  Default Credentials:
  • Username: carbon
  • Password: Carbon123#

═══════════════════════════════════════════════
EOF

# Update xrdp startup to show the message
if [ ! -f /etc/xrdp/.custom-banner-set ]; then
    # Add custom ASCII art banner
    cat > /etc/xrdp/banner.txt << 'EOF'
  ██████╗ █████╗ ██████╗ ██████╗  ██████╗ ███╗   ██╗
 ██╔════╝██╔══██╗██╔══██╗██╔══██╗██╔═══██╗████╗  ██║
 ██║     ███████║██████╔╝██████╔╝██║   ██║██╔██╗ ██║
 ██║     ██╔══██║██╔══██╗██╔══██╗██║   ██║██║╚██╗██║
 ╚██████╗██║  ██║██║  ██║██████╔╝╚██████╔╝██║ ╚████║
  ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝  ╚═════╝ ╚═╝  ╚═══╝
EOF
    touch /etc/xrdp/.custom-banner-set
fi

# Set ownership
chown -R xrdp:xrdp /etc/xrdp /var/run/xrdp 2>/dev/null || true

echo "xrdp configuration complete - Login screen customized for ${DOCKER_IMAGE}"
