# Carbon Configuration Guide

Complete guide to configuring Carbon containers with environment variables, command-line options, and configuration files.

---

## 🚀 Quick Start

### Method 1: Use .env File (Recommended)
```bash
# Copy example file
cp .env.example .env

# Edit with your preferences
nano .env

# Start with configuration
./start-carbon-configurable.sh --image base
```

### Method 2: Command Line Arguments
```bash
# Start with custom password and workspace
./start-carbon-configurable.sh \
  --password MySecret123 \
  --work-dir ~/my-projects \
  --image compute
```

### Method 3: Environment Variables
```bash
# Set variables directly
export CARBON_PASSWORD="MySecret123"
export WORK_DIR="$HOME/projects"
export VNC_RESOLUTION="2560x1440"

# Start container
./start-carbon-configurable.sh --image base
```

---

## 📋 All Configuration Options

### 🔐 Security & Authentication

#### **CARBON_PASSWORD** (default: `Carbon123#`)
Master password for the carbon user account

```bash
# Via command line
./start-carbon-configurable.sh --password "MyNewPassword123"

# Via environment
CARBON_PASSWORD="MyNewPassword123" ./start-carbon-configurable.sh

# Via .env file
CARBON_PASSWORD=MyNewPassword123
```

**Used for:**
- Linux user `carbon` login
- sudo authentication
- Default for other services if not specified separately

#### **VNC_PASSWORD** (default: `Carbon123#`)
Password for VNC client access

```bash
VNC_PASSWORD="MyVncPass123"
```

#### **CODE_SERVER_PASSWORD** (default: `Carbon123#`)
Password for code-server (VS Code in browser)

```bash
CODE_SERVER_PASSWORD="MyCodePass123"
```

#### **POSTGRES_PASSWORD** (default: `Carbon123#`)
PostgreSQL database password

```bash
POSTGRES_PASSWORD="MyDbPass123"
```

#### **MONGODB_PASSWORD** (default: `Carbon123#`)
MongoDB database password

```bash
MONGODB_PASSWORD="MyMongoPass123"
```

---

### 👤 User Settings

#### **CARBON_USER** (default: `carbon`)
Username for the container user

```bash
CARBON_USER="developer"
```

#### **CARBON_UID** / **CARBON_GID** (default: `1000` / `100`)
User and group IDs for file ownership matching with host

```bash
# Match your host user
CARBON_UID=$(id -u)
CARBON_GID=$(id -g)
```

**Why this matters:** Files created in mounted volumes will have correct ownership

#### **TZ** (default: `Australia/Brisbane`)
Timezone for the container

```bash
TZ="America/New_York"
TZ="Europe/London"
TZ="Asia/Tokyo"

# List available timezones:
timedatectl list-timezones
```

---

### 📁 Workspace & Storage

#### **WORK_DIR** (default: `./work`)
Host directory mounted to `/work` in container

```bash
# Via command line
./start-carbon-configurable.sh --work-dir ~/projects

# Via environment
WORK_DIR="/home/user/my-projects"

# Absolute or relative paths work
WORK_DIR="./workspace"     # Relative
WORK_DIR="$HOME/projects"  # Absolute
```

#### **DATA_DIR** (default: `./data`)
Host directory mounted to `/data` for database persistence

```bash
DATA_DIR="/mnt/storage/carbon-data"
```

#### **HOME_DIR** (default: empty)
Optional: Mount host directory to `/home/carbon`

```bash
# Leave empty to use container's internal home
HOME_DIR=""

# Or mount from host
HOME_DIR="/home/user/carbon-home"
```

---

### 🖥️ Display Settings

#### **VNC_RESOLUTION** (default: `1920x1080`)
Desktop resolution

```bash
# Via command line
./start-carbon-configurable.sh --resolution 2560x1440

# Common resolutions
VNC_RESOLUTION="1920x1080"  # Full HD
VNC_RESOLUTION="2560x1440"  # 2K
VNC_RESOLUTION="3840x2160"  # 4K
VNC_RESOLUTION="1280x720"   # HD (lighter)
```

#### **VNC_DEPTH** (default: `24`)
Color depth in bits

```bash
VNC_DEPTH="24"  # True color (recommended)
VNC_DEPTH="16"  # Lower quality, better performance
VNC_DEPTH="32"  # Full color with alpha
```

