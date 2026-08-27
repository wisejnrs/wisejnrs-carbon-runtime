# Carbon Image Suite Documentation

The Carbon image suite provides three specialized development containers with full desktop environments, GPU support, and comprehensive tooling for different workflows.

**✨ New:** All images now support extensive configuration via environment variables, `.env` files, and command-line options. See [CONFIGURATION.md](CONFIGURATION.md) for details.

**💡 Key Feature:** Databases are **OFF by default** to save 2-4GB RAM. Enable only what you need!

## 🏗️ Architecture

```
Linux (NVIDIA CUDA):
  carbon-base (foundation)
      ├── carbon-compute (ML/AI/Data Science)
      └── carbon-tools (Creative/Security/DevOps)

Linux (Intel Arc):
  carbon-base-arc (foundation)
      ├── carbon-compute-arc (ML/AI with XPU)
      └── carbon-tools-arc (Creative/Security/DevOps)

macOS:
  carbon-base-macos (foundation)
      ├── carbon-compute-macos (ML/AI with MPS)
      └── carbon-tools-macos (Creative/Security/DevOps)
```

All images inherit from `carbon-base` and include:
- Full Cinnamon desktop environment
- VNC, noVNC, and xRDP remote access
- PostgreSQL, MongoDB, Redis databases
- GPU support (when built with `BUILD_GPU=true`)
- Comprehensive development tools

---

## 📦 Image Details

### 1. carbon-base

**Purpose**: Foundation image with desktop, databases, and core development tools

**Key Features:**
- **Desktop**: Cinnamon desktop optimized for VNC/RDP
- **Remote Access**:
  - noVNC (web browser, port 6900)
  - xRDP (RDP clients, port 3389)
  - TigerVNC (VNC clients, port 5901)
- **Databases**: PostgreSQL, MongoDB, Redis, Mosquitto
- **GPU**: CUDA 12.1, VirtualGL, TurboVNC (optional)
- **Languages**: Python 3, Node.js, Go, Java 17, Rust, Swift, R
- **Runtimes**: .NET 6/8/9, PowerShell
- **AI/ML**: Ollama, vLLM (GPU builds only)
- **Browsers**: Firefox, Chrome, Chromium
- **IDEs**: VS Code

**Variants:**
- `wisejnrs/carbon-base:latest-gpu` - With CUDA, GPU support, Ollama, vLLM
- `wisejnrs/carbon-base:latest-minimal` - Without GPU dependencies

**Build:**
```bash
# GPU version
docker build --build-arg BUILD_GPU=true -t wisejnrs/carbon-base:latest-gpu carbon-base/

# Minimal version
docker build --build-arg BUILD_GPU=false -t wisejnrs/carbon-base:latest-minimal carbon-base/
```

**Start:**
```bash
# Pre-configured scripts
./start-carbon-gpu.sh      # GPU version
./start-carbon-remote.sh   # Minimal version

# Or use configurable launcher
./start-carbon-configurable.sh --image base --variant gpu
./start-carbon-configurable.sh --image base --variant minimal

# Enable services as needed
ENABLE_POSTGRESQL=true ENABLE_REDIS=true ./start-carbon-configurable.sh
```

