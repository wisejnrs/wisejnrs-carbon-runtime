# Carbon Base - macOS Edition

**Version:** 2.0.0-macos
**Platform:** Docker Desktop for Mac (Intel & Apple Silicon)
**GPU Support:** Software rendering (CPU-based OpenGL/Vulkan) + MoltenVK for future Metal support

---

## Overview

`carbon-base-macos` is a specialized variant of Carbon Development Environment optimized for **Docker Desktop on macOS**. Unlike the NVIDIA CUDA-based Linux variant, this image uses **software rendering** and is designed to work seamlessly on both Intel and Apple Silicon Macs.

### Key Differences from carbon-base (Linux/NVIDIA)

| Feature | carbon-base (Linux) | carbon-base-macos |
|---------|---------------------|-------------------|
| **Base Image** | nvidia/cuda:12.1.1 | ubuntu:22.04 |
| **GPU Support** | NVIDIA CUDA | Software rendering |
| **OpenGL** | NVIDIA GPU | Mesa llvmpipe (CPU) |
| **Vulkan** | NVIDIA GPU | lavapipe (CPU) + MoltenVK |
| **Size** | 18.18 GB | ~14 GB (4GB smaller) |
| **Architectures** | linux/amd64 | linux/amd64, linux/arm64 |
| **Best For** | Linux with NVIDIA GPU | macOS (Intel & Apple Silicon) |

---

## What's Included

### Software Rendering Stack

- **Mesa llvmpipe**: CPU-based OpenGL implementation
- **lavapipe**: CPU-based Vulkan implementation (Vulkan 1.3 compliant)
- **MoltenVK**: Vulkan → Metal translation layer (for future GPU support)
- **Vulkan SDK**: Complete Vulkan development tools

### Development Tools

All the same tools as carbon-base:
- **Languages**: Python 3.10, Node.js 25, Go 1.23, Java 17, Rust, .NET 9.0, Swift 6.1.2, R
- **Databases**: PostgreSQL 14 (pgvector/PostGIS), MongoDB 7.0, Redis, Qdrant
- **CLI Tools**: AWS CLI, Azure CLI, GitHub CLI, Claude Code v2.0.69
- **Desktop**: Cinnamon with macOS Big Sur theme
- **Remote Access**: VNC, noVNC (web), xRDP
- **Browsers**: Firefox, Chrome, Chromium

### Multi-Architecture Support

Built for both:
- **linux/amd64**: Intel Macs
- **linux/arm64**: Apple Silicon (M1/M2/M3/M4)

---

## Quick Start

### 1. Build the Image

```bash
# Build for current architecture
./build-macos.sh

# Build for specific architecture
./build-macos.sh --amd64  # Intel Macs
./build-macos.sh --arm64  # Apple Silicon

# Build multi-arch and push to registry
./build-macos.sh --push
```

### 2. Run the Container

```bash
# Start carbon-base-macos
docker run -d --name carbon-macos \
  -p 6900:6900 \
  -p 5900:5900 \
  -p 3390:3389 \
  -p 2222:2222 \
  -v ~/carbon-workspace:/work \
  wisejnrs/carbon-base-macos:latest
```

### 3. Access the Desktop

**Web Browser (noVNC):**
```
http://localhost:6900
```

**VNC Client:**
```
localhost:5900
Password: Carbon123#
```

**RDP:**
```
localhost:3390
Username: carbon
Password: Carbon123#
```

**SSH:**
```
ssh -p 2222 carbon@localhost
Password: Carbon123#
```

---

## Performance Expectations

### What Works Well ✅

- **General Development**: Same speed as native (no GPU needed)
  - Code editing (VS Code)
  - Terminal/CLI tools
  - Git operations
  - Database operations
  - Web development

- **Web Browsing**: Fully functional
  - Firefox, Chrome work great
  - JavaScript/WebGL falls back to software rendering

- **Desktop Environment**: Smooth and responsive
  - Cinnamon desktop
  - Window management
  - File browsing

### What's Slower 🐌

- **3D Graphics**: CPU rendering is slower than GPU
  - Blender (available in carbon-tools-macos)
  - 3D games/applications
  - Heavy OpenGL apps

- **Video Encoding**: Software encoding only
  - OBS Studio works but slower
  - Video transcoding CPU-intensive

- **ML/AI**: No GPU acceleration
  - PyTorch/TensorFlow CPU-only
  - Ollama works but slower
  - Consider using carbon-compute on Linux for ML workloads

### Performance Tips

1. **Allocate More Resources** in Docker Desktop:
   - CPU: 4+ cores recommended
   - Memory: 8GB+ for comfortable use
   - Swap: 2GB recommended

