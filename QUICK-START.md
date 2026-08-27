# Carbon Quick Start Guide

## 🎯 Choose Your Image

### carbon-base
**Best for**: General development, web development, basic data science
**Has**: Desktop, databases, languages, browsers, VS Code
**GPU**: Optional

### carbon-compute
**Best for**: Machine learning, AI, big data, Jupyter notebooks
**Has**: Everything from base + Jupyter Lab, Spark, PyTorch, TensorFlow
**GPU**: Required (built on base-gpu)

### carbon-tools
**Best for**: Creative work, security testing, retro gaming, DevOps
**Has**: Everything from base + Blender, GIMP, security tools, emulators
**GPU**: Optional (recommended for Blender/video editing)

---

## ⚡ Quick Commands

### Build Images

```bash
# Build all variants
./build-all.sh --all

# Build only what you need
./build-all.sh --gpu      # GPU images only
./build-all.sh --minimal  # Non-GPU only
```

### Start Containers

```bash
# Base
./start-carbon-gpu.sh          # With GPU
./start-carbon-remote.sh       # Without GPU

# Compute (ML/AI)
./start-carbon-compute.sh

# Tools (Creative/Security)
./start-carbon-tools.sh --gpu  # With GPU
./start-carbon-tools.sh        # Without GPU
```

### Stop Containers

```bash
docker stop carbon-gpu && docker rm carbon-gpu
docker stop carbon-compute && docker rm carbon-compute
docker stop carbon-tools && docker rm carbon-tools
```

---

## 🌐 Access Methods

### Web Browser (Easiest!)
```
http://localhost:6900
```
- No software needed
- Works on any device with a browser
- Full desktop in browser

### RDP Client (Best Performance)
```
Host: localhost
Port: 3390  ⚠️ (NOT 3389 - avoids Windows RDP conflict)
User: carbon
Pass: Carbon123#
```

Windows: Use built-in "Remote Desktop Connection" (mstsc.exe)
Mac: Download "Microsoft Remote Desktop" from App Store
Linux: Use Remmina or xfreerdp

**Important**: Connect to port **3390**, not 3389!

### VNC Client
```
Host: localhost:5900
Password: Carbon123#
```

---

## 📊 Service URLs

### carbon-base
- Desktop: http://localhost:6900
- Ollama API: http://localhost:11434 (GPU only)

### carbon-compute
- Desktop: http://localhost:6900
- **Jupyter Lab**: http://localhost:8888
- **code-server**: http://localhost:9999 (pass: Carbon123#)
- Spark Master: http://localhost:8080
- Ollama API: http://localhost:11434

### carbon-tools
- Desktop: http://localhost:6900

