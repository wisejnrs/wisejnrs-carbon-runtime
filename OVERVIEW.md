# Carbon Development Environment - Complete Overview

**Full-stack development environments with GPU acceleration, desktop UI, and comprehensive tooling**

---

## 📦 What is Carbon?

Carbon is a suite of Docker images that provide complete development environments with:
- **Full Desktop**: Cinnamon desktop accessible via web browser, RDP, or VNC
- **GPU Acceleration**: NVIDIA CUDA support for ML/AI workloads
- **Databases**: PostgreSQL, MongoDB, Redis (optional)
- **Multi-Language**: Python, Node.js, Go, Java, Rust, .NET, Swift, R
- **Specialized Tools**: ML/AI, creative apps, security tools, retro emulation
- **Zero Configuration**: Works out of the box with sensible defaults
- **Fully Configurable**: Customize everything via environment variables

---

## 🎯 Three Images, Different Workflows

### carbon-base - Foundation
**Best for**: General development, web development, learning
- Desktop environment with all modern browsers
- All major programming languages
- Optional databases and GPU support
- Lightweight (~23GB minimal, ~44GB with GPU)

### carbon-compute - ML/AI Workstation
**Best for**: Machine learning, data science, big data
- Jupyter Lab for notebooks
- code-server (VS Code in browser)
- Apache Spark cluster
- PyTorch, TensorFlow, scikit-learn
- Built on GPU base (~35GB)

### carbon-tools - Creative & Security
**Best for**: 3D modeling, video editing, pentesting, retro gaming
- Blender, GIMP, Kdenlive, OBS Studio
- Security tools: nmap, Wireshark, sqlmap, hydra
- Retro emulation: VICE, RetroArch, MAME
- DevOps: Docker, kubectl, Terraform, Ansible
- (~30-35GB depending on GPU variant)

---

## 🚀 Getting Started in 3 Steps

### Step 1: Build
```bash
./build-all.sh --all
```

### Step 2: Configure (Optional)
```bash
cp .env.example .env
nano .env  # Set your password, workspace, enable services
```

### Step 3: Start
```bash
./start-carbon-configurable.sh
```

**Access**: Open http://localhost:6900 in your browser - you now have a full desktop!

---

## ⚙️ Configuration Highlights

### Defaults (Resource Optimized)
- **Password**: Carbon123# (⚠️ change this!)
- **Databases**: OFF (enable as needed)
- **GPU**: ON (use minimal variant if no GPU)
- **Desktop**: ON (VNC + xRDP)
- **Memory**: 16GB limit
- **Workspace**: `./work` directory

### Easy Customization
```bash
# Custom password and workspace
./start-carbon-configurable.sh --password MyPass --work-dir ~/projects

# Enable PostgreSQL for development
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh

# 4K desktop with more resources
./start-carbon-configurable.sh --resolution 3840x2160 --memory 32g
```

### Service Toggles (Pick What You Need)
- ✅ Jupyter Lab, code-server, Spark (ON by default)
- ✅ VNC, xRDP desktop (ON by default)
- ⚪ PostgreSQL, MongoDB, Redis (OFF by default - saves 2-4GB RAM)
- ⚪ Ollama, vLLM (OFF by default - saves 1-3GB RAM)

**Why databases OFF by default?**
Most users don't need all databases running. Enable only what your workflow requires to save memory and speed up startup.

---

## 🌐 Three Ways to Access

### 1. Web Browser (Easiest!)
```
http://localhost:6900
```
- No software installation needed
- Works on any device (laptop, phone, tablet)
- Full desktop in browser via noVNC

### 2. Remote Desktop (Best Performance)
```
localhost:3390
User: carbon
Pass: Carbon123# (or your custom password)
```
- Windows: Use built-in "Remote Desktop Connection"
- Mac: "Microsoft Remote Desktop" from App Store
- Linux: Remmina or xfreerdp

### 3. VNC Client (Traditional)
```
localhost:5900
Password: Carbon123# (or your custom password)
```
- Use TigerVNC, RealVNC, or any VNC viewer

---

## 💡 Common Scenarios

### Scenario 1: Python Web Development
```bash
# Start minimal base
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh

# Access: http://localhost:6900
# Use: VS Code, Firefox, PostgreSQL
```

### Scenario 2: Machine Learning
```bash
# Start compute with custom workspace
./start-carbon-configurable.sh \
  --image compute \
  --work-dir ~/ml-projects \
  --memory 32g

# Access Jupyter: http://localhost:8888
# Access Desktop: http://localhost:6900
# Use: PyTorch, TensorFlow, Jupyter notebooks
```

