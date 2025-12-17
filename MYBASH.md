# Chris Titus mybash Integration

Carbon images include **ChrisTitusTech's mybash** configuration for a beautiful, productive terminal experience.

**Source**: https://github.com/ChrisTitusTech/mybash
**Website**: https://christitus.com/mybash/

---

## ✨ What's Included

### 🎨 Starship Prompt
Beautiful, fast, and informative shell prompt with:
- Git status and branch info
- Language versions (Python, Node.js, etc.)
- Execution time for commands
- Error indicators
- Directory path with icons
- Customizable themes

### 📂 Zoxide (Better cd)
Smart directory navigation that learns your habits:
```bash
# Instead of: cd /long/path/to/project
z project      # Jump to most-used "project" directory

# Interactive selection
zi project     # Choose from multiple matches
```

### 🖥️ Fastfetch
Fast system info display on terminal login:
- OS and kernel version
- CPU and GPU info
- Memory usage
- Disk usage
- Uptime
- Beautiful ASCII art logo

### 🔧 Custom Aliases & Functions
Productivity shortcuts from Chris Titus's configuration:
- Enhanced ls, grep, and common commands
- Git shortcuts
- Safety aliases (confirm before dangerous operations)
- Utility functions

### 🎨 Nerd Fonts
FiraCode Nerd Font installed for proper icon display in terminal

---

## 🚀 Features in Action

### Starship Prompt
```
╭─ carbon@carbon-base ~/projects/myapp main ✗ 2s
╰─❯
```
Shows:
- Username and hostname
- Current directory with icons
- Git branch and status
- Command execution time
- Custom symbols

### Zoxide Usage
```bash
# Traditional way
cd /home/carbon/projects/work/myapp

# With zoxide (after visiting once)
z myapp       # Jumps directly to most-used match
z work        # Jump to work directory
zi my         # Interactive selection for "my"

# List tracked directories
zoxide query -l
```

### Fastfetch On Login
```
carbon@carbon-base
------------------
OS: Ubuntu 22.04.5 LTS x86_64
Host: Docker Container
Kernel: Linux 6.11.0-29-generic
Shell: bash 5.1.16
Terminal: /dev/pts/0
CPU: Intel Core i9 (16) @ 5.20 GHz
GPU: NVIDIA GeForce RTX 4090
Memory: 4.2 GiB / 64.0 GiB (7%)
```

---

## 🎯 How to Use

### Starship Prompt
Just start a new terminal - it's automatic!

The prompt shows:
- 📁 Current directory
- 🌿 Git branch/status (if in git repo)
- 🐍 Python version (if venv active)
- 📦 Node.js version (if in node project)
- ⏱️ Command execution time
- ❌ Error indicator if command failed

### Zoxide Commands
```bash
z <partial-name>     # Jump to directory
zi <partial-name>    # Interactive fuzzy search
z -                  # Go back to previous directory
zoxide query -l      # List all tracked directories
zoxide remove <path> # Remove from tracking
```

### Fastfetch Commands
```bash
fastfetch              # Show system info
fastfetch --logo none  # Without ASCII art
fastfetch --logo small # Smaller logo
```

### Custom Aliases (from mybash)
```bash
# Enhanced ls
ll     # ls -alF
la     # ls -A
l      # ls -CF

# Safe operations
rm     # Interactive confirmation
cp     # Interactive confirmation
mv     # Interactive confirmation

# Quick edits
..     # cd ..
...    # cd ../..
....   # cd ../../..

# Git shortcuts (check .bash_aliases for full list)
```

---

## 🎨 Customization

### Starship Config
Edit: `/home/carbon/.config/starship.toml`

```bash
# Open in container
docker exec -it carbon-base bash
nano ~/.config/starship.toml

# Or mount custom config
-v ~/my-starship.toml:/home/carbon/.config/starship.toml
```

### Fastfetch Config
Edit: `/home/carbon/.config/fastfetch/config.jsonc`

```bash
# Disable fastfetch on login
# Remove or comment out in ~/.bashrc:
# fastfetch
```

### Add Your Own Aliases
Edit: `/home/carbon/.bash_aliases`

```bash
# Add custom aliases
echo "alias myalias='my command'" >> ~/.bash_aliases
source ~/.bashrc
```

---

## 📋 Configuration Files Installed

```
/home/carbon/
├── .bashrc                           # Main bash config
├── .bash_aliases                     # Custom aliases
└── .config/
    ├── starship.toml                 # Starship prompt config
    └── fastfetch/
        └── config.jsonc              # Fastfetch system info config
```

---

## 🔧 Troubleshooting

### Starship not showing
```bash
# Check if installed
starship --version

# Manually initialize
eval "$(starship init bash)"

# Check if it's in bashrc
grep starship ~/.bashrc
```

### Zoxide not working
```bash
# Check if installed
zoxide --version

# Manually initialize
eval "$(zoxide init bash)"

# Add to bashrc if missing
echo 'eval "$(zoxide init bash)"' >> ~/.bashrc
```

### Fastfetch not showing on login
```bash
# Check if installed
fastfetch --version

# Run manually
fastfetch

# Check bashrc
grep fastfetch ~/.bashrc
```

### Prompt looks weird/broken
- Make sure you're using a terminal that supports Unicode
- Install a Nerd Font in your local terminal app
- For noVNC/xRDP: Fonts are already installed in the container

---

## 🎨 Themes

### Starship Themes
```bash
# Browse themes
starship preset -l

# Apply a preset
starship preset nerd-font-symbols > ~/.config/starship.toml
starship preset tokyo-night > ~/.config/starship.toml
starship preset gruvbox-rainbow > ~/.config/starship.toml
```

Popular presets:
- `nerd-font-symbols` - Clean with icons
- `tokyo-night` - Dark theme with colors
- `pastel-powerline` - Colorful powerline
- `pure-preset` - Minimalist

---

## 💡 Pro Tips

### Use zoxide effectively
```bash
# Visit directories first to build database
cd ~/projects/app1
cd ~/work/data
cd ~/projects/app2

# Then jump around
z app1   # Jumps to ~/projects/app1
z data   # Jumps to ~/work/data
z app    # Most recently used "app" directory
```

### Customize Your Prompt
```bash
# Edit starship config
nano ~/.config/starship.toml

# Add/remove modules
# Change colors, symbols, formats
# See: https://starship.rs/config/
```

### Disable fastfetch on login
If you don't want the system info on every terminal:
```bash
# Comment out in ~/.bashrc
sed -i 's/^.*fastfetch$/# &/' ~/.bashrc
```

---

## 📚 Resources

- **Starship**: https://starship.rs/
- **Zoxide**: https://github.com/ajeetdsouza/zoxide
- **Fastfetch**: https://github.com/fastfetch-cli/fastfetch
- **Chris Titus mybash**: https://github.com/ChrisTitusTech/mybash
- **Original blog post**: https://christitus.com/mybash/

---

## ✅ Testing mybash

After building/starting a container:

```bash
# Enter container
docker exec -it carbon-base bash

# You should see:
# 1. Fastfetch system info
# 2. Starship prompt (colorful with icons)

# Test zoxide
cd /tmp
cd /var/log
z tmp      # Should jump back to /tmp

# Check what's installed
starship --version
zoxide --version
fastfetch --version
```

---

**mybash gives you a modern, beautiful terminal experience in all Carbon containers!** 🎨
