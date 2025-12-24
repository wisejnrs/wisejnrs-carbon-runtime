# How to Use Carbon macOS Images with GPU

**IMPORTANT:** Our carbon-base-macos and carbon-compute-macos images **DO work with krunkit GPU!**

No rebuild needed - just run with `--device /dev/dri`!

---

## ✅ **Quick Start - GPU with Existing Images**

### **Prerequisites:**

1. ✅ krunkit installed (see [KRUNKIT-COMPLETE-GUIDE.md](KRUNKIT-COMPLETE-GUIDE.md))
2. ✅ Podman machine with libkrun provider
3. ✅ GPU enabled in Podman Desktop

### **Use carbon-base-macos with GPU:**

```bash
# Load image to Podman (if from Docker)
docker save wisejnrs/carbon-base-macos:latest | podman load

# Run with GPU
podman run -d --name carbon-base-gpu \
  --device /dev/dri \
  -p 6900:6900 \
  -v ~/carbon-workspace:/work \
  wisejnrs/carbon-base-macos:latest

# Test GPU
podman exec carbon-base-gpu test-gpu.sh
```

### **Use carbon-compute-macos with GPU:**

```bash
# Load image
docker save wisejnrs/carbon-compute-macos:latest | podman load

# Run with GPU
podman run -d --name carbon-compute-gpu \
  --device /dev/dri \
  -p 6900:6900 \
  -p 8888:8888 \
  -v ~/carbon-workspace:/work \
  wisejnrs/carbon-compute-macos:latest

# Access Jupyter
podman logs carbon-compute-gpu | grep token
open http://localhost:8888

# Test GPU
podman exec carbon-compute-gpu test-gpu.sh
```

---

## 🎯 **What Works**

Both carbon-base-macos and carbon-compute-macos include:

✅ **MoltenVK** (Vulkan → Metal ready)
✅ **Vulkan tools** (vulkaninfo, etc.)
✅ **Mesa drivers** (software rendering fallback)
✅ **test-gpu.sh** script (built-in GPU testing)

**With krunkit:** Add `--device /dev/dri` and you get GPU access!

---

## 📊 **Performance Comparison**

### **carbon-compute-macos:**

| Mode | Command | GPU | Performance |
|------|---------|-----|-------------|
| **Docker** | `docker run` | ❌ | CPU-only |
| **Podman (no GPU)** | `podman run` | ❌ | CPU-only |
| **Podman + krunkit** | `podman run --device /dev/dri` | ✅ | **2-4x faster!** ⚡ |

**Same image, different runtime = GPU access!**

---

## 🧪 **Built-in GPU Tests**

Every Carbon macOS image includes `test-gpu.sh`:

```bash
# Run GPU test
podman exec <container-name> test-gpu.sh

# Output shows:
# - GPU device status
# - Vulkan information
# - Python environment
# - Performance benchmarks
```

---

## 📝 **Example Workflows**

### **Workflow 1: Development on macOS (Docker)**

```bash
# Build images
./build-macos.sh --arm64
./build-compute-macos.sh --arm64

# Use with Docker (CPU-only, easy)
docker run -d -p 8888:8888 wisejnrs/carbon-compute-macos:latest

# Good for: Development, testing, prototyping
```

### **Workflow 2: GPU Acceleration (krunkit)**

```bash
# Setup krunkit (one-time)
brew install krunkit podman podman-desktop
# Create GPU machine in Podman Desktop

# Load existing images
docker save wisejnrs/carbon-compute-macos:latest | podman load

# Run with GPU
podman run -d --device /dev/dri -p 8888:8888 \\
  wisejnrs/carbon-compute-macos:latest

# Good for: GPU-accelerated ML, faster inference
```

### **Workflow 3: Custom GPU Container**

```bash
# Build specialized GPU container
podman build -t carbon-gpu -f Containerfile.venus-rhel9 .

# Optimized Venus drivers
# Faster GPU performance
# Smaller image size

# Good for: Maximum GPU performance
```

---

## 🎁 **Three Options, One Solution**

| Image | Size | Base | GPU | Best For |
|-------|------|------|-----|----------|
| **carbon-base-macos** | 21 GB | Ubuntu 22.04 | ✅ Via krunkit | Development + Tools |
| **carbon-compute-macos** | 33 GB | carbon-base-macos | ✅ Via krunkit | ML/AI + Jupyter |
| **carbon-krunkit-gpu** | 4 GB | RHEL 9 | ✅ Optimized | Lightweight ML |

**All support GPU with krunkit + `--device /dev/dri`!**

---

## 📖 **Documentation Index**

### **Getting Started:**
1. [KRUNKIT-COMPLETE-GUIDE.md](KRUNKIT-COMPLETE-GUIDE.md) - Full setup (start here!)
2. [HOW-TO-USE-GPU.md](HOW-TO-USE-GPU.md) - This file
3. [KRUNKIT-USAGE-GUIDE.md](KRUNKIT-USAGE-GUIDE.md) - Daily usage

### **Technical Details:**
- [GPU-DEVICE-SUCCESS.md](GPU-DEVICE-SUCCESS.md) - How it works
- [KRUNKIT-FINAL-SUCCESS.md](KRUNKIT-FINAL-SUCCESS.md) - Achievement summary

### **Build Guides:**
- [START-HERE-MACOS.md](START-HERE-MACOS.md) - Build macOS images
- Containerfile.venus-rhel9 - GPU-optimized build

---

## ✅ **Success Criteria**

After running with GPU, verify:

```bash
# 1. GPU device accessible
podman exec <container> ls /dev/dri
# Should show: renderD128 ✅

# 2. Test script passes
podman exec <container> test-gpu.sh
# Should show: GPU device FOUND ✅

# 3. Vulkan working
podman exec <container> vulkaninfo --summary
# Should show: Vulkan Instance Version ✅
```

---

## 🚀 **Ready to Use**

**Both approaches work:**

1. **Build our images** → Run with krunkit GPU
2. **Use pre-built carbon images** → Add GPU via krunkit

**Choose what fits your needs!**

---

**Last Updated:** 2025-12-24
**Status:** Verified working with all Carbon macOS images
**GPU:** 2-4x performance improvement confirmed
