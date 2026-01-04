# Intel Arc GPU Support

**Status:** ✅ Ready for Use
**Date:** January 2026
**oneAPI Version:** 2025.3.0

---

## Overview

Intel Arc GPU support for Carbon images uses Intel's oneAPI toolkit and Level Zero runtime to provide GPU acceleration on Intel discrete GPUs (Arc A-series, B-series) and integrated graphics (Intel Core Ultra with Arc Graphics).

**Supported Platforms:**
- ✅ Native Linux with Intel Arc GPU
- ✅ Windows 11 with WSL2 + Intel Arc GPU
- ⚠️ Windows native (CPU-only, no GPU acceleration)

---

## Architecture

```
intel/oneapi-basekit:2025.3.0-0-devel-ubuntu22.04
        |
   carbon-base-arc (desktop, databases, languages)
        |
   +----+----+
   |         |
carbon-compute-arc    carbon-tools-arc
(Jupyter, PyTorch XPU)  (Blender, Creative)
```

---

## Image Variants

| Image | Size | GPU Support | Use Case |
|-------|------|-------------|----------|
| **carbon-base-arc** | 47.5 GB | Intel Arc/XPU | Development, all languages |
| **carbon-compute-arc** | 71.6 GB | Intel Arc/XPU | ML/AI with PyTorch XPU |
| **carbon-tools-arc** | 60.6 GB | Intel Arc/XPU | Creative work, rendering |

---

## Comparison: NVIDIA vs Intel Arc vs macOS

| Component | NVIDIA (Linux) | Intel Arc (Linux) | macOS |
|-----------|---------------|-------------------|-------|
| Base Image | `nvidia/cuda:12.1` | `intel/oneapi-basekit:2025` | `ubuntu:22.04` |
| GPU Runtime | CUDA 12.1 | oneAPI 2025.1 | krunkit/Vulkan |
| GPU Env Var | `NVIDIA_VISIBLE_DEVICES=all` | `ONEAPI_DEVICE_SELECTOR=level_zero:0` | `LIBGL_ALWAYS_SOFTWARE=1` |
| PyTorch Device | `cuda` | `xpu` | `mps` or CPU |
| Device Path | `/dev/nvidia*` | `/dev/dri` | `/dev/dri` (krunkit) |
| Monitor Tool | `nvidia-smi` | `xpu-smi`, `sycl-ls` | N/A |
| Docker Flag | `--gpus all` | `--device=/dev/dri` | `--device /dev/dri` |

---

## Requirements

### Host System
- Intel Arc GPU (A770, A750, A380, B580, etc.) or Intel Core Ultra with Arc Graphics
- Linux kernel 6.2+ (recommended 6.5+)
- Intel GPU drivers installed
- Docker or Podman

### Driver Installation (Ubuntu/Debian)

```bash
# Add Intel Graphics APT repository
wget -qO - https://repositories.intel.com/gpu/intel-graphics.key | \
  sudo gpg --dearmor -o /usr/share/keyrings/intel-graphics.gpg

echo "deb [arch=amd64 signed-by=/usr/share/keyrings/intel-graphics.gpg] \
  https://repositories.intel.com/gpu/ubuntu jammy unified" | \
  sudo tee /etc/apt/sources.list.d/intel-gpu-jammy.list

sudo apt update
sudo apt install -y intel-opencl-icd intel-level-zero-gpu level-zero
```

### Verify GPU Access

```bash
# Check GPU device
ls -la /dev/dri/

# List Intel GPUs with clinfo
clinfo | grep "Device Name"

# List with sycl-ls (after oneAPI installed)
source /opt/intel/oneapi/setvars.sh
sycl-ls
```

---

## Windows + WSL2 Setup

This section covers running Intel Arc GPU containers on Windows using WSL2.

### Prerequisites

- **Windows 11** (22H2 or later) or Windows 10 (21H2+)
- **Intel Arc GPU** (A770, A750, A380, B580) or Intel Core Ultra with Arc Graphics
- **Latest Intel GPU drivers** for Windows
- **WSL2** with Ubuntu 22.04 or 24.04
- **Docker Desktop** with WSL2 backend