2. **Enable VirtioFS** (Docker Desktop Settings):
   - Faster file I/O for mounted volumes

3. **Use Native Databases** for production:
   - Run PostgreSQL/MongoDB natively on macOS
   - Connect from container via host networking

---

## Software Rendering Details

### OpenGL (Mesa llvmpipe)

**What it does:**
- CPU-based OpenGL 4.5 implementation
- Uses LLVM for JIT compilation
- Multi-threaded rendering

**Check if working:**
```bash
docker exec carbon-macos glxinfo | grep "OpenGL renderer"
# Should show: OpenGL renderer string: llvmpipe (LLVM ...)
```

### Vulkan (lavapipe)

**What it does:**
- CPU-based Vulkan 1.3 implementation
- Software rasterization
- Full Vulkan API support

**Check if working:**
```bash
docker exec carbon-macos vulkaninfo | grep deviceName
# Should show: deviceName = llvmpipe
```

### MoltenVK (Future GPU Support)

**What it is:**
- Vulkan → Metal translation layer
- Allows Vulkan apps to use macOS Metal API
- Currently dormant (waiting for Docker Desktop GPU passthrough)

**When Docker adds GPU support:**
- MoltenVK will enable Vulkan apps to use Mac GPU
- Requires macOS Metal drivers exposed to containers
- Future-proofing for improved performance

---

## Environment Variables

### Software Rendering (Pre-configured)

```dockerfile
LIBGL_ALWAYS_SOFTWARE=1              # Force software OpenGL
GALLIUM_DRIVER=llvmpipe              # Use llvmpipe driver
MESA_LOADER_DRIVER_OVERRIDE=llvmpipe # Override driver selection
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.*.json  # Vulkan software ICD
```

### Useful Overrides

```bash
# Disable software rendering warning dialogs
docker run -e LIBGL_ALWAYS_SOFTWARE=1 -e GALLIUM_DRIVER=llvmpipe ...

# Enable Mesa debug output
docker run -e MESA_DEBUG=1 -e LIBGL_DEBUG=verbose ...

# Force specific Vulkan device
docker run -e VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json ...
```

---

## Troubleshooting

### Issue: "OpenGL not available" errors

**Solution:**
```bash
# Verify Mesa is working
docker exec carbon-macos glxinfo | head -20

# Should show llvmpipe renderer
# If not, check environment variables
docker exec carbon-macos env | grep -i gl
```

### Issue: VNC shows black screen

**Solution:**
```bash
# Restart VNC service
docker exec carbon-macos supervisorctl restart vnc

# Check VNC logs
docker exec carbon-macos tail -f /var/log/vnc.log
```

### Issue: Slow performance

**Solution:**
1. Increase Docker Desktop resources (Settings → Resources)
2. Close unnecessary applications on host
3. Disable compositing in Cinnamon:
   ```bash
   docker exec carbon-macos dconf write /org/cinnamon/desktop-effects false
   ```

### Issue: Database won't start

**Solution:**
```bash
# Databases are OFF by default (saves resources)
# Enable PostgreSQL
docker exec carbon-macos supervisorctl start postgresql

# Check status
docker exec carbon-macos supervisorctl status
```

---

## Building from Source

### Prerequisites

- Docker Desktop for Mac 4.0+
- Docker Buildx (included with Docker Desktop)
- 40GB+ free disk space
- Stable internet connection

### Build Commands

```bash
# Clone repository
git clone https://github.com/wisejnrs/wisejnrs-carbon-runtime
cd wisejnrs-carbon-runtime

# Build for current architecture (fast)
./build-macos.sh

# Build for Intel Macs
./build-macos.sh --amd64

# Build for Apple Silicon
./build-macos.sh --arm64

# Build multi-arch (slower, requires buildx)
./build-macos.sh

# Build and push to registry
./build-macos.sh --push --tag 2.0.0-macos
```

### Build Time Estimates

| Architecture | Build Time | Size |
|--------------|------------|------|
| Single (amd64 or arm64) | 15-25 min | ~14 GB |
| Multi-arch (both) | 30-45 min | ~14 GB each |

---

## Differences from Linux Variant

### Removed Components

- ❌ NVIDIA CUDA runtime (not applicable)
- ❌ nvidia-smi, nvidia-settings (no NVIDIA hardware)
- ❌ nvtop (GPU monitoring tool)
- ❌ NVIDIA environment variables

### Added Components

- ✅ Enhanced Mesa packages (llvmpipe, lavapipe)
- ✅ Vulkan SDK (complete dev tools)
- ✅ MoltenVK (Vulkan → Metal translation)
- ✅ Multi-arch support (amd64 + arm64)
- ✅ Software rendering optimizations