#### **VNC_DISPLAY** (default: `:1`)
X11 display number

```bash
VNC_DISPLAY=":1"  # Usually don't need to change
```

---

### 🔌 Port Configuration

All ports can be customized to avoid conflicts:

```bash
# Desktop access
RDP_PORT=3390        # xRDP (Remote Desktop)
NOVNC_PORT=6900      # noVNC (Web browser)
VNC_PORT=5900        # VNC client

# Databases
POSTGRES_PORT=5432   # PostgreSQL
MONGODB_PORT=27017   # MongoDB
REDIS_PORT=6379      # Redis

# Development (compute image)
JUPYTER_PORT=8888    # Jupyter Lab
CODE_SERVER_PORT=9999  # code-server

# Spark (compute image)
SPARK_MASTER_UI_PORT=8080
SPARK_WORKER_UI_PORT=8081

# AI/ML (GPU images)
OLLAMA_PORT=11434    # Ollama API
```

**Example: Avoid PostgreSQL conflict**
```bash
# If you have PostgreSQL on host port 5432
POSTGRES_PORT=5433 ./start-carbon-configurable.sh
```

---

### ⚙️ Service Toggles

Enable or disable services to save resources:

```bash
# Databases
ENABLE_POSTGRESQL=true   # Enable PostgreSQL
ENABLE_MONGODB=true      # Enable MongoDB
ENABLE_REDIS=true        # Enable Redis
ENABLE_MOSQUITTO=true    # Enable MQTT broker

# AI/ML (GPU only)
ENABLE_OLLAMA=true       # Enable Ollama
ENABLE_VLLM=false        # Enable vLLM (disabled by default)

# Development (compute image)
ENABLE_JUPYTER=true      # Enable Jupyter Lab
ENABLE_CODE_SERVER=true  # Enable code-server
ENABLE_SPARK=true        # Enable Spark cluster

# Desktop
ENABLE_VNC=true          # Enable VNC server
ENABLE_XRDP=true         # Enable xRDP
```

**Example: Minimal container (no databases)**
```bash
ENABLE_POSTGRESQL=false \
ENABLE_MONGODB=false \
ENABLE_REDIS=false \
./start-carbon-configurable.sh
```

**Example: Just Jupyter, no code-server**
```bash
ENABLE_JUPYTER=true \
ENABLE_CODE_SERVER=false \
./start-carbon-configurable.sh --image compute
```

---

### 💪 Resource Limits

#### **MEMORY_LIMIT** (default: `16g`)
Maximum memory container can use

```bash
# Via command line
./start-carbon-configurable.sh --memory 32g

# Via environment
MEMORY_LIMIT="8g"   # 8 GB
MEMORY_LIMIT="16g"  # 16 GB
MEMORY_LIMIT="32g"  # 32 GB
```

#### **CPU_LIMIT** (default: `8`)
Maximum number of CPUs

```bash
# Via command line
./start-carbon-configurable.sh --cpu 4

# Via environment
CPU_LIMIT="4"   # 4 CPUs
CPU_LIMIT="8"   # 8 CPUs
CPU_LIMIT="16"  # 16 CPUs
```

#### **GPU_DEVICES** (default: `all`)
Which GPUs to use

```bash
# Via command line
./start-carbon-configurable.sh --gpu 0

# Via environment
GPU_DEVICES="all"    # All available GPUs
GPU_DEVICES="0"      # First GPU only
GPU_DEVICES="0,1"    # First and second GPU
GPU_DEVICES="1"      # Second GPU only
```

---

### 🐳 Container Settings

#### **CONTAINER_NAME** (default: `carbon-{image_type}`)
Name for the Docker container

```bash
# Via command line
./start-carbon-configurable.sh --name my-carbon-dev

# Via environment
CONTAINER_NAME="my-project-container"
```

#### **NETWORK_MODE** (default: `bridge`)
Docker network mode

```bash
NETWORK_MODE="bridge"  # Default, isolated network
NETWORK_MODE="host"    # Use host networking (better performance)
NETWORK_MODE="none"    # No networking
```

#### **RESTART_POLICY** (default: `unless-stopped`)
Container restart behavior

```bash
RESTART_POLICY="no"              # Never restart
RESTART_POLICY="always"          # Always restart
RESTART_POLICY="unless-stopped"  # Restart unless manually stopped
RESTART_POLICY="on-failure"      # Restart only on error
```