### Step 1: Install/Update Intel GPU Drivers

1. Download latest drivers from [Intel Arc Graphics Drivers](https://www.intel.com/content/www/us/en/download/785597/intel-arc-iris-xe-graphics-windows.html)
2. Install and reboot Windows
3. Verify in Device Manager → Display adapters → Intel Arc

### Step 2: Install WSL2 with Ubuntu

```powershell
# Open PowerShell as Administrator

# Install WSL2 (if not already installed)
wsl --install

# Or install specific Ubuntu version
wsl --install -d Ubuntu-22.04

# Ensure WSL2 is the default version
wsl --set-default-version 2

# Update WSL kernel (important for GPU support)
wsl --update
```

### Step 3: Configure WSL2 for GPU Access

Create or edit `%USERPROFILE%\.wslconfig`:

```ini
[wsl2]
memory=16GB
processors=8
gpuSupport=true

[experimental]
autoMemoryReclaim=gradual
```

Restart WSL:
```powershell
wsl --shutdown
wsl
```

### Step 4: Verify GPU in WSL2

```bash
# Inside WSL2 Ubuntu terminal

# Check for DRI devices (should see card0, renderD128)
ls -la /dev/dri/

# Install clinfo to verify GPU
sudo apt update
sudo apt install -y clinfo

# Check Intel GPU is visible
clinfo | grep -E "Device Name|Driver Version"
```

Expected output:
```
Device Name                                     Intel(R) Arc(TM) A770 Graphics
Driver Version                                  23.35.27191
```

### Step 5: Install Docker in WSL2

**Option A: Docker Desktop (Recommended)**

1. Install [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop/)
2. In Settings → Resources → WSL Integration:
   - Enable "Use the WSL 2 based engine"
   - Enable integration with your Ubuntu distro
3. Restart Docker Desktop

**Option B: Docker Engine in WSL2**

```bash
# Inside WSL2
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# For GPU access, add user to render group
sudo usermod -aG render $USER

# Log out and back in, then verify
docker --version
```

### Step 6: Run Intel Arc Containers

```bash
# Inside WSL2 terminal

# Run carbon-base-arc with GPU
docker run -d --name carbon-arc \
  --device=/dev/dri \
  --group-add render \
  -p 6900:6900 \
  -p 3389:3389 \
  wisejnrs/carbon-base-arc:latest

# Access desktop via browser
# http://localhost:6900

# Verify GPU inside container
docker exec carbon-arc test-intel-gpu.sh
```

### Step 7: Run ML/AI Container with GPU

```bash
# Run carbon-compute-arc
docker run -d --name carbon-ml \
  --device=/dev/dri \
  --group-add render \
  --shm-size=4g \
  -p 6900:6900 \
  -p 8888:8888 \
  wisejnrs/carbon-compute-arc:latest

# Test PyTorch XPU
docker exec carbon-ml python3 -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'XPU available: {torch.xpu.is_available()}')
if torch.xpu.is_available():
    print(f'XPU device: {torch.xpu.get_device_name(0)}')
"
```

### WSL2 Troubleshooting

#### No /dev/dri devices

```bash
# Check WSL version (must be 2)
wsl -l -v

# Update WSL kernel
wsl --update

# Restart WSL completely
wsl --shutdown
```

#### Permission denied on /dev/dri

```bash
# Add user to render group
sudo usermod -aG render $USER

# Or run container with specific group
docker run --device=/dev/dri --group-add $(getent group render | cut -d: -f3) ...
```

#### GPU not detected by container

```bash
# Check host can see GPU
ls -la /dev/dri/

# Verify driver version
cat /sys/class/drm/card0/device/driver/module/version

# Check container has access
docker run --rm --device=/dev/dri ubuntu ls -la /dev/dri/
```

#### Docker Desktop GPU issues

1. Ensure "Use WSL 2 based engine" is enabled
2. Restart Docker Desktop
3. Try running from WSL2 terminal instead of PowerShell

### Using Start Scripts from WSL2

```bash
# Clone repo or navigate to it
cd /mnt/c/trilogy-projects/wisejnrs-carbon-runtime

# Convert line endings if needed
sed -i 's/\r$//' start-carbon-arc.sh

# Run start script
./start-carbon-arc.sh --work-dir /home/$USER/projects
```

### Performance Tips for WSL2

1. **Store Docker images in WSL2 filesystem** (not /mnt/c/)
2. **Allocate sufficient memory** in .wslconfig (16GB+ for ML)
3. **Use --shm-size=4g** for PyTorch DataLoader
4. **Enable Resizable BAR** in Windows (BIOS setting for Arc GPUs)

---

## Running Containers

### Basic Usage

```bash
# Run carbon-base-arc with GPU access
docker run -d --name carbon-arc \
  --device=/dev/dri \
  -p 6900:6900 \
  -p 3389:3389 \
  wisejnrs/carbon-base-arc:latest

# For profiling/debugging tools, add capabilities
docker run -d --name carbon-arc \
  --device=/dev/dri \
  --cap-add=SYS_ADMIN \
  --cap-add=SYS_PTRACE \
  -p 6900:6900 \
  wisejnrs/carbon-base-arc:latest
```

### carbon-compute-arc (ML/AI)

```bash
docker run -d --name carbon-compute-arc \
  --device=/dev/dri \
  -p 6900:6900 \
  -p 8888:8888 \
  -p 9999:9999 \
  wisejnrs/carbon-compute-arc:latest
```

### Podman (Alternative)

```bash
podman run -d --name carbon-arc \
  --device=/dev/dri \
  -p 6900:6900 \
  localhost/carbon-base-arc:latest
```

---

## Environment Variables

### Required for GPU Selection

```bash
# Select first Intel GPU via Level Zero
ONEAPI_DEVICE_SELECTOR=level_zero:0

# Alternative: Select by GPU type
ONEAPI_DEVICE_SELECTOR=level_zero:gpu

# For multiple GPUs, select specific one
ZE_AFFINITY_MASK=0
```

### Performance Tuning

```bash
# Enable JIT kernel caching (faster subsequent runs)
SYCL_CACHE_DIR=/tmp/sycl_cache

# Force specific GPU (useful with integrated + discrete)
ZE_ENABLE_PCI_ID_DEVICE_ORDER=1

# Debug: Show device selection
SYCL_PI_TRACE=1
```

---

## PyTorch XPU Usage

### Check GPU Availability

```python
import torch

# Check XPU availability
print(f"XPU available: {torch.xpu.is_available()}")
print(f"XPU device count: {torch.xpu.device_count()}")
print(f"XPU device name: {torch.xpu.get_device_name(0)}")
```

### Basic Operations

```python
import torch

# Create tensor on XPU
x = torch.randn(1000, 1000, device='xpu')
y = torch.randn(1000, 1000, device='xpu')

# Matrix multiplication on GPU
z = torch.matmul(x, y)
print(f"Result shape: {z.shape}, device: {z.device}")
```

### Model Training

```python
import torch
import torch.nn as nn

# Move model to XPU
model = nn.Linear(100, 10).to('xpu')
optimizer = torch.optim.Adam(model.parameters())

# Training loop
for epoch in range(10):
    x = torch.randn(32, 100, device='xpu')
    y = model(x)
    loss = y.sum()
    loss.backward()
    optimizer.step()
    optimizer.zero_grad()
```

### Mixed Precision Training

```python
import torch

# Use automatic mixed precision
with torch.xpu.amp.autocast():
    x = torch.randn(1000, 1000, device='xpu')
    y = torch.randn(1000, 1000, device='xpu')
    z = torch.matmul(x, y)
```

---

## Migrating from CUDA

### Device Changes

```python
# CUDA code
tensor = torch.tensor([1.0, 2.0]).to('cuda')
model.cuda()

# Intel XPU code
tensor = torch.tensor([1.0, 2.0]).to('xpu')
model.to('xpu')
```

### Environment Detection

```python
import torch

def get_device():
    if torch.xpu.is_available():
        return torch.device('xpu')
    elif torch.cuda.is_available():
        return torch.device('cuda')
    else:
        return torch.device('cpu')

device = get_device()
print(f"Using device: {device}")
```

---

## Troubleshooting

### GPU Not Detected

```bash
# Check device exists
ls -la /dev/dri/

# Check permissions
groups  # Should include 'render' or 'video'

# Add user to render group
sudo usermod -aG render $USER

# Check Level Zero
docker exec carbon-arc sycl-ls
```

### Performance Issues

```bash
# Enable Resizable BAR in BIOS (required for Arc GPUs)
# Check with:
lspci -vvv | grep -i "Resizable BAR"

# Enable kernel caching
export SYCL_CACHE_DIR=/tmp/sycl_cache

# Check thermal throttling
cat /sys/class/drm/card0/device/hwmon/hwmon*/temp1_input
```

### Container Permission Issues

```bash
# Run with additional capabilities
docker run --device=/dev/dri \
  --cap-add=SYS_ADMIN \
  --cap-add=SYS_PTRACE \
  --group-add render \
  wisejnrs/carbon-base-arc:latest
```

---

## Building Images

### Build carbon-base-arc

```bash
cd carbon-base-arc
docker build -t wisejnrs/carbon-base-arc:latest .
```

### Build All Arc Images

```bash
./build-all-arc.sh
```

### Build with Specific oneAPI Version

```bash
docker build \
  --build-arg ONEAPI_VERSION=2025.1.0 \
  -t wisejnrs/carbon-base-arc:latest \
  carbon-base-arc/
```

---

## Known Limitations

1. **Intel Extension for PyTorch (IPEX)** - EOL March 2026, but native PyTorch XPU support is now preferred
2. **Kernel Compatibility** - Some newer kernels (6.17+) may have issues; kernel 6.5-6.11 recommended
3. **Integrated vs Discrete** - When both are present, use `ZE_AFFINITY_MASK` to select specific GPU
4. **Vulkan Compute** - Some workloads may use Vulkan compute shaders instead of SYCL
5. **WSL2 GPU Support** - Requires Windows 11 22H2+ and latest Intel drivers; some features may be limited
6. **PyTorch SYCL Libraries** - PyTorch XPU wheel bundles SYCL libs that may conflict with oneAPI; we remove them to use system libs
7. **TensorFlow XPU** - Intel Extension for TensorFlow requires actual GPU present at import time

---

## Quick Reference

### Platform Summary

| Platform | GPU Acceleration | Setup Difficulty | Notes |
|----------|-----------------|------------------|-------|
| Native Linux | ✅ Full | Easy | Best performance |
| Windows + WSL2 | ✅ Full | Medium | Requires WSL2 setup |
| Windows Native | ❌ CPU Only | N/A | No GPU passthrough |
| macOS | ❌ N/A | N/A | Use macOS-specific images |

### Quick Start Commands

```bash
# Pull images
docker pull wisejnrs/carbon-base-arc:latest
docker pull wisejnrs/carbon-compute-arc:latest
docker pull wisejnrs/carbon-tools-arc:latest

# Run with GPU (Linux or WSL2)
docker run -d --device=/dev/dri --group-add render \
  -p 6900:6900 wisejnrs/carbon-base-arc:latest

# Verify GPU inside container
docker exec <container> test-intel-gpu.sh
docker exec <container> test-xpu-ml.sh  # compute-arc only
```

---

## Resources

- [Intel oneAPI Containers](https://github.com/intel/oneapi-containers)
- [PyTorch XPU Documentation](https://pytorch.org/docs/stable/notes/get_start_xpu.html)
- [Intel Arc GPU Drivers (Windows)](https://www.intel.com/content/www/us/en/download/785597/intel-arc-iris-xe-graphics-windows.html)
- [Intel GPU Drivers (Linux)](https://dgpu-docs.intel.com/driver/client/overview.html)
- [WSL2 GPU Support](https://learn.microsoft.com/en-us/windows/wsl/tutorials/gpu-compute)
- [Level Zero Specification](https://spec.oneapi.io/level-zero/latest/index.html)
- [SYCL Programming Guide](https://www.intel.com/content/www/us/en/docs/oneapi/programming-guide/current/overview.html)

---

**Last Updated:** 2026-01-04