### Modified Behavior

- **OpenGL**: Always uses llvmpipe (CPU rendering)
- **Vulkan**: Always uses lavapipe (software Vulkan)
- **GPU Apps**: Work but use CPU (slower)
- **Ollama**: CPU-only mode (no CUDA acceleration)

---

## Use Cases

### ✅ Perfect For

- **macOS Development**: Full Linux dev environment on Mac
- **Web Development**: Node.js, Python, databases
- **Backend Development**: APIs, microservices
- **Learning/Education**: Safe sandbox environment
- **Remote Work**: Access desktop from anywhere
- **Cross-platform Testing**: Linux environment on Mac

### ⚠️ Not Ideal For

- **GPU-heavy ML/AI**: Use Linux with NVIDIA GPU
- **3D Rendering**: Better on native macOS or Linux GPU
- **Video Production**: Native apps faster
- **Gaming**: Not designed for games

### 🔄 Hybrid Approach

Use carbon-base-macos for:
- General development
- Testing
- Lightweight workloads

Use cloud Linux with NVIDIA for:
- ML/AI training
- GPU compute
- Heavy rendering

---

## Roadmap

### Current (v2.0.0-macos)

- ✅ Software rendering (llvmpipe/lavapipe)
- ✅ Multi-arch support (Intel + Apple Silicon)
- ✅ MoltenVK included
- ✅ Full development tools

### Future Plans

- 🔜 **GPU Passthrough**: When Docker Desktop supports it
  - MoltenVK will enable Vulkan → Metal
  - Metal Performance Shaders (MPS) for PyTorch
  - Actual GPU acceleration

- 🔜 **ARM Optimizations**: Native Apple Silicon builds
  - Rosetta 2 emulation removal
  - Native ARM libraries
  - Better performance on M-series chips

- 🔜 **carbon-compute-macos**: ML/AI variant
  - PyTorch with MPS backend
  - TensorFlow Metal plugin
  - Optimized for Apple Silicon

---

## FAQs

### Q: Why is it slower than native macOS apps?

**A:** Two layers of overhead:
1. Docker virtualization (Linux VM)
2. Software rendering (CPU instead of GPU)

For development tools (code editors, terminals), the overhead is minimal. For graphics-heavy apps, native macOS is faster.

### Q: Can I use the GPU on my Mac?

**A:** Not yet. Docker Desktop for Mac doesn't support GPU passthrough. When it does, MoltenVK will enable Vulkan apps to use Metal.

### Q: Does this work on Apple Silicon (M1/M2/M3)?

**A:** Yes! Built for both linux/amd64 (Intel) and linux/arm64 (Apple Silicon). Docker Desktop handles the architecture automatically.

### Q: How is this different from Parallels/VMware?

**A:** Docker is lighter weight:
- Faster startup
- Less resource usage
- Easy to version control (Dockerfile)
- Simpler to share (Docker images)

But VMs have:
- Better GPU support
- Native macOS apps
- Full desktop experience

### Q: Can I run this on Linux?

**A:** Technically yes, but use `carbon-base` (NVIDIA variant) instead for better GPU support.

### Q: What about Windows?

**A:** Carbon doesn't have a Windows variant yet. Docker Desktop for Windows with WSL2 can run the Linux variant.

---

## Support

### Documentation

- **Main README**: `../README.md`
- **Configuration Guide**: `../CONFIGURATION.md`
- **Databases**: `../DATABASES.md`
- **Quick Start**: `../QUICK-START.md`

### Community

- **GitHub**: https://github.com/wisejnrs/wisejnrs-carbon-runtime
- **Issues**: https://github.com/wisejnrs/wisejnrs-carbon-runtime/issues
- **Website**: https://www.wisejnrs.net

### Getting Help

1. Check documentation first
2. Search existing issues
3. Create new issue with:
   - macOS version
   - Docker Desktop version
   - Architecture (Intel/Apple Silicon)
   - Steps to reproduce

---

## Credits

**Author**: Michael Wise (WiseJNRS)
**Website**: https://www.wisejnrs.net
**License**: Same as main Carbon project

### Technologies

- **Ubuntu**: 22.04 LTS base
- **Mesa**: llvmpipe + lavapipe software rendering
- **MoltenVK**: Khronos Group Vulkan → Metal
- **Cinnamon**: Linux Mint desktop environment
- **VirtualGL**: OpenGL forwarding over VNC
- **TigerVNC**: High-performance VNC server
- **noVNC**: HTML5 VNC client

---

**Last Updated**: 2025-12-23
**Version**: 2.0.0-macos
**Build**: Multi-arch (amd64 + arm64)