**Access:**
- Web Desktop: http://localhost:6900
- RDP: localhost:3389 (user: carbon, pass: Carbon123#)
- VNC: localhost:5900 (pass: Carbon123#)

---

### 2. carbon-compute

**Purpose**: ML/AI workstation with Jupyter, Spark, and comprehensive data science stack

**Built On**: `carbon-base:latest-gpu` (requires GPU base)

**Additional Features:**
- **Jupyter Lab** (port 8888) - Full data science environment
- **code-server** (port 9999) - VS Code in browser
- **Apache Spark** cluster (master UI: 8080, worker: 8081)
- **Conda/Mamba** - Package management
- **Python ML/AI Stack**:
  - PyTorch 2.4 (CUDA 12.1)
  - TensorFlow, Keras
  - Transformers, Sentence-Transformers
  - scikit-learn, pandas, numpy
  - LangChain, Ollama client
  - PySpark, Delta Lake
- **Extensions**: 100+ VS Code extensions pre-installed
- **.NET Interactive** - Jupyter kernel for C#/F#
- **Visualization**: Matplotlib, Seaborn, Plotly, pygwalker

**Build:**
```bash
docker build \
  --build-arg ROOT_CONTAINER=wisejnrs/carbon-base:latest-gpu \
  -t wisejnrs/carbon-compute:latest \
  carbon-compute/
```

**Start:**
```bash
# Pre-configured script
./start-carbon-compute.sh

# Or use configurable launcher
./start-carbon-configurable.sh --image compute

# With custom settings
./start-carbon-configurable.sh \
  --image compute \
  --password MyPass123 \
  --work-dir ~/ml-projects \
  --memory 32g

# Enable database for results storage
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh --image compute
```

**Access:**
- Jupyter Lab: http://localhost:8888
- code-server: http://localhost:9999 (pass: Carbon123#)
- Spark Master: http://localhost:8080
- Web Desktop: http://localhost:6900
- RDP: localhost:3389

**Volumes:**
- `/data` - Database persistence
- `/work` - Your workspace (auto-mounted)

**Use Cases:**
- Machine Learning model training
- Data analysis with Jupyter notebooks
- Spark big data processing
- AI experimentation with Ollama/vLLM
- Remote development with code-server

---

### 3. carbon-tools

**Purpose**: Creative workstation + Security toolkit + DevOps tools

**Built On**: `carbon-base:latest-gpu` OR `carbon-base:latest-minimal`

**Additional Features:**

**🎨 Creative Tools:**
- **3D**: Blender 4.5
- **Image**: GIMP, Krita, Inkscape, Darktable
- **Video**: Kdenlive, OBS Studio, Handbrake, Shotcut
- **Audio**: Audacity, LMMS, MuseScore
- **CAD**: FreeCAD, MeshLab
- **Publishing**: Scribus, LibreOffice

**🔒 Security Tools:**
- Network: nmap, nikto, masscan, Wireshark
- Web: sqlmap, gobuster, dirb, wfuzz, wafw00f
- Password: hydra, hashcat
- OSINT: theHarvester, sherlock, exiftool
- Wordlists: SecLists (/usr/share/seclists)

**🎮 Retro Emulation:**
- VICE (Commodore 64)
- RetroArch (multi-system)
- MAME (arcade)
- C64 Debugger
- ROM directory: /roms

**☁️ DevOps Tools:**
- Docker CLI
- kubectl
- Terraform
- Ansible
- GitHub CLI (gh)
- AWS CLI

**CLI Tools:**
- zoxide (smart cd)
- fzf (fuzzy finder)
- jq (JSON processor)
- httpie

**Variants:**
- `wisejnrs/carbon-tools:latest-gpu` - With GPU support for Blender, video editing
- `wisejnrs/carbon-tools:latest-minimal` - Without GPU dependencies

**Build:**
```bash
# GPU version
docker build \
  --build-arg ROOT_CONTAINER=wisejnrs/carbon-base:latest-gpu \
  -t wisejnrs/carbon-tools:latest-gpu \
  carbon-tools/

# Minimal version
docker build \
  --build-arg ROOT_CONTAINER=wisejnrs/carbon-base:latest-minimal \
  -t wisejnrs/carbon-tools:latest-minimal \
  carbon-tools/
```

**Start:**
```bash
# Pre-configured scripts
./start-carbon-tools.sh        # Minimal version
./start-carbon-tools.sh --gpu  # GPU version

# Or use configurable launcher
./start-carbon-configurable.sh --image tools --variant gpu
./start-carbon-configurable.sh --image tools --variant minimal

# With custom settings
./start-carbon-configurable.sh \
  --image tools \
  --variant gpu \
  --resolution 3840x2160 \
  --memory 32g
```

**Access:**
- Web Desktop: http://localhost:6900 (use this for GUI tools!)
- RDP: localhost:3389
- VNC: localhost:5900

**Use Cases:**
- 3D modeling and rendering with Blender
- Video editing and production
- Security testing and penetration testing
- Retro game development (C64, NES, SNES)
- DevOps automation and infrastructure work
- Graphic design and digital art

---

### 4. Intel Arc Variants (carbon-*-arc)

**Purpose**: Same functionality as NVIDIA variants but optimized for Intel Arc GPUs

**GPU Support:**
- Intel Arc A-series (A770, A750, A380)
- Intel Arc B-series (B580)
- Intel Core Ultra with Arc Graphics
- Intel Data Center GPU Max/Flex Series

**Key Differences from NVIDIA:**
| Aspect | NVIDIA | Intel Arc |
|--------|--------|-----------|
| Base Image | `nvidia/cuda:12.1` | `intel/oneapi-basekit:2025` |
| Runtime | CUDA 12.1 | oneAPI 2025.1, Level Zero |
| PyTorch Device | `cuda` | `xpu` |
| Docker Flag | `--gpus all` | `--device=/dev/dri` |
| Monitor | `nvidia-smi` | `xpu-smi`, `sycl-ls` |

**Build:**
```bash
# Build all Arc variants
./build-all-arc.sh

# Build specific image
docker build -t wisejnrs/carbon-base-arc:latest carbon-base-arc/
docker build -t wisejnrs/carbon-compute-arc:latest carbon-compute-arc/
```

**Start:**
```bash
# With Intel Arc GPU
docker run -d --device=/dev/dri \
  -p 6900:6900 -p 3389:3389 \
  wisejnrs/carbon-base-arc:latest

# For profiling tools
docker run -d --device=/dev/dri \
  --cap-add=SYS_ADMIN --cap-add=SYS_PTRACE \
  -p 6900:6900 \
  wisejnrs/carbon-compute-arc:latest
```

**Documentation:** See [INTEL-ARC.md](INTEL-ARC.md) for complete setup guide.

---

## 🚀 Quick Start

### Build All Images

```bash
# Build everything (GPU + minimal variants)
./build-all.sh --all

# Build only GPU variants (base-gpu, compute, tools-gpu)
./build-all.sh --gpu

# Build only minimal variants (base-minimal, tools-minimal)
./build-all.sh --minimal

# Build and push to registry
./build-all.sh --all --push
```

### Start Containers

```bash
# Base image
./start-carbon-gpu.sh          # With GPU
./start-carbon-remote.sh       # Without GPU

# Compute image (ML/AI)
./start-carbon-compute.sh      # Always uses GPU

# Tools image (Creative/Security)
./start-carbon-tools.sh --gpu  # With GPU
./start-carbon-tools.sh        # Without GPU
```

---

## 🔌 Port Reference

| Port | Service | Image(s) |
|------|---------|----------|
| 3389 | xRDP | All |
| 5900 | VNC (external map to 5901) | All |
| 5901 | VNC (internal) | All |
| 6900 | noVNC (web) | All |
| 5432 | PostgreSQL | All |
| 6379 | Redis | All |
| 27017 | MongoDB | All |
| 8888 | Jupyter Lab | compute |
| 9999 | code-server | compute |
| 7077 | Spark Master | compute |
| 8080 | Spark Master UI | compute |
| 8081 | Spark Worker UI | compute |
| 11434 | Ollama API | base (GPU), compute |
| 3000 | Development | tools |

---

## 💾 Data Persistence

All images use `/data` volume for database persistence:

- PostgreSQL: `/data/postgresql`
- MongoDB: `/data/mongodb`
- Redis: `/data/redis`

Workspace is mounted at `/work` for your projects.

**Example with custom volumes:**
```bash
docker run -d \
  --name my-carbon \
  -v /my/data:/data \
  -v /my/projects:/work \
  -p 6900:6900 \
  wisejnrs/carbon-base:latest-gpu
```

---

## 🎮 GPU Requirements

For GPU-enabled images:
- NVIDIA GPU with compute capability 6.0+
- NVIDIA drivers installed on host
- Docker with NVIDIA runtime (`nvidia-docker2`)

**Test GPU access:**
```bash
docker run --rm --gpus all wisejnrs/carbon-base:latest-gpu nvidia-smi
```

---

## 🔐 Default Credentials

- **User**: carbon
- **Password**: Carbon123#
- **VNC Password**: Carbon123#
- **code-server Password**: Carbon123# (can be changed with `-e CODE_SERVER_PASSWORD=...`)

**Database credentials:**
- PostgreSQL: user `postgres` or `carbon`, password `Carbon123#`
- MongoDB: user `carbon`, password `Carbon123#`
- Redis: no password (localhost only)

---

## 🛠️ Customization

### Add Your Own Supervisor Services

Place `.conf` files in `/work/supervisor.d/`:

```ini
[program:myapp]
command=/path/to/myapp
user=carbon
autostart=true
autorestart=true
```

Then reload: `supervisorctl reread && supervisorctl update`

### Install Additional Packages

```bash
# Enter running container
docker exec -it carbon-compute bash

# Install packages
sudo apt-get update
sudo apt-get install <package>

# Or with pip/npm/conda
pip install <package>
npm install -g <package>
conda install <package>
```

### Create Custom Image

```dockerfile
FROM wisejnrs/carbon-base:latest-gpu

# Add your customizations
RUN apt-get update && apt-get install -y my-tools

# Add your config files
COPY my-configs/ /home/carbon/

USER root
```

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

**Image Sizes (actual):**
- carbon-base:latest-minimal: 23.6 GB
- carbon-base:latest-gpu: 16.8 GB
- carbon-compute:latest: 42.6 GB
- carbon-tools:latest: 39.4 GB
- carbon-tools:latest-gpu: 53.8 GB

---

## 🐛 Troubleshooting

### Services not starting
```bash
# Check supervisor status
docker exec <container> supervisorctl status

# Check specific service logs
docker exec <container> tail -f /var/log/vnc.out.log
docker exec <container> tail -f /var/log/jupyter/out.log
```

### Can't connect to desktop
1. Wait 30-40 seconds after container starts
2. Check VNC is running: `docker exec <container> supervisorctl status vnc`
3. Check xrdp is running: `docker exec <container> supervisorctl status xrdp`
4. Try noVNC first: http://localhost:6900

### GPU not detected
```bash
# Check NVIDIA runtime
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi

# Check in container
docker exec <container> nvidia-smi
```

### Database connection issues
```bash
# Check databases are running
docker exec <container> supervisorctl status | grep -E "(postgres|mongo|redis)"

# Test connections
docker exec <container> psql -U postgres -c "SELECT version();"
docker exec <container> mongosh --eval "db.version()"
docker exec <container> redis-cli ping
```

---

## 📝 License

See repository LICENSE file.

## 🤝 Contributing

Contributions welcome! Please open issues or pull requests.

## 📧 Support

For issues, questions, or feedback, please open a GitHub issue.
