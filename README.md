# Carbon Development Environment Suite

[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Author](https://img.shields.io/badge/Author-WiseJNRS-blue.svg)](https://www.wisejnrs.net)
[![Website](https://img.shields.io/badge/Website-wisejnrs.net-green.svg)](https://www.wisejnrs.net)

> **Full-stack development environments with GPU acceleration, desktop UI, and comprehensive tooling**

A complete suite of Docker images providing GPU-accelerated development environments with full Cinnamon desktop, remote access via VNC/noVNC/xRDP, databases, and specialized tooling for data science, creative work, and security research.

**Created by [WiseJNRS](https://www.wisejnrs.net)** - Building powerful development tools for the community.

---

## ⚡ Quick Start

> **👋 New to this project?** Read **[START_HERE.md](START_HERE.md)** first for current status and context!

### Option A: Use Pre-Built Images from Docker Hub (Fastest!)

**1. Pull images:**
```bash
docker pull wisejnrs/carbon-base:latest       # 18 GB
docker pull wisejnrs/carbon-compute:latest    # 56 GB
docker pull wisejnrs/carbon-tools:latest      # 28 GB
```

**2. Quick start with Docker:**
```bash
# Base image - Development desktop
docker run -d --name carbon-base \
  --gpus all \
  -p 6900:6900 -p 5900:5901 -p 3390:3389 \
  -v $PWD/work:/work \
  wisejnrs/carbon-base:latest

# Compute image - ML/AI workstation
docker run -d --name carbon-compute \
  --gpus all \
  -p 6900:6900 -p 8888:8888 -p 9999:9999 \
  -v $PWD/work:/work \
  wisejnrs/carbon-compute:latest

# Tools image - Creative/Security
docker run -d --name carbon-tools \
  --gpus all \
  -p 6900:6900 \
  -v $PWD/work:/work \
  wisejnrs/carbon-tools:latest
```

**3. Or use Docker Compose** (recommended):

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  carbon-base:
    image: wisejnrs/carbon-base:latest
    container_name: carbon-base
    hostname: carbon-base
    ports:
      - "6900:6900"   # noVNC
      - "5900:5901"   # VNC
      - "3390:3389"   # xRDP
    volumes:
      - ./work:/work
      - ./data:/data
    environment:
      - CARBON_PASSWORD=Carbon123#
      - VNC_PASSWORD=Carbon123#
      - ENABLE_POSTGRESQL=false  # Enable if needed
      - ENABLE_MONGODB=false
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped

  carbon-compute:
    image: wisejnrs/carbon-compute:latest
    container_name: carbon-compute
    hostname: carbon-compute
    ports:
      - "6901:6900"   # noVNC
      - "8888:8888"   # Jupyter
      - "9999:9999"   # code-server
    volumes:
      - ./work:/work
      - ./data:/data
    environment:
      - CARBON_PASSWORD=Carbon123#
      - VNC_PASSWORD=Carbon123#
      - JUPYTER_PASSWORD=Carbon123#
      - CODE_SERVER_PASSWORD=Carbon123#
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    restart: unless-stopped
```

Start with:
```bash
# Start base image
docker compose up -d carbon-base

# Or start compute image
docker compose up -d carbon-compute

# Stop
docker compose down
```

### Option B: Build Images Locally

**1. Build images:**
```bash
./build-all.sh   # Builds all GPU-enabled images
```

**2. Start with helper scripts:**
```bash
# Easy Way (Configurable Launcher)
./start-carbon-configurable.sh --image base --password MySecret123
./start-carbon-configurable.sh --image compute --work-dir ~/projects
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh

# Quick Way (Pre-configured Scripts)
./start-carbon-gpu.sh          # Base with GPU
./start-carbon-compute.sh      # ML/AI stack
./start-carbon-tools.sh        # Creative/Security
```

### Access Your Environment

- **Web Desktop (noVNC)**: http://localhost:6900
- **RDP**: localhost:**3390** (user: carbon, pass: Carbon123#)
  - ⚠️ Port 3390 (not 3389) to avoid Windows RDP conflict
- **VNC**: localhost:5900 (pass: Carbon123#)
- **Jupyter Lab** (compute): http://localhost:8888
- **code-server** (compute): http://localhost:9999

---

## 📦 Images

All images are **GPU-enabled by default** with automatic CPU fallback. No separate `-gpu` or `-minimal` variants!

### carbon-base
**Foundation with desktop, databases, and core tools**
- Cinnamon desktop optimized for remote access
- VNC/noVNC/xRDP support
- **Databases** (optional): PostgreSQL 16, MongoDB 8, Redis, Mosquitto, Qdrant
- **PostgreSQL Extensions**: pgvector v0.5.0, PostGIS 3.x for vector & geospatial queries
- **Vector DB**: Qdrant for high-performance similarity search
- Python 3.10, Node.js 20, Go 1.23, Rust, .NET 9.0, Swift 6.1.2, R
- VS Code, browsers (Firefox, Chrome)
- **Shell**: ChrisTitusTech mybash (Starship prompt, zoxide, fastfetch)
- **GPU**: CUDA 12.1 + cuDNN 8 + Ollama (works on CPU-only systems)

**Docker Hub:**
```bash
docker pull wisejnrs/carbon-base:latest  # 18.18 GB
```

### carbon-compute
**ML/AI workstation built on carbon-base**
- **Claude Code CLI** - AI-assisted development (v2.0.69)
- Jupyter Lab (starts in /home/carbon) + code-server
- Apache Spark cluster
- **ML Frameworks**: PyTorch 2.4 (CUDA 12.1), TensorFlow, Keras
- **LLM Tools**: vLLM, Transformers, LangChain, sentence-transformers
- **Data Science**: scikit-learn, pandas, numpy, matplotlib, PySpark, Delta Lake
- 100+ VS Code extensions
- .NET Interactive Jupyter kernel

**Docker Hub:**
```bash
docker pull wisejnrs/carbon-compute:latest  # 55.72 GB
```

### carbon-tools
**Creative + Security + DevOps toolkit**
- **Claude Code CLI** - AI-assisted development (v2.0.69)
- **Creative**: Blender 4.5, GIMP, Krita, Inkscape, Kdenlive, OBS Studio, Audacity
- **Security**: nmap, Wireshark, sqlmap, hydra, hashcat, SecLists
- **Retro Gaming**: VICE (C64), RetroArch, MAME, C64 Debugger
- **DevOps**: Docker CLI, kubectl, Terraform, Ansible, AWS CLI, gh
- **CAD**: FreeCAD, MeshLab
- **GPU Acceleration**: Enabled for Blender rendering and video encoding

**Docker Hub:**
```bash
docker pull wisejnrs/carbon-tools:latest  # 27.56 GB
```

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────┐
│           carbon-base (foundation)          │
│   Desktop │ Databases │ Languages │ GPU     │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
┌──────────────┐  ┌──────────────┐
│carbon-compute│  │carbon-tools  │
│ML/AI/Data Sci│  │Creative/Sec  │
└──────────────┘  └──────────────┘
```

All images include:
✅ Full Cinnamon desktop environment
✅ Remote access: VNC, noVNC (web), xRDP
✅ PostgreSQL, MongoDB, Redis databases
✅ Multi-language development support
✅ GPU acceleration (NVIDIA CUDA)
✅ Supervisor-managed services

---

## 🎯 Use Cases

| Use Case | Image | Access |
|----------|-------|--------|
| Jupyter notebooks, ML training | carbon-compute | http://localhost:8888 |
| Browser-based VS Code | carbon-compute | http://localhost:9999 |
| 3D modeling (Blender) | carbon-tools --gpu | Desktop via noVNC |
| Security testing | carbon-tools | Desktop + CLI |
| Web development | carbon-base | Desktop + VS Code |
| Retro game dev (C64/NES) | carbon-tools | Desktop |
| Spark big data | carbon-compute | Desktop + ports |
| Video editing (Kdenlive/OBS) | carbon-tools --gpu | Desktop via noVNC |

---

## 🔌 Port Reference

⚠️ **Important**: We use port **3390** (not 3389) for RDP to avoid conflicts with Windows Remote Desktop!

| Host Port | Container Port | Service | Images |
|-----------|---------------|---------|--------|
| **3390** | 3389 | xRDP (Remote Desktop) | All |
| 5900 | 5901 | VNC | All |
| 6900 | 6900 | noVNC (web browser) | All |
| 5432 | 5432 | PostgreSQL (+ pgvector + PostGIS) | All (optional) |
| 6333 | 6333 | Qdrant HTTP API | All (optional) |
| 6334 | 6334 | Qdrant gRPC API | All (optional) |
| 6379 | 6379 | Redis | All (optional) |
| 27017 | 27017 | MongoDB | All (optional) |
| 8888 | 8888 | Jupyter Lab | compute |
| 9999 | 9999 | code-server | compute |
| 7077 | 7077 | Spark Master | compute |
| 8080 | 8080 | Spark Master UI | compute |
| 11434 | 11434 | Ollama API | base-gpu, compute (optional) |

📖 **Need custom ports?** See [PORTS.md](PORTS.md) for detailed port configuration and conflict resolution.

---

## 💾 Data Persistence

All images mount two volumes:

- `/data` - Database persistence
  - PostgreSQL: `/data/postgresql`
  - MongoDB: `/data/mongodb`
  - Redis: `/data/redis`

- `/work` - Your workspace

**Example:**
```bash
docker run -d \
  -v $PWD/my-data:/data \
  -v $PWD/projects:/work \
  -p 6900:6900 \
  wisejnrs/carbon-base:latest-gpu
```

---

## 🎮 GPU Requirements

**For GPU-enabled images:**
- NVIDIA GPU (compute capability 6.0+)
- NVIDIA drivers on host
- Docker with NVIDIA runtime

**Setup:**
```bash
# Install NVIDIA Container Toolkit
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker

# Test
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

---

## 🛠️ Build & Start Scripts

### Build All Images
```bash
./build-all.sh --all        # Build GPU + minimal variants
./build-all.sh --gpu        # Build only GPU variants
./build-all.sh --minimal    # Build only minimal variants
./build-all.sh --all --push # Build and push to registry
```

### Universal Launcher (Recommended)
```bash
# Start with configuration
./start-carbon-configurable.sh [OPTIONS]

# Examples:
./start-carbon-configurable.sh --image base --password MyPass123
./start-carbon-configurable.sh --image compute --work-dir ~/projects
./start-carbon-configurable.sh --resolution 2560x1440 --memory 32g

# Enable services as needed
ENABLE_POSTGRESQL=true ENABLE_REDIS=true ./start-carbon-configurable.sh

# See all options
./start-carbon-configurable.sh --help
```

### Build Individual Images
```bash
# Base
docker build --build-arg BUILD_GPU=true -t wisejnrs/carbon-base:latest-gpu carbon-base/
docker build --build-arg BUILD_GPU=false -t wisejnrs/carbon-base:latest-minimal carbon-base/

# Compute (requires GPU base)
docker build \
  --build-arg ROOT_CONTAINER=wisejnrs/carbon-base:latest-gpu \
  -t wisejnrs/carbon-compute:latest \
  carbon-compute/

# Tools
docker build \
  --build-arg ROOT_CONTAINER=wisejnrs/carbon-base:latest-gpu \
  -t wisejnrs/carbon-tools:latest-gpu \
  carbon-tools/
```

---

## 🚀 Start Scripts

### Pre-configured Scripts (Quick Start)

```bash
# Base image
./start-carbon-gpu.sh          # With GPU support
./start-carbon-remote.sh       # Without GPU (minimal)

# Compute image
./start-carbon-compute.sh      # Always uses GPU

# Tools image
./start-carbon-tools.sh --gpu  # With GPU (for Blender/video)
./start-carbon-tools.sh        # Without GPU
```

### Configurable Launcher (Flexible)

```bash
# Universal script with full configuration
./start-carbon-configurable.sh [OPTIONS]

# Key options:
--image TYPE          # base, compute, tools
--variant VARIANT     # gpu, minimal
--password PASS       # Set all passwords
--work-dir PATH       # Custom workspace
--resolution RES      # VNC resolution
--memory SIZE         # Memory limit
--cpu COUNT           # CPU limit
--gpu DEVICES         # GPU selection

# Service toggles via environment:
ENABLE_POSTGRESQL=true
ENABLE_MONGODB=true
ENABLE_REDIS=true
ENABLE_OLLAMA=true
```

**All scripts:**
- Remove any existing container
- Start with proper port mappings
- Wait for services to initialize
- Display comprehensive access information
- Show service status

---

## 🔐 Default Credentials

**User Account:**
- Username: `carbon`
- Password: `Carbon123#` ⚠️ **Change this!**

**VNC/Desktop:**
- VNC Password: `Carbon123#`

**Web Services:**
- code-server: `Carbon123#`

**Databases:**
- PostgreSQL: user `postgres` or `carbon`, password `Carbon123#`
- MongoDB: user `carbon`, password `Carbon123#`
- Redis: no password (localhost only)

**💡 Change Passwords:**
```bash
# Set custom password for everything
./start-carbon-configurable.sh --password MySecurePass123

# Or use .env file
CARBON_PASSWORD=MySecurePass123
VNC_PASSWORD=MyVncPass123
CODE_SERVER_PASSWORD=MyCodePass123
```

See [CONFIGURATION.md](CONFIGURATION.md) for all password options.

---

## 📚 Documentation

**Getting Started:**
- **[START_HERE.md](START_HERE.md)** ⭐ **READ THIS FIRST** - Current status & context
- **[QUICK-START.md](QUICK-START.md)** - Get up and running in 5 minutes
- **[OVERVIEW.md](OVERVIEW.md)** - High-level overview and decision guide
- **[CONFIGURATION.md](CONFIGURATION.md)** - Complete configuration guide
- **[SERVICE-TOGGLES.md](SERVICE-TOGGLES.md)** - Enable/disable services

**Features:**
- **[DATABASES.md](DATABASES.md)** - PostgreSQL, MongoDB, Redis, Qdrant, pgvector, PostGIS
- **[MYBASH.md](MYBASH.md)** - ChrisTitusTech mybash shell customization
- **[CLI-TOOLS.md](CLI-TOOLS.md)** - AWS CLI, Azure CLI, Claude, Ollama, kubectl, Terraform
- **[IMAGES.md](IMAGES.md)** - Detailed documentation for each image

**Reference:**
- **[PORTS.md](PORTS.md)** - Port configuration and conflict resolution
- **[.env.example](.env.example)** - Configuration template
- **[XRDP-FIX.md](XRDP-FIX.md)** - xRDP troubleshooting

**Status:**
- **[BUILD-STATUS.md](BUILD-STATUS.md)** - Build status and next steps

---

## 💡 Common Tasks

### Enter Container Shell
```bash
docker exec -it carbon-compute bash          # As carbon user
docker exec -it -u root carbon-compute bash  # As root
```

### Check Service Status
```bash
docker exec carbon-compute supervisorctl status
```

### View Logs
```bash
docker exec carbon-compute tail -f /var/log/vnc.out.log
docker exec carbon-compute tail -f /var/log/jupyter/out.log
docker exec carbon-compute tail -f /var/log/xrdp.out.log
```

### Restart Services
```bash
docker exec carbon-compute supervisorctl restart vnc
docker exec carbon-compute supervisorctl restart jupyter
docker exec carbon-compute supervisorctl restart xrdp
```

### Copy Files
```bash
# Copy to container
docker cp myfile.txt carbon-compute:/work/

# Copy from container
docker cp carbon-compute:/work/result.csv ./
```

### Install Additional Software
```bash
docker exec -it -u root carbon-compute bash
apt-get update
apt-get install <package>

# Or use pip/npm/conda
pip install <package>
conda install <package>
npm install -g <package>
```

---

## ⚙️ Configuration & Customization

All Carbon images support extensive configuration without rebuilding:

**🔐 Security:**
- Custom passwords for user, VNC, code-server, databases
- UID/GID mapping for file ownership

**📁 Workspace:**
- Custom `/work` directory location
- Custom `/data` directory for databases
- Optional home directory mounting

**🖥️ Display:**
- Custom resolution (1080p, 2K, 4K, etc.)
- Color depth settings
- VNC display configuration

**⚙️ Service Toggles (Save Resources!):**
- Databases **OFF by default** (enable as needed)
- Enable/disable: PostgreSQL, MongoDB, Redis, Mosquitto
- Enable/disable: Jupyter, code-server, Spark
- Enable/disable: Ollama, vLLM
- Enable/disable: VNC, xRDP

**💪 Resources:**
- Memory limits
- CPU limits
- GPU device selection

**🔌 Ports:**
- All ports customizable
- Support for multiple containers
- Conflict resolution

**Configuration Methods:**
1. **`.env` file** - Copy `.env.example`, edit, and start
2. **Environment variables** - `ENABLE_POSTGRESQL=true ./start-...`
3. **Command-line args** - `--password MyPass --memory 32g`

**Quick Examples:**
```bash
# Custom password
./start-carbon-configurable.sh --password MySecret123

# Enable PostgreSQL only
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh

# 4K resolution with 32GB RAM
./start-carbon-configurable.sh --resolution 3840x2160 --memory 32g

# Use .env for persistent config
cp .env.example .env && nano .env
./start-carbon-configurable.sh
```

📖 **See [CONFIGURATION.md](CONFIGURATION.md) and [SERVICE-TOGGLES.md](SERVICE-TOGGLES.md) for complete details**

---

## 🎨 Features by Image

### carbon-base
✅ Full Cinnamon desktop with Arc-Dark theme
✅ VNC/noVNC/xRDP remote access
✅ ChrisTitusTech mybash (Starship, zoxide, fastfetch)
✅ Python 3, Node.js, Go, Java, Rust, .NET, Swift, R
✅ Databases: PostgreSQL 14, MongoDB 7.0, Redis, Mosquitto, Qdrant
✅ PostgreSQL Extensions: **pgvector v0.5.0**, **PostGIS 3.x**
✅ VS Code, Firefox, Chrome, Chromium
✅ Git, Docker CLI (client only)
✅ CUDA 12.1 + Ollama + vLLM (GPU variant)
✅ VirtualGL + TurboVNC

### carbon-compute
✅ Everything from carbon-base (GPU)
✅ Jupyter Lab with rich extensions
✅ code-server (VS Code in browser)
✅ Apache Spark cluster
✅ PyTorch 2.4 (CUDA 12.1)
✅ TensorFlow, Keras
✅ Transformers, LangChain, sentence-transformers
✅ scikit-learn, pandas, numpy, matplotlib
✅ PySpark, Delta Lake
✅ .NET Interactive kernel
✅ 100+ VS Code extensions

### carbon-tools
✅ Everything from carbon-base
✅ **Creative**: Blender 4.5, GIMP, Krita, Inkscape, Kdenlive, OBS, Audacity
✅ **Security**: nmap, Wireshark, sqlmap, hydra, hashcat, SecLists
✅ **Retro**: VICE (C64), RetroArch, MAME, C64 Debugger
✅ **DevOps**: Docker CLI, kubectl, Terraform, Ansible, AWS CLI, gh
✅ **CAD**: FreeCAD, MeshLab
✅ **Publishing**: Scribus, LibreOffice

---

## 📊 Resource Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 50 GB

**Recommended (GPU builds):**
- CPU: 8+ cores
- RAM: 16+ GB
- Disk: 100+ GB
- GPU: 8+ GB VRAM

**Image Sizes (GPU-Enabled with CPU Fallback):**
- carbon-base:latest: **18.18 GB** (GPU-enabled, smaller than old minimal variant!)
- carbon-compute:latest: **55.72 GB** (includes vLLM, PyTorch, TensorFlow)
- carbon-tools:latest: **27.56 GB** (includes Blender, creative tools)
- **Architecture**: Unified GPU-enabled images with automatic CPU fallback
- **Benefit**: No more confusing variants - one tag per image, works everywhere!

---

## 🐛 Troubleshooting

### Can't connect to desktop?
1. Wait 30-40 seconds after container starts
2. Try noVNC first: http://localhost:6900
3. Check services: `docker exec <container> supervisorctl status`
4. Check VNC logs: `docker exec <container> tail -f /var/log/vnc.out.log`

### GPU not detected?
```bash
# Test in container
docker exec <container> nvidia-smi

# If fails, check host
nvidia-smi

# Verify Docker runtime
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

### Jupyter won't start?
```bash
# Check logs
docker exec carbon-compute tail -f /var/log/jupyter/out.log

# Restart
docker exec carbon-compute supervisorctl restart jupyter

# Get token
docker exec carbon-compute jupyter server list
```

### Database connection issues?
```bash
# Check status
docker exec <container> supervisorctl status | grep -E "(postgres|mongo|redis)"

# Test connections
docker exec <container> psql -U postgres -c "SELECT version();"
docker exec <container> mongosh --eval "db.version()"
docker exec <container> redis-cli ping
```

---

## 🔒 Security Considerations

⚠️ **These images are designed for development environments, NOT production!**

**Security notes:**
- Default credentials should be changed in production-like environments
- Services listen on all interfaces (0.0.0.0) - use firewall rules
- No TLS/SSL enabled by default
- Root access available via sudo without password
- Database authentication enabled but uses default passwords

**Recommendations:**
- Run on isolated networks or use VPN
- Change default passwords via environment variables
- Use Docker secrets for sensitive data
- Regular security updates: `apt-get update && apt-get upgrade`
- Limit exposed ports to only what you need

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

**Areas for contribution:**
- Additional language runtimes
- More development tools
- Performance optimizations
- Documentation improvements
- Bug fixes

---

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- Ubuntu 22.04
- NVIDIA CUDA
- Cinnamon Desktop
- TigerVNC / noVNC
- xRDP
- Jupyter Project
- Apache Spark
- code-server (VS Code)
- And many more open source projects

---

## 📧 Support

- **Website**: [wisejnrs.net](https://www.wisejnrs.net)
- **Issues**: Open a GitHub issue
- **Discussions**: Use GitHub Discussions
- **Documentation**: See [docs/](docs/) directory

---

## ✨ Recent Updates (2025-12-16)

### Latest Session - GPU-Only Architecture v2.0 (9 Commits)
- 🚀 **UNIFIED GPU ARCHITECTURE** - One image per tier, works everywhere!
  - ✅ **No more variants** - Eliminated confusing `-gpu` and `-minimal` tags
  - ✅ **Automatic CPU fallback** - GPU images work perfectly on CPU-only systems
  - ✅ **Smaller images** - GPU variant is 6.8GB smaller than old minimal!
  - ✅ **Published to Docker Hub** - `wisejnrs/carbon-*:latest` ready to use
- 🎯 **Size Optimizations**:
  - carbon-base: **18.18 GB** (moved vLLM to compute, removed .NET 6/8)
  - carbon-compute: **55.72 GB** (now includes vLLM where it belongs)
  - carbon-tools: **27.56 GB** (benefits from smaller base)
- 📦 **Docker Hub Ready** - All images pushed and available for public use
- 🔧 **Optimizations Applied**:
  - Moved vLLM from base to compute (saved 13.5 GB from base)
  - Removed .NET 6.0 and 8.0 SDKs, kept only 9.0 (saved 1 GB)
  - Multi-stage builds with CUDA runtime (not devel)
  - Swift 6.1.2 for Apple Watch development
- 📚 **Documentation**:
  - Added `GPU-ARCHITECTURE.md` - Complete architecture rationale
  - Added `REBUILD-RESULTS.md` - Final build results and testing
  - Updated README with Docker Hub and Docker Compose examples

### Why GPU-Only?
- **Simpler**: One tag per image, not multiple variants
- **Smaller**: CUDA runtime (16.8GB) vs minimal variant (23.6GB) = 6.8GB saved!
- **Smarter**: Automatic GPU detection and CPU fallback
- **Universal**: Works on both GPU and CPU-only systems
- **Future-proof**: Ready for GPU-accelerated workflows

### Status
- **Code**: All committed and pushed to GitHub ✓ (9 commits)
- **Images**: All rebuilt with `--no-cache` and optimized ✓
- **Docker Hub**: All 3 images published to `wisejnrs/*` ✓
- **Testing**: Ready for production use ✓
- **Documentation**: Complete with usage examples ✓

## 🗺️ Roadmap

- [ ] ARM64 support
- [ ] Kubernetes Helm charts
- [ ] VS Code Remote Containers integration
- [ ] Pre-built extensions marketplace
- [ ] Web-based service configuration UI
- [ ] Multi-user support
- [ ] Automated testing pipeline
- [ ] Docker Compose templates

---

**Built with ❤️ for developers, data scientists, and creators**

**Created by [Michael Wise (WiseJNRS)](https://www.wisejnrs.net)**
Visit [wisejnrs.net](https://www.wisejnrs.net) for more projects and resources.
