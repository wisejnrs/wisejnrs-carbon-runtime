# Podman GPU Acceleration on macOS - Future Option

**Status:** Possible but requires specialized setup
**Performance:** 3-4x faster than CPU for compute workloads
**Complexity:** Medium to High

---

## Overview

While Docker Desktop cannot access macOS GPU, **Podman with libkrun CAN** provide GPU acceleration through Vulkan/MoltenVK!

### **How It Works:**

```
Your Container (Vulkan API)
         ↓
    Venus Driver (Mesa patched)
         ↓
    virtio-gpu (VM passthrough)
         ↓
    MoltenVK (host translation)
         ↓
    Metal GPU (Apple Silicon)
         ↓
    🎉 GPU Acceleration!
```

---

## Technical Stack

### **Components Required:**

1. **Podman Desktop** - GUI for easier setup
2. **libkrun** - Virtualization engine (replaces default QEMU)
3. **Venus** - Mesa Vulkan driver (patched version)
4. **virtio-gpu** - GPU virtualization device
5. **MoltenVK** - Vulkan → Metal translation (we already have this!)

### **What's Supported:**

✅ **Vulkan compute shaders** - ML inference, processing
✅ **llama.cpp with Vulkan backend** - 3-4x faster LLM inference
✅ **General compute workloads**
❌ **Graphics rendering** - Compute only
❌ **Full PyTorch/TensorFlow GPU** - Limited support

---

## Performance Benchmarks

### **Real-World Results (MacBook M3):**

| Workload | CPU | Vulkan GPU | Speedup |
|----------|-----|------------|---------|
| **llama.cpp Q4_0** | 85 sec | **26 sec** | **3.3x** ⚡ |
| **Vulkan Compute** | 1x | **3-4x** | **3-4x** ⚡ |
| **ML Inference** | 1x | **2-3x** | **2-3x** ⚡ |

**Note:** Vulkan/MoltenVK runs at ~77% of native Metal performance.

---

## Setup Guide

### **Prerequisites:**

- macOS (current version)
- Apple Silicon Mac (M1/M2/M3/M4)
- Podman Desktop (not just CLI)

### **Step 1: Install Podman Desktop**

```bash
# Download from:
# https://podman-desktop.io/downloads

# Or via Homebrew:
brew install podman-desktop

# Launch Podman Desktop application
```

### **Step 2: Create Machine with GPU**

**Via Podman Desktop GUI:**

1. Open Podman Desktop
2. Settings → Resources → Podman Machines
3. Create new machine
4. **Provider:** Select **libkrun** (critical!)
5. **Enable GPU:** Check the GPU checkbox
6. **Memory:** 8GB+ recommended
7. Create machine

**Via CLI (if supported in your version):**

```bash
# This may work in newer versions:
podman machine init --rootful --provider libkrun carbon-gpu
podman machine start carbon-gpu
```

### **Step 3: Build Specialized Container**

**Create Containerfile with Venus drivers:**

```dockerfile
FROM wisejnrs/carbon-base-macos:latest

# Install patched Mesa with Venus support
USER root
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git build-essential meson ninja-build \
    libdrm-dev libxcb-dri3-dev libxcb-present-dev \
    libxshmfence-dev libxxf86vm-dev libxrandr-dev

# Build Mesa with Venus from slp/mesa-krunkit
RUN git clone -b krunkit-24.0 --depth 1 \
    https://github.com/slp/mesa-krunkit.git /tmp/mesa && \
    cd /tmp/mesa && \
    meson setup build -Dvulkan-drivers=virtio -Dgallium-drivers= \
    -Dplatforms=x11 -Dbuildtype=release && \
    meson compile -C build && \
    meson install -C build && \
    rm -rf /tmp/mesa

USER carbon
```

### **Step 4: Run with GPU**

```bash
# Build the specialized image
podman build -t carbon-gpu-enabled -f Containerfile.gpu .

# Run with GPU device
podman run -d --name carbon-gpu \
  --device /dev/dri \
  -p 8888:8888 -p 6900:6900 \
  carbon-gpu-enabled

# Test Vulkan GPU
podman exec carbon-gpu vulkaninfo
# Should show virtio-gpu device!
```

---

## Limitations

### **Current Limitations (2025):**

1. **Compute Shaders Only**
   - No graphics rendering
   - Only computation workloads

2. **Framework Support Varies**
   - llama.cpp: ✅ Excellent support
   - PyTorch: ⚠️ Limited (some ops work)
   - TensorFlow: ⚠️ Experimental

3. **Performance**
   - ~77% of native Metal speed
   - Still 3-4x faster than CPU

4. **Complexity**
   - Requires patched Mesa drivers
   - Specialized container build
   - More setup than Docker

---

## Comparison: Docker vs Podman vs Native

