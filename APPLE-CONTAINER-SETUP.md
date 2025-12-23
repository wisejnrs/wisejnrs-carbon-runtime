# Apple Container Setup Guide - macOS 26

**Requirements:** macOS 26 (Tahoe) or later
**Version Tested:** 0.7.1
**Date:** December 2025

---

## Installation

### **Step 1: Download Apple Container**

```bash
# Go to releases page
open "https://github.com/apple/container/releases"

# Download latest: container-0.7.1.pkg
# Or use curl:
curl -L "https://github.com/apple/container/releases/download/v0.7.1/container-0.7.1.pkg" \
  -o ~/Downloads/container-0.7.1.pkg
```

### **Step 2: Install Package**

```bash
# Install the .pkg
sudo installer -pkg ~/Downloads/container-0.7.1.pkg -target /

# Verify installation
which container
container --version
```

### **Step 3: Start Container Service**

```bash
# Start the container service
container system start

# Check status
container system status
```

---

## Running Carbon Images

### **Option 1: Run Directly**

```bash
# Since images are OCI-compatible, they should work directly!

# Run carbon-base-macos
container run -d -p 6900:6900 \
  docker://wisejnrs/carbon-base-macos:latest

# Run carbon-compute-macos
container run -d -p 6900:6900 -p 8888:8888 -p 9999:9999 \
  docker://wisejnrs/carbon-compute-macos:latest
```

### **Option 2: Import from Docker**

```bash
# If direct pull doesn't work, export from Docker

# Save image from Docker
docker save wisejnrs/carbon-compute-macos:latest -o /tmp/carbon-compute.tar

# Import to Apple Container
container image import /tmp/carbon-compute.tar carbon-compute-macos:latest

# Run it
container run -d -p 8888:8888 carbon-compute-macos:latest
```

---

## Testing GPU Support

### **Test 1: Check for GPU Devices**

```bash
# Run container and check for GPU devices
container run --rm ubuntu:22.04 ls -la /dev/dri

# If you see devices → GPU passthrough working!
# If not → CPU-only (like Docker)
```

### **Test 2: Vulkan Info**

```bash
# Run with our image
container run --rm carbon-base-macos:latest vulkaninfo

# Check output for GPU device
# Look for: deviceType = PHYSICAL_DEVICE
```

### **Test 3: Metal Framework**

```bash
# Check if Metal is accessible (unlikely but worth trying)
container run --rm carbon-base-macos:latest \
  python3 -c "import subprocess; subprocess.run(['system_profiler', 'SPDisplaysDataType'])"
```

---

## Performance Testing

### **If GPU Works:**

```bash
# Test with our PyTorch verification
container run --rm carbon-compute-macos:latest \
  python3 /home/carbon/tests/verify_mps.py

# Expected (if GPU works):
# PyTorch MPS: PASS ← Would be AMAZING!
# TensorFlow Metal: PASS
```

### **LLM Inference Test:**

```bash
# Test llama.cpp performance
container run --rm carbon-compute-macos:latest \
  python3 -c "from llama_cpp import Llama; print('Ready for testing')"

# Benchmark against Docker version
# Apple Container with GPU should be faster!
```

---

## Comparison After Testing

| Runtime | Startup | GPU | Performance | Ease |
|---------|---------|-----|-------------|------|
| **Docker** | Fast | ❌ None | CPU-only | Easy |
| **Podman** | Fast | ✅ Vulkan | 3-4x faster | Medium |
| **Apple Container** | Sub-second | ❓ TBD | ❓ TBD | Easy |

---

## Expected Outcomes

### **Best Case Scenario:** 🎉
- ✅ GPU passthrough works
- ✅ Metal/MPS accessible
- ✅ PyTorch MPS works in containers!
- ✅ 4-6x faster than CPU
- ✅ Native Apple solution

### **Realistic Scenario:** 😊
- ✅ Containers work
- ❌ No GPU yet (coming in future updates)
- ✅ Faster startup than Docker
- ✅ Better integration with macOS
- ✅ Foundation for future GPU support

### **Worst Case:** 😅
- ✅ Containers work
- ❌ No GPU
- ⚠️ Beta bugs
- ✅ Can downgrade to macOS 25

---

## Troubleshooting

### **If container command not found:**
```bash
# Add to PATH
export PATH="/opt/container/bin:$PATH"
# Or check: /usr/local/bin/container
```

### **If images don't run:**
```bash
# Try different image formats
container image pull docker://ubuntu:22.04
container image pull docker.io/library/ubuntu:22.04
```

### **If you want to go back:**
```bash
# Boot into Recovery (Command-R at startup)
# Reinstall macOS 25
# Restore from Time Machine
```

---

## Documentation to Create After Testing

After we test, we'll document:
1. Installation process
2. GPU capabilities (if any)
3. Performance comparison
4. Compatibility with Carbon images
5. Recommendations for users

---

**Ready! Let me know when:**
1. ✅ You've signed into Apple Developer
2. ✅ You've enabled beta updates
3. ✅ Download has started

**Then we wait for install and test Apple Container!** 🚀
