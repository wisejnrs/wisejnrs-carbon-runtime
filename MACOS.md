# Carbon on macOS - Quick Reference

**TL;DR**: Carbon now works on macOS via Docker Desktop! 🎉

---

## Overview

**carbon-base-macos** is optimized for Docker Desktop on Mac with:
- ✅ **Software rendering** (CPU-based OpenGL/Vulkan)
- ✅ **Multi-arch** support (Intel + Apple Silicon)
- ✅ **MoltenVK** for future Metal support
- ✅ **14GB image** (4GB smaller than Linux variant)
- ✅ **All dev tools** (same as carbon-base)

---

## Quick Start

### 1. Build

```bash
./build-macos.sh
```

### 2. Run

```bash
docker run -d --name carbon-macos \
  -p 6900:6900 \
  -v ~/carbon-workspace:/work \
  wisejnrs/carbon-base-macos:latest
```

### 3. Access

```
http://localhost:6900
```

---

## What Works

### ✅ Fast (Same as Native)

- Code editing (VS Code, vim, nano)
- Terminal/CLI tools
- Git operations
- Databases (PostgreSQL, MongoDB, Redis)
- Web development (Node.js, Python, Go)
- Browsers (Firefox, Chrome)
- Remote access (VNC, RDP, SSH)

### 🐌 Slower (CPU Rendering)

- 3D graphics (Blender, games)
- Video encoding (OBS, FFmpeg)
- ML/AI (PyTorch, TensorFlow - CPU only)

---

## Architecture Support

| Mac Type | Architecture | Status |
|----------|--------------|--------|
| Intel Mac | linux/amd64 | ✅ Fully supported |
| Apple Silicon (M1/M2/M3/M4) | linux/arm64 | ✅ Fully supported |

Docker Desktop automatically selects the correct architecture.

---

## Key Differences vs Linux Variant

| Feature | carbon-base (Linux) | carbon-base-macos |
|---------|---------------------|-------------------|
| GPU | NVIDIA CUDA | Software (CPU) |
| OpenGL | NVIDIA GPU | Mesa llvmpipe |
| Vulkan | NVIDIA GPU | lavapipe + MoltenVK |
| Size | 18.18 GB | ~14 GB |
| Best For | Linux + NVIDIA GPU | macOS (any Mac) |

---

## Performance Tips

### 1. Docker Desktop Settings

Increase resources (Settings → Resources):
- **CPU**: 4+ cores
- **Memory**: 8GB+
- **Swap**: 2GB

### 2. Enable VirtioFS

Settings → General → Enable VirtioFS
- Faster file I/O for volumes

### 3. Use Native Databases (Production)

Run PostgreSQL/MongoDB natively on macOS:
```bash
brew install postgresql mongodb-community
```

Connect from container:
```bash
docker run --add-host=host.docker.internal:host-gateway ...
```

---

## Software Rendering Explained

### What is Software Rendering?

- **GPU Rendering**: Graphics card does the work (fast)
- **Software Rendering**: CPU does the work (slower but always available)

### Why Software Rendering?

Docker Desktop for Mac doesn't support GPU passthrough (yet). All graphics must be rendered by CPU.

### Technologies Used

- **Mesa llvmpipe**: CPU-based OpenGL 4.5
- **lavapipe**: CPU-based Vulkan 1.3
- **MoltenVK**: Future Vulkan → Metal support

### Check if Working

```bash
# OpenGL (should show llvmpipe)
docker exec carbon-macos glxinfo | grep "OpenGL renderer"

# Vulkan (should show llvmpipe)
docker exec carbon-macos vulkaninfo | grep deviceName
```

---

## Common Commands

### Start Container

```bash
docker run -d --name carbon-macos \
  -p 6900:6900 -p 5900:5900 -p 3390:3389 -p 2222:2222 \
  -v ~/carbon-workspace:/work \
  wisejnrs/carbon-base-macos:latest
```

### Access Desktop

```bash
# Web browser
open http://localhost:6900

# VNC client (password: Carbon123#)
open vnc://localhost:5900

# RDP (username: carbon, password: Carbon123#)
# Use Microsoft Remote Desktop app

# SSH
ssh -p 2222 carbon@localhost  # password: Carbon123#
```

### Stop/Start

```bash
docker stop carbon-macos
docker start carbon-macos
```

### Remove

```bash
docker stop carbon-macos
docker rm carbon-macos
```

### View Logs

```bash
docker logs carbon-macos
```

### Execute Commands

```bash
# Run command
docker exec carbon-macos ls -la /work

# Interactive shell
docker exec -it carbon-macos bash
```

---

## Troubleshooting

### Issue: Build fails on Apple Silicon

**Solution**: Make sure you're building for arm64:
```bash
./build-macos.sh --arm64
```

### Issue: VNC shows black screen

**Solution**: Restart VNC service:
```bash
docker exec carbon-macos supervisorctl restart vnc
```

### Issue: Slow performance

**Solutions**:
1. Increase Docker resources (Settings → Resources)
2. Close other applications
3. Disable desktop compositing:
   ```bash
   docker exec carbon-macos dconf write /org/cinnamon/desktop-effects false
   ```

### Issue: Port already in use

**Solution**: Change port mapping:
```bash
docker run -p 6901:6900 ...  # Use 6901 instead of 6900
```

---

## Future: GPU Support

### What's Coming?

When Docker Desktop adds GPU passthrough:
- **MoltenVK** will enable Vulkan → Metal translation
- **Metal Performance Shaders** for PyTorch
- **Actual GPU acceleration** for graphics

### How to Prepare?

The macOS variant already includes MoltenVK. When Docker adds GPU support, it will "just work" with no changes needed.

---

## Use Cases

### ✅ Great For

- **Development**: Code, test, debug on Linux from Mac
- **Learning**: Safe sandbox for experiments
- **Remote Work**: Access full desktop from anywhere
- **Cross-platform**: Build Linux apps on Mac
- **Databases**: Test PostgreSQL/MongoDB setups

### ⚠️ Not Ideal For

- **ML/AI Training**: Use cloud Linux with GPU
- **3D Rendering**: Better on native macOS
- **Video Production**: Native apps faster
- **High-performance Computing**: Use native or cloud

### 🔄 Hybrid Strategy

- **Development/Testing**: carbon-base-macos on Mac
- **Training/Rendering**: Cloud Linux with carbon-compute
- **Production**: Deploy to Linux servers

---

## Next Steps

1. **Build the image**: `./build-macos.sh`
2. **Read full docs**: `carbon-base-macos/README.md`
3. **Try it out**: Start container and access via browser
4. **Build compute variant**: Wait for carbon-compute-macos

---

## Resources

- **Full Documentation**: `carbon-base-macos/README.md`
- **Main README**: `README.md`
- **Build Script**: `build-macos.sh`
- **Dockerfile**: `carbon-base-macos/Dockerfile`

---

## Support

- **GitHub**: https://github.com/wisejnrs/wisejnrs-carbon-runtime
- **Issues**: https://github.com/wisejnrs/wisejnrs-carbon-runtime/issues
- **Website**: https://www.wisejnrs.net

---

**Version**: 2.0.0-macos
**Last Updated**: 2025-12-23
**Author**: Michael Wise (WiseJNRS)
