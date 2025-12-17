# Helper Scripts Guide

This directory contains helper scripts to make working with Carbon easier.

## 📜 Available Scripts

### 🚀 `dc-up.sh` - Start Carbon Services

Interactive Docker Compose launcher with profile selection.

**Usage**:
```bash
# Interactive menu
./scripts/dc-up.sh

# Direct profile selection
./scripts/dc-up.sh ml
./scripts/dc-up.sh dev
./scripts/dc-up.sh full

# Multiple profiles (use quotes)
./scripts/dc-up.sh "ml databases"
```

**Features**:
- Interactive profile menu
- Automatic .env file creation
- Shows relevant access URLs
- Colored output for clarity

**Profiles**:
1. `minimal` - Base image only
2. `ml` - ML/AI workstation
3. `creative` - Creative tools
4. `security` - Security tools
5. `dev` - Development (all + databases)
6. `full` - Everything
7. Custom - Enter your own profile(s)

---

### 🛑 `dc-down.sh` - Stop Carbon Services

Shutdown all Carbon services with optional volume removal.

**Usage**:
```bash
# Stop services (preserve data)
./scripts/dc-down.sh

# Stop and remove volumes (⚠️ data loss)
./scripts/dc-down.sh --volumes
./scripts/dc-down.sh -v
```

**Features**:
- Confirmation prompt for volume removal
- Works with all profiles
- Preserves data by default

---

### 📊 `carbon-status.sh` - Check Status

Comprehensive status check of all Carbon services.

**Usage**:
```bash
./scripts/carbon-status.sh
```

**Shows**:
- Running containers with status and ports
- CPU and memory usage per container
- Docker Compose service status
- Access URLs for running services
- Quick links to relevant interfaces

**Output sections**:
1. Running Carbon Containers
2. Resource Usage (CPU/Memory)
3. Docker Compose Services
4. Access Points (URLs and ports)

---

### 📝 `dc-logs.sh` - View Logs

View or follow logs from Carbon services.

**Usage**:
```bash
# List available services and show recent logs (all)
./scripts/dc-logs.sh

# View logs from specific service
./scripts/dc-logs.sh carbon-compute

# Follow logs in real-time
./scripts/dc-logs.sh carbon-compute --follow
./scripts/dc-logs.sh carbon-compute -f

# Follow all logs
./scripts/dc-logs.sh --follow
```

**Features**:
- Interactive service selection
- Real-time log following
- Last 50-100 lines by default
- Colored output

---

### 🐚 `carbon-shell.sh` - Shell Access

Quick shell access to running Carbon containers.

**Usage**:
```bash
# Interactive container selection
./scripts/carbon-shell.sh

# Direct container access
./scripts/carbon-shell.sh carbon-compute
./scripts/carbon-shell.sh carbon-tools
./scripts/carbon-shell.sh carbon-base
```

**Features**:
- Lists available containers
- Tries bash first, falls back to sh
- Direct TTY access

**Common uses**:
```bash
# Access compute container
./scripts/carbon-shell.sh carbon-compute

# Then inside the container
cd /work
python script.py
jupyter notebook list
nvidia-smi
```

---

### 🧹 `carbon-cleanup.sh` - Docker Cleanup

Clean up Docker resources to free disk space.

**Usage**:
```bash
# Standard cleanup
./scripts/carbon-cleanup.sh

# Aggressive cleanup (removes all unused resources)
./scripts/carbon-cleanup.sh --aggressive
./scripts/carbon-cleanup.sh -a
```

**Standard Mode Removes**:
- Dangling images (untagged layers)
- Build cache

**Aggressive Mode Removes**:
- All stopped containers
- All dangling images
- All unused images
- All build cache
- All unused volumes
- All unused networks

**Features**:
- Shows disk usage before and after
- Confirmation prompts for safety
- Colored warnings for aggressive mode

---

## 📋 Quick Reference

### Starting Up

```bash
# First time setup
cp .env.example .env       # Create config
nano .env                  # Customize if needed
./scripts/dc-up.sh ml      # Start ML environment

# Check everything started
./scripts/carbon-status.sh

# View logs if needed
./scripts/dc-logs.sh carbon-compute --follow
```

### Daily Workflow

```bash
# Start your workstation
./scripts/dc-up.sh ml

# Work with containers
./scripts/carbon-shell.sh carbon-compute

# Check status anytime
./scripts/carbon-status.sh

# View logs
./scripts/dc-logs.sh carbon-compute

# Stop when done
./scripts/dc-down.sh
```

### Maintenance

```bash
# Weekly cleanup
./scripts/carbon-cleanup.sh

# Monthly deep clean
./scripts/carbon-cleanup.sh --aggressive

# Check what's running
./scripts/carbon-status.sh

# Full restart
./scripts/dc-down.sh
./scripts/dc-up.sh ml
```

---

## 🎨 Output Colors

All scripts use colored output for clarity:

- 🔵 **Blue**: Informational messages, headers
- 🟢 **Green**: Success messages, confirmations
- 🟡 **Yellow**: Warnings, prompts
- 🔴 **Red**: Errors, destructive operations

---

## 🔧 Customization

### Adding Your Own Scripts

Place custom scripts in the `scripts/` directory and make them executable:

```bash
chmod +x scripts/my-script.sh
```

### Modifying Existing Scripts

All scripts use:
- `set -e` for error handling
- Color codes defined at the top
- Clear section headers

Feel free to customize for your needs!

---

## 💡 Tips & Tricks

### Alias for Convenience

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
alias carbon-up='./scripts/dc-up.sh'
alias carbon-down='./scripts/dc-down.sh'
alias carbon-status='./scripts/carbon-status.sh'
alias carbon-logs='./scripts/dc-logs.sh'
alias carbon-shell='./scripts/carbon-shell.sh'
```

### Quick Notebook Access

```bash
# Start ML environment
./scripts/dc-up.sh ml

# Wait a few seconds, then open browser to:
# http://localhost:8888
```

### GPU Monitoring

```bash
# Shell into container
./scripts/carbon-shell.sh carbon-compute

# Inside container, monitor GPU
watch -n 1 nvidia-smi
```

### Log Analysis

```bash
# Save logs to file
./scripts/dc-logs.sh carbon-compute > compute.log

# Search logs
./scripts/dc-logs.sh carbon-compute | grep ERROR
```

---

## 🐛 Troubleshooting Scripts

### Script Won't Run

```bash
# Make sure it's executable
chmod +x scripts/*.sh

# Check line endings (if copied from Windows)
dos2unix scripts/*.sh
```

### Permission Denied

```bash
# Run from project root
cd /path/to/wisejnrs-carbon-runtime
./scripts/script-name.sh

# Not from scripts directory
cd scripts  # ❌ Wrong
./script-name.sh
```

### Docker Daemon Not Running

```bash
# Check Docker status
sudo systemctl status docker

# Start Docker if needed
sudo systemctl start docker
```

---

## 📚 Related Documentation

- [Docker Compose Profiles Guide](DOCKER-COMPOSE-GUIDE.md) - Profile usage
- [Configuration Guide](CONFIGURATION.md) - Environment variables
- [Main README](README.md) - Project overview

---

**Last Updated**: 2025-12-15
