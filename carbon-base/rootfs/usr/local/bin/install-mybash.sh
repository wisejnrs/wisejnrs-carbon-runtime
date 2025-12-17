#!/bin/bash
set -euo pipefail

echo "Installing ChrisTitusTech mybash configuration..."
echo "Source: https://christitus.com/mybash/"

DEFAULT_USER="${DEFAULT_USER:-carbon}"

# Install required dependencies for mybash
echo "Installing dependencies..."
apt-get update
apt-get install -y --no-install-recommends \
    curl \
    git \
    unzip \
    wget \
    fontconfig \
    fonts-powerline \
    fonts-firacode

# Install Starship prompt
echo "Installing Starship prompt..."
curl -sS https://starship.rs/install.sh | sh -s -- --yes

# zoxide should already be installed via apt in Dockerfile
if ! command -v zoxide &> /dev/null; then
    echo "Warning: zoxide not found, it should be installed via apt"
fi

# Install fastfetch for system info
echo "Installing fastfetch..."
if ! command -v fastfetch &> /dev/null; then
    FASTFETCH_VERSION=$(curl -s https://api.github.com/repos/fastfetch-cli/fastfetch/releases/latest | grep '"tag_name"' | cut -d'"' -f4 || echo "2.30.1")
    curl -sLo /tmp/fastfetch.deb "https://github.com/fastfetch-cli/fastfetch/releases/download/${FASTFETCH_VERSION}/fastfetch-linux-amd64.deb" || \
    curl -sLo /tmp/fastfetch.deb "https://github.com/fastfetch-cli/fastfetch/releases/latest/download/fastfetch-linux-amd64.deb"
    dpkg -i /tmp/fastfetch.deb || apt-get -f install -y
    rm -f /tmp/fastfetch.deb
else
    echo "fastfetch already installed"
fi

# Clone mybash repository (ChrisTitusTech's version)
echo "Cloning ChrisTitusTech mybash repository..."
cd /tmp
rm -rf mybash
git clone --depth=1 https://github.com/ChrisTitusTech/mybash.git
cd mybash

# Create necessary directories
mkdir -p /etc/skel/.config
mkdir -p /home/${DEFAULT_USER}/.config

# Copy configuration files for root user
echo "Setting up root user configuration..."
cp -r .config/* /root/.config/ 2>/dev/null || true
cp .bashrc /root/.bashrc 2>/dev/null || true
cp .bash_aliases /root/.bash_aliases 2>/dev/null || true

# Copy configuration files for default user
echo "Setting up default user configuration..."
cp -r .config/* /home/${DEFAULT_USER}/.config/ 2>/dev/null || true
cp .bashrc /home/${DEFAULT_USER}/.bashrc 2>/dev/null || true
cp .bash_aliases /home/${DEFAULT_USER}/.bash_aliases 2>/dev/null || true

# Set proper ownership
chown -R ${DEFAULT_USER}:${DEFAULT_USER} /home/${DEFAULT_USER}/.config /home/${DEFAULT_USER}/.bashrc /home/${DEFAULT_USER}/.bash_aliases 2>/dev/null || true

# Copy to skel for future users
cp -r .config/* /etc/skel/.config/ 2>/dev/null || true
cp .bashrc /etc/skel/.bashrc 2>/dev/null || true
cp .bash_aliases /etc/skel/.bash_aliases 2>/dev/null || true

# Install Nerd Fonts for better terminal display
echo "Installing Nerd Fonts (FiraCode)..."
mkdir -p /usr/share/fonts/nerd-fonts
cd /tmp
if ! curl -fLo "FiraCode.zip" https://github.com/ryanoasis/nerd-fonts/releases/latest/download/FiraCode.zip; then
    echo "Failed to download FiraCode, skipping..."
else
    unzip -o FiraCode.zip -d /usr/share/fonts/nerd-fonts/ || true
    rm -f FiraCode.zip
    # Update font cache
    fc-cache -fv || true
fi

# Add starship and zoxide to PATH for all users
echo 'export PATH="$HOME/.local/bin:/usr/local/bin:$PATH"' >> /etc/environment

# Add mybash initialization to system bashrc (for all users)
cat >> /etc/bash.bashrc << 'EOFBASH'

# ===== ChrisTitusTech mybash Configuration =====
# Initialize Starship prompt
if command -v starship &> /dev/null; then
    eval "$(starship init bash)"
fi

# Initialize zoxide (better cd)
if command -v zoxide &> /dev/null; then
    eval "$(zoxide init bash)"
fi

# Show fastfetch on login (comment out if you don't want it)
if command -v fastfetch &> /dev/null && [ -z "$FASTFETCH_SHOWN" ]; then
    export FASTFETCH_SHOWN=1
    fastfetch
fi
EOFBASH

# Clean up
rm -rf /tmp/mybash
apt-get clean
rm -rf /var/lib/apt/lists/*

echo ""
echo "✅ mybash configuration installed successfully!"
echo ""
echo "Features installed:"
echo "  ✓ Starship prompt - Beautiful, fast shell prompt"
echo "  ✓ Zoxide - Smarter cd command"
echo "  ✓ Fastfetch - System info on login"
echo "  ✓ Custom aliases and functions"
echo "  ✓ Nerd Fonts for better icons"
echo ""
echo "Source: https://github.com/ChrisTitusTech/mybash"
echo ""