| Feature | Docker Desktop | Podman + libkrun | Native macOS |
|---------|----------------|------------------|--------------|
| **GPU Access** | ❌ None | ✅ Vulkan compute | ✅ Full Metal |
| **Setup** | ✅ Easy | ⚠️ Medium | ✅ Easy |
| **Performance** | CPU only | **3-4x CPU** | **Best** |
| **Containerized** | ✅ Yes | ✅ Yes | ❌ No |
| **Isolation** | ✅ Yes | ✅ Yes | ❌ No |
| **LLM Inference** | Slow | **Fast** ⚡ | **Fastest** |
| **ML Training** | Slow | ⚠️ Limited | **Fast** ⚡ |

---

## Use Cases

### ✅ **Great for with Podman GPU:**

- **LLM inference** (llama.cpp) - 3x speedup
- **Ollama with Vulkan** - GPU-accelerated
- **Vulkan compute workloads**
- **ML inference** (some frameworks)

### ⚠️ **Not Ideal:**

- **Heavy ML training** - Use cloud NVIDIA
- **Graphics applications** - No rendering support
- **Full framework support** - Limited compared to native

---

## Future: Apple Container + macOS 26

### **Apple's Native Container Runtime (Coming)**

**Announced:** WWDC 2025
**Available:** macOS 26 (beta/upcoming)
**GitHub:** https://github.com/apple/container

**Features:**
- ✅ Native Swift implementation
- ✅ OCI-compatible
- ✅ Optimized for Apple Silicon
- ✅ Sub-second startup
- ✅ VM-level isolation per container
- ❓ GPU support (TBD)

**When available:** Could be even better than Podman!

---

## Recommended Path

### **For Now (December 2025):**

**Option 1: Use Docker (What We Built)** ✅
- Easiest, working now
- CPU-only but fully functional
- Great for development
- Use cloud GPU for training

**Option 2: Podman GPU (Advanced Users)** ⚡
- 3-4x faster inference
- Requires setup
- Good for LLM work
- See setup guide above

### **For Future:**

**Wait for macOS 26 + Apple Container**
- Native Apple solution
- Possibly better GPU support
- Simpler setup
- More polished

---

## Creating Podman-Optimized Variant

### **If we want to create `carbon-podman-gpu`:**

**Would include:**
1. Base on Ubuntu 22.04
2. Patched Mesa with Venus drivers
3. Vulkan-optimized llama.cpp
4. Ollama with Vulkan backend
5. Documentation for Podman setup

**Estimated effort:**
- Dockerfile: 2-3 hours
- Testing: 1-2 hours
- Documentation: 1 hour
- **Total: 4-6 hours**

**Benefits:**
- ✅ Real GPU acceleration on Mac
- ✅ 3-4x faster inference
- ✅ Containerized solution

---

## Resources & Links

### **Podman GPU Documentation:**
- [GPU container access | Podman Desktop](https://podman-desktop.io/docs/podman/gpu)
- [How we improved AI inference on macOS Podman containers | Red Hat](https://developers.redhat.com/articles/2025/06/05/how-we-improved-ai-inference-macos-podman-containers)
- [Reach native speed with MacOS llama.cpp container inference | Red Hat](https://developers.redhat.com/articles/2025/09/18/reach-native-speed-macos-llamacpp-container-inference)

### **Technical Deep Dives:**
- [GPU Accelerated AI Inference with llama.cpp in a Linux Container on macOS | Medium](https://medium.com/@0.all_existence.0/gpu-accelerated-ai-inference-with-llama-cpp-in-a-linux-container-on-macos-37b6557f5d59)
- [Enabling containers to access the GPU on macOS - Sergio López's Blog](https://sinrega.org/2024-03-06-enabling-containers-gpu-macos/)
- [GPU-Accelerated Containers for M1/M2/M3/M4 Macs | Medium](https://medium.com/@andreask_75652/gpu-accelerated-containers-for-m1-m2-m3-macs-237556e5fe0b)

### **Apple's Solution:**
- [GitHub - apple/container](https://github.com/apple/container)
- [Apple Containers on macOS: Technical Comparison | The New Stack](https://thenewstack.io/apple-containers-on-macos-a-technical-comparison-with-docker/)
- [Apple Containerization: Native Linux Container Support | InfoQ](https://www.infoq.com/news/2025/06/apple-container-linux/)

---

## Summary

### **Current State:**

**Docker (What We Built):**
- ✅ Working now
- ✅ Easy to use
- ❌ No GPU
- ✅ Perfect for development

**Podman + GPU:**
- ✅ GPU acceleration possible
- ⚠️ Complex setup
- ✅ 3-4x faster inference
- ⚠️ Requires specialized image

**Apple Container:**
- ⏳ Coming in macOS 26
- ✅ Native solution
- ❓ GPU capabilities TBD
- ✅ Simplest (when available)

### **Recommendation:**

1. **Use Docker images we built** for development (now)
2. **Document Podman GPU option** for advanced users
3. **Monitor macOS 26** for Apple's native solution
4. **Use cloud GPU** for heavy training (always fastest)

---

**Last Updated:** 2025-12-23
**Status:** Documented - Implementation optional
