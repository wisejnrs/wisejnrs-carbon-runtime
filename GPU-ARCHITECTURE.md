# GPU Architecture - Simplified Design

## Overview

As of version 2.0, **all Carbon images are GPU-enabled by default** with automatic CPU fallback support. This simplifies the architecture while maintaining compatibility with both GPU and CPU-only systems.

---

## Why GPU-Only?

### 1. **Smaller Image Size**
- GPU runtime base: **16.8GB**
- Previous minimal variant: 23.6GB
- **Savings: 6.8GB smaller!**

### 2. **Graceful Degradation**
- NVIDIA runtime works perfectly without GPU hardware
- Automatic CPU fallback for all GPU-accelerated tools
- No errors or warnings on CPU-only systems

### 3. **Future-Proof**
- GPUs are becoming standard in cloud and workstation environments
- One codebase to maintain
- Simpler documentation

### 4. **Better Tooling**
- Ollama works on CPU (slower but functional)
- vLLM falls back to CPU mode
- PyTorch/TensorFlow detect and adapt
- CUDA libraries available but not required

---

## Architecture

### Previous (Complex)

```
carbon-base
  ├── :latest-gpu (16.8GB, CUDA runtime)
  └── :latest-minimal (23.6GB, no GPU)

carbon-compute
  └── :latest (from :latest-gpu only)

carbon-tools
  ├── :latest-gpu (53.8GB)
  └── :latest (39.4GB, from minimal)
```

**Problems**:
- Multiple variants to maintain
- Confusing for users
- Minimal variant was actually larger!
- Build complexity

### Current (Simplified)

```
carbon-base
  └── :latest (16.8GB, GPU-enabled with CPU fallback)

carbon-compute
  └── :latest (42.6GB, GPU-enabled with CPU fallback)

carbon-tools
  └── :latest (39.4GB, GPU-enabled with CPU fallback)
```

**Benefits**:
- One tag per image
- Simpler build process
- Works everywhere (GPU or CPU)
- Smaller images

---

## What's Included

All images now include:

### GPU Tools (All Images)
- ✅ CUDA 12.1 runtime (not devel - saves 3GB)
- ✅ cuDNN 8
- ✅ nvidia-utils-535 (nvidia-smi)
- ✅ VirtualGL + TurboVNC
- ✅ Ollama (GPU-accelerated, CPU fallback) - in carbon-base

### ML/AI (carbon-compute only)
- ✅ PyTorch 2.4 with CUDA 12.1 support
- ✅ TensorFlow (GPU-enabled)
- ✅ vLLM (CUDA-aware LLM inference engine, CPU fallback)
- ✅ All frameworks detect and use GPU if available

### Creative (tools)
- ✅ Blender with GPU rendering support
- ✅ GPU-accelerated video encoding
- ✅ OpenGL/Vulkan support

---

## CPU-Only Systems

### What Works?

**Everything works!** The NVIDIA container runtime gracefully handles missing GPUs:

```bash
# On CPU-only system
docker run --rm wisejnrs/carbon-base:latest nvidia-smi
# Error: No GPU detected (expected)

docker run --rm wisejnrs/carbon-base:latest python3 -c "import torch; print(torch.cuda.is_available())"
# False (correct - uses CPU)

# Ollama works on CPU
docker run --rm wisejnrs/carbon-base:latest ollama --version
# ollama version... (works fine)
```

### Performance

| Tool | GPU | CPU-Only | Notes |
|------|-----|----------|-------|
| **Desktop** | Same | Same | No GPU needed |
| **Jupyter** | Same | Same | No GPU needed |
| **PyTorch** | Fast | Slower | Auto-detects, uses CPU |
| **Ollama** | Fast | Slower | Works, just not accelerated |
| **Blender** | GPU render | CPU render | Both work |
| **Code editing** | Same | Same | No GPU needed |

---

## Build Process

### Simplified Build

```bash
# Build all images
./build-all.sh

# Build specific image
./build-all.sh carbon-base
./build-all.sh carbon-compute

# Build and push
./build-all.sh --push
```

**No more --gpu or --minimal flags!**

### Docker Compose

```yaml
services:
  carbon-base:
    image: wisejnrs/carbon-base:latest  # GPU-enabled
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
    # On CPU-only: deploy section is ignored, no errors
```

---

## Migration from v1.x

### If You Were Using `-gpu` Images

No changes needed! Just use `:latest`:

```bash
# Old
docker pull wisejnrs/carbon-base:latest-gpu

# New (same image, better name)
docker pull wisejnrs/carbon-base:latest
```

### If You Were Using `-minimal` Images

Switch to `:latest` - it's actually **6.8GB smaller**:

```bash
# Old
docker pull wisejnrs/carbon-base:latest-minimal  # 23.6GB

# New (smaller and better!)
docker pull wisejnrs/carbon-base:latest  # 16.8GB
```

---

## FAQ

### Q: Will this work without a GPU?
**A: Yes!** All images work perfectly on CPU-only systems.

### Q: Do I need NVIDIA Docker runtime?
**A: Recommended but not required.** Images work with standard Docker, but GPU features require nvidia-docker2.

### Q: What if I don't want GPU tools?
**A: No problem!** The GPU tools don't affect CPU-only usage. The image is actually smaller than the old minimal variant.

### Q: Can I still use GPU acceleration?
**A: Yes!** Just run with `--gpus all`:

```bash
docker run --gpus all wisejnrs/carbon-compute:latest
```

### Q: What about build time?
**A: Faster!** One build path instead of two.

### Q: What about disk space?
**A: Less!**
- Old: 16.8GB (GPU) + 23.6GB (minimal) = 40.4GB
- New: 16.8GB (unified) = **23.6GB savings**

---

## Technical Details

### Base Image

```dockerfile
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04
```

**Why runtime instead of devel?**
- Runtime: 5GB
- Devel: 8GB
- **Savings: 3GB** (we don't need compilation tools)

### Multi-Stage Build

```dockerfile
# Builder stage (for pgvector, node)
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04 AS builder
# ... compile extensions ...

# Runtime stage (final image)
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS base-system
COPY --from=builder /artifacts /
# ... no build tools in final image ...
```

**Result**: Clean runtime image without build dependencies.

---

## Monitoring GPU Usage

### Inside Container

```bash
# Monitor GPU in real-time
watch -n 1 nvidia-smi

# Check CUDA version
nvcc --version || echo "CUDA compiler not available (runtime only)"

# Python GPU check
python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}')"
```

### From Host

```bash
# Monitor specific container
docker stats carbon-compute

# Check GPU usage
nvidia-smi
```

---

## Best Practices

### Development

```bash
# Start without GPU (testing)
docker run -it wisejnrs/carbon-base:latest bash

# Start with GPU
docker run -it --gpus all wisejnrs/carbon-base:latest bash
```

### Production

```yaml
# docker-compose.yml
services:
  carbon-compute:
    image: wisejnrs/carbon-compute:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
        limits:
          memory: 16G  # Adjust as needed
```

---

## Summary

✅ **Simpler** - One image per tier, not multiple variants
✅ **Smaller** - GPU runtime is 6.8GB smaller than old minimal
✅ **Smarter** - Automatic GPU detection and CPU fallback
✅ **Universal** - Works on GPU and CPU-only systems
✅ **Future-proof** - Ready for GPU-accelerated workflows

**All Carbon images are now GPU-enabled by default with seamless CPU fallback.**

---

**Last Updated**: 2025-12-15