---

## 📝 Configuration Examples

### Example 1: Development Workstation
```bash
# .env file
CARBON_PASSWORD=SecurePass123
WORK_DIR=/home/user/projects
VNC_RESOLUTION=2560x1440
MEMORY_LIMIT=32g
CPU_LIMIT=16
ENABLE_OLLAMA=true
```

### Example 2: Lightweight Testing
```bash
# Minimal resources, no databases
MEMORY_LIMIT=4g
CPU_LIMIT=2
VNC_RESOLUTION=1280x720
ENABLE_POSTGRESQL=false
ENABLE_MONGODB=false
ENABLE_REDIS=false
ENABLE_OLLAMA=false
```

### Example 3: Multi-GPU ML Workstation
```bash
# Use specific GPUs for different tasks
CONTAINER_NAME=carbon-ml-gpu0
GPU_DEVICES=0
MEMORY_LIMIT=64g
WORK_DIR=/data/ml-projects
JUPYTER_PORT=8888

# Run second instance on different GPU
CONTAINER_NAME=carbon-ml-gpu1
GPU_DEVICES=1
MEMORY_LIMIT=64g
JUPYTER_PORT=8889  # Different port!
```

### Example 4: Remote Access Only (No Desktop)
```bash
# Disable desktop for headless use
ENABLE_VNC=false
ENABLE_XRDP=false
MEMORY_LIMIT=8g

# Access via Jupyter only
ENABLE_JUPYTER=true
JUPYTER_PORT=8888
```

### Example 5: Database Development
```bash
# Focus on databases, disable ML tools
ENABLE_POSTGRESQL=true
ENABLE_MONGODB=true
ENABLE_REDIS=true
ENABLE_OLLAMA=false
ENABLE_JUPYTER=false
ENABLE_CODE_SERVER=false

# Custom database ports
POSTGRES_PORT=5433
MONGODB_PORT=27018
```

---

## 🎯 Common Use Cases

### Start with Custom Password
```bash
./start-carbon-configurable.sh --password MySecret123
```

### Use Custom Workspace
```bash
./start-carbon-configurable.sh --work-dir ~/my-projects
```

### 4K Resolution
```bash
./start-carbon-configurable.sh --resolution 3840x2160
```

### High-Resource ML Work
```bash
./start-carbon-configurable.sh \
  --image compute \
  --memory 64g \
  --cpu 32 \
  --gpu all \
  --work-dir /data/ml-projects
```

### Minimal Test Container
```bash
ENABLE_POSTGRESQL=false \
ENABLE_MONGODB=false \
MEMORY_LIMIT=4g \
./start-carbon-configurable.sh
```

---

## 🔍 Checking Your Configuration

### View Active Environment Variables
```bash
docker exec carbon-gpu env | grep -E "(CARBON|VNC|ENABLE|JUPYTER)"
```

### Check Running Services
```bash
docker exec carbon-gpu supervisorctl status
```

### View Resource Usage
```bash
docker stats carbon-gpu
```

### Check Mounted Volumes
```bash
docker inspect carbon-gpu | grep -A 10 "Mounts"
```

---

## 🛠️ Troubleshooting

### Services Not Starting
Check if service is enabled:
```bash
docker exec carbon-gpu ls /etc/supervisor/conf.d/ | grep -v disabled
```

### Port Conflicts
Change ports in .env:
```bash
POSTGRES_PORT=5433  # Changed from 5432
MONGODB_PORT=27018  # Changed from 27017
```

### File Permission Issues
Match your host UID/GID:
```bash
CARBON_UID=$(id -u)
CARBON_GID=$(id -g)
```

### Memory Issues
Reduce services or increase limit:
```bash
MEMORY_LIMIT=32g
ENABLE_OLLAMA=false
ENABLE_SPARK=false
```

---

## 📚 Related Documentation

- **[QUICK-START.md](QUICK-START.md)** - Get started in 5 minutes
- **[PORTS.md](PORTS.md)** - Port configuration and conflicts
- **[IMAGES.md](IMAGES.md)** - Detailed image documentation
- **[README.md](README.md)** - Main documentation

---

**Pro Tip**: Use `.env` files for persistent configuration, command-line args for one-off changes!