### Scenario 3: Database Development
```bash
# Enable all databases
ENABLE_POSTGRESQL=true \
ENABLE_MONGODB=true \
ENABLE_REDIS=true \
./start-carbon-configurable.sh

# Access databases on standard ports
# Use desktop tools or connect externally
```

### Scenario 4: 3D Modeling / Video Editing
```bash
# Start tools with GPU and 4K display
./start-carbon-configurable.sh \
  --image tools \
  --variant gpu \
  --resolution 3840x2160 \
  --memory 32g

# Access: http://localhost:6900
# Use: Blender, Kdenlive, OBS Studio
```

### Scenario 5: Security Testing
```bash
# Start tools, disable unused services
ENABLE_POSTGRESQL=false \
ENABLE_JUPYTER=false \
./start-carbon-configurable.sh --image tools

# Access desktop for Wireshark GUI
# Or exec into container for CLI tools
```

---

## 📊 Resource Planning

| Use Case | Image | Memory | Databases | GPU |
|----------|-------|--------|-----------|-----|
| Light dev | base-minimal | 4-8GB | OFF | No |
| Web dev + DB | base | 8-16GB | PostgreSQL only | Optional |
| ML/AI work | compute | 16-32GB | Optional | Yes |
| 3D/Video | tools-gpu | 16-32GB | OFF | Yes |
| Security testing | tools-minimal | 8-16GB | OFF | No |

**Formula:**
- Base Desktop: ~2GB
- Each Database: ~200-500MB
- Jupyter Lab: ~500MB
- Spark: ~1GB
- Ollama: ~1-2GB
- GPU workload: 4-16GB+

**Tip**: Start minimal, enable services as needed!

---

## 🎛️ Managing Running Containers

### Check Services
```bash
docker exec carbon-base supervisorctl status
```

### Enable Service in Running Container
```bash
docker exec carbon-base bash -c '
  mv /etc/supervisor/conf.d/postgres.conf.disabled /etc/supervisor/conf.d/postgres.conf
  supervisorctl reread && supervisorctl update
  supervisorctl start postgres
'
```

### View Logs
```bash
docker exec carbon-base tail -f /var/log/postgres.err.log
docker exec carbon-base tail -f /var/log/vnc.out.log
```

### Resource Usage
```bash
docker stats carbon-base
```

---

## 📖 Documentation Index

**Start Here:**
1. **[README.md](README.md)** - This overview (you are here!)
2. **[QUICK-START.md](QUICK-START.md)** - 5-minute quickstart

**Configuration:**
3. **[CONFIGURATION.md](CONFIGURATION.md)** - Complete configuration guide
4. **[SERVICE-TOGGLES.md](SERVICE-TOGGLES.md)** - Service management
5. **[.env.example](.env.example)** - Configuration template

**Reference:**
6. **[IMAGES.md](IMAGES.md)** - Detailed image documentation
7. **[PORTS.md](PORTS.md)** - Port mappings and conflicts
8. **[XRDP-FIX.md](XRDP-FIX.md)** - xRDP troubleshooting

**Status:**
9. **[BUILD-STATUS.md](BUILD-STATUS.md)** - Build status and testing

---

## 🎯 Choose Your Path

### Path 1: "Just show me the desktop!"
```bash
./build-all.sh --gpu
./start-carbon-configurable.sh
# Open: http://localhost:6900
```

### Path 2: "I need Jupyter for ML work"
```bash
./build-all.sh --gpu
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh --image compute
# Open: http://localhost:8888
```

### Path 3: "I want full control"
```bash
./build-all.sh --all
cp .env.example .env
nano .env  # Customize everything
./start-carbon-configurable.sh
```

---

## 🔑 Key Features Summary

✅ **Three specialized images** (base, compute, tools)
✅ **GPU acceleration** (CUDA 12.1, optional)
✅ **Full desktop** (Cinnamon, optimized for remote access)
✅ **Three access methods** (Web, RDP, VNC)
✅ **Multiple databases** (PostgreSQL, MongoDB, Redis - optional)
✅ **Multi-language** (Python, Node.js, Go, Java, Rust, .NET, Swift, R)
✅ **Complete configuration** (passwords, services, resources, ports)
✅ **Resource efficient** (databases off by default)
✅ **Easy deployment** (one-line start scripts)
✅ **Professional documentation** (9 detailed guides)

---

**Get Started**: `./start-carbon-configurable.sh --help`

**Repository**: https://github.com/wisejnrs/wisejnrs-carbon-runtime