### All Images
- PostgreSQL: localhost:5432 (user: postgres/carbon, pass: Carbon123#)
- MongoDB: localhost:27017 (user: carbon, pass: Carbon123#)
- Redis: localhost:6379

---

## 🎮 GPU Setup

### 1. Install NVIDIA Drivers (if not already installed)

```bash
# Ubuntu/Debian
sudo ubuntu-drivers autoinstall
sudo reboot

# Check installation
nvidia-smi
```

### 2. Install NVIDIA Docker Runtime

```bash
# Add repository
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
curl -s -L https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list | \
  sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
  sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

# Install
sudo apt-get update
sudo apt-get install -y nvidia-container-toolkit

# Configure Docker
sudo nvidia-ctk runtime configure --runtime=docker
sudo systemctl restart docker
```

### 3. Test GPU Access

```bash
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi
```

---

## 💡 Common Tasks

### Access Container Shell

```bash
# As carbon user
docker exec -it carbon-compute bash

# As root
docker exec -it -u root carbon-compute bash
```

### Install Additional Software

```bash
# Enter container as root
docker exec -it -u root carbon-compute bash

# Install packages
apt-get update
apt-get install <package>

# Or use pip/npm/conda
pip install <package>
conda install <package>
npm install -g <package>
```

### Check Service Status

```bash
docker exec carbon-compute supervisorctl status
```

### View Logs

```bash
# All logs
docker logs carbon-compute

# Specific service
docker exec carbon-compute tail -f /var/log/vnc.out.log
docker exec carbon-compute tail -f /var/log/jupyter/out.log
docker exec carbon-compute tail -f /var/log/xrdp.out.log
```

### Copy Files In/Out

```bash
# Copy TO container
docker cp myfile.txt carbon-compute:/work/

# Copy FROM container
docker cp carbon-compute:/work/result.csv ./
```

### Restart Services

```bash
docker exec carbon-compute supervisorctl restart vnc
docker exec carbon-compute supervisorctl restart xrdp
docker exec carbon-compute supervisorctl restart jupyter
```

---

## 🔧 Troubleshooting

### Can't connect to desktop?

1. **Wait 30-40 seconds** after starting container
2. **Try noVNC first**: http://localhost:6900
3. **Check services**:
   ```bash
   docker exec carbon-compute supervisorctl status
   ```
4. **Check logs**:
   ```bash
   docker exec carbon-compute tail -f /var/log/vnc.out.log
   docker exec carbon-compute tail -f /var/log/xrdp.out.log
   ```

### Desktop is slow/laggy?

- Use RDP instead of noVNC for better performance
- Lower resolution if needed
- Make sure container has enough CPU/RAM

### GPU not working?

```bash
# Test GPU in container
docker exec carbon-compute nvidia-smi

# If fails, check host
nvidia-smi

# Rebuild with GPU flag
./build-all.sh --gpu
```

### Jupyter won't start?

```bash
# Check logs
docker exec carbon-compute tail -f /var/log/jupyter/out.log

# Restart service
docker exec carbon-compute supervisorctl restart jupyter

# Get token manually
docker exec carbon-compute jupyter server list
```

### Database won't connect?

```bash
# Check database services
docker exec carbon-compute supervisorctl status | grep -E "(postgres|mongo|redis)"

# Test connections
docker exec carbon-compute psql -U postgres -c "SELECT version();"
docker exec carbon-compute mongosh --eval "db.version()"
docker exec carbon-compute redis-cli ping
```

---

## 📁 File Locations

### Important Directories

- `/work` - Your workspace (mounted from host)
- `/data` - Database data (mounted from host)
- `/home/carbon` - User home directory
- `/var/log` - Service logs

### Configuration Files

- VNC: `/home/carbon/.vnc/`
- Jupyter: `/home/carbon/.jupyter/`
- Supervisor: `/etc/supervisor/conf.d/`
- Custom services: `/work/supervisor.d/`

### Database Data

- PostgreSQL: `/data/postgresql/`
- MongoDB: `/data/mongodb/`
- Redis: `/data/redis/`

---

## 🎯 Use Case Examples

### Data Science Workflow (carbon-compute)

```bash
# Start container
./start-carbon-compute.sh

# Access Jupyter
# Open http://localhost:8888

# Or use desktop for VS Code
# Open http://localhost:6900
# Launch VS Code from desktop
```

### Creative Work (carbon-tools)

```bash
# Start with GPU
./start-carbon-tools.sh --gpu

# Access desktop
# Open http://localhost:6900

# Launch Blender, GIMP, or other tools from menu
```

### Web Development (carbon-base)

```bash
# Start minimal
./start-carbon-remote.sh

# Access desktop
# Open http://localhost:6900

# Use VS Code, browsers, databases all in one place
```

### Security Testing (carbon-tools)

```bash
# Start container
./start-carbon-tools.sh

# Access terminal via noVNC or SSH into container
docker exec -it carbon-tools bash

# Use security tools
nmap -sV <target>
sqlmap -u <url>
hydra -L users.txt -P pass.txt <target> ssh
```

---

## 🚀 Advanced Usage

### Custom Environment Variables

```bash
docker run -d \
  --name carbon-custom \
  -e VNC_GEOMETRY=2560x1440 \
  -e CODE_SERVER_PASSWORD=MySecretPass \
  -e JUPYTER_TOKEN=MyJupyterToken \
  -p 6900:6900 \
  wisejnrs/carbon-compute:latest
```

### Persistent Volumes

```bash
docker run -d \
  --name carbon-persistent \
  -v $PWD/carbon-data:/data \
  -v $PWD/projects:/work \
  -v $PWD/carbon-home:/home/carbon \
  -p 6900:6900 \
  wisejnrs/carbon-base:latest-gpu
```

### Network Mode

```bash
# Use host networking for better performance
docker run -d \
  --name carbon-host-network \
  --network host \
  -v /tmp/carbon-data:/data \
  wisejnrs/carbon-base:latest-gpu
```

### Resource Limits

```bash
docker run -d \
  --name carbon-limited \
  --cpus="4" \
  --memory="16g" \
  --gpus '"device=0"' \
  -p 6900:6900 \
  wisejnrs/carbon-compute:latest
```

---

## 📚 Next Steps

1. **Read** [IMAGES.md](IMAGES.md) for detailed image documentation
2. **Explore** the desktop environment via http://localhost:6900
3. **Customize** by adding your own supervisor services
4. **Share** your feedback and use cases!

---

## ⚡ Most Common Workflow

### Option 1: Quick Start (Pre-configured)
```bash
# 1. Build images
./build-all.sh --gpu

# 2. Start what you need
./start-carbon-compute.sh

# 3. Access in browser
# Open http://localhost:6900

# 4. Done!
```

### Option 2: Customized Start (Recommended)
```bash
# 1. Build images
./build-all.sh --gpu

# 2. Copy configuration template
cp .env.example .env

# 3. Edit your settings (password, workspace, etc.)
nano .env

# 4. Start with your configuration
./start-carbon-configurable.sh --image compute

# 5. Access in browser
# Open http://localhost:6900

# 6. Done!
```

### Option 3: Command Line (Quick Changes)
```bash
# Start with custom password and workspace
./start-carbon-configurable.sh \
  --password MySecret123 \
  --work-dir ~/projects \
  --resolution 2560x1440

# Enable PostgreSQL
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh
```

---

## 🎛️ Configuration Made Easy

All Carbon images now support extensive configuration via:

1. **`.env` file** (recommended for persistent settings)
2. **Environment variables** (good for scripts)
3. **Command-line arguments** (quick one-off changes)

**See:**
- [CONFIGURATION.md](CONFIGURATION.md) - Complete configuration guide
- [SERVICE-TOGGLES.md](SERVICE-TOGGLES.md) - Enable/disable services
- `.env.example` - Template with all options

---

That's it! You now have a full development environment with desktop, optional databases, ML tools, and complete customization - all in your browser!
