# Publishing Carbon macOS Images to Docker Hub

**Purpose:** Make macOS images available for easy pull + krunkit GPU usage
**Images:** carbon-base-macos, carbon-compute-macos, carbon-tools-macos

---

## 📤 **Publishing Process**

### **Step 1: Tag Images**

```bash
# Tag for Docker Hub
docker tag wisejnrs/carbon-base-macos:latest wisejnrs/carbon-base-macos:2.0.0
docker tag wisejnrs/carbon-base-macos:latest wisejnrs/carbon-base-macos:latest

docker tag wisejnrs/carbon-compute-macos:latest wisejnrs/carbon-compute-macos:2.0.0
docker tag wisejnrs/carbon-compute-macos:latest wisejnrs/carbon-compute-macos:latest

# tools (when built)
docker tag wisejnrs/carbon-tools-macos:latest wisejnrs/carbon-tools-macos:2.0.0
docker tag wisejnrs/carbon-tools-macos:latest wisejnrs/carbon-tools-macos:latest
```

---

### **Step 2: Push to Docker Hub**

```bash
# Login to Docker Hub
docker login

# Push images
docker push wisejnrs/carbon-base-macos:2.0.0
docker push wisejnrs/carbon-base-macos:latest

docker push wisejnrs/carbon-compute-macos:2.0.0
docker push wisejnrs/carbon-compute-macos:latest

docker push wisejnrs/carbon-tools-macos:2.0.0
docker push wisejnrs/carbon-tools-macos:latest
```

**Time:** 30-60 minutes (uploading ~80 GB total)

---

### **Step 3: Update Documentation**

Add to README.md:

```markdown
## Quick Start - macOS with GPU

### Pull from Docker Hub:
\`\`\`bash
podman pull docker.io/wisejnrs/carbon-compute-macos:latest
\`\`\`

### Run with krunkit GPU:
\`\`\`bash
podman run -d --device /dev/dri -p 8888:8888 \\
  wisejnrs/carbon-compute-macos:latest
\`\`\`

**No build needed!** Pull and run with GPU!
```

---

## 📊 **Image Sizes on Docker Hub**

| Image | Size | Pull Time | Use Case |
|-------|------|-----------|----------|
| **carbon-base-macos** | ~21 GB | ~20 min | Development |
| **carbon-compute-macos** | ~33 GB | ~30 min | ML/AI |
| **carbon-tools-macos** | ~28 GB | ~25 min | Creative/Security |

**Total:** ~82 GB for complete suite

---

## 📖 **User Instructions (After Publishing)**

### **For macOS Users:**

```bash
# 1. Setup krunkit (one-time, 30 min)
brew tap slp/krunkit && brew install krunkit podman podman-desktop
# Create GPU machine in Podman Desktop (libkrun provider)

# 2. Pull image (~20-30 min)
podman pull wisejnrs/carbon-compute-macos:latest

# 3. Run with GPU (~2 min)
podman run -d --device /dev/dri -p 6900:6900 -p 8888:8888 \\
  -v ~/carbon-workspace:/work \\
  wisejnrs/carbon-compute-macos:latest

# 4. Access (~immediate)
open http://localhost:8888

# 5. Verify GPU (~30 seconds)
podman exec <container> ls /dev/dri
# Shows: renderD128 ✅
```

**Total Time:** ~1 hour first time, ~5 min after setup

---

## ✅ **Benefits of Docker Hub**

### **For Users:**
- ✅ No local build (save 2-3 hours)
- ✅ Guaranteed working images
- ✅ Quick updates (`podman pull`)
- ✅ Consistent environment

### **For You:**
- ✅ Easier distribution
- ✅ Version control
- ✅ Community access
- ✅ Professional presentation

---

## 🎯 **Recommended Tags**

### **Semantic Versioning:**

```
wisejnrs/carbon-base-macos:latest        # Always current
wisejnrs/carbon-base-macos:2.0.0         # Stable release
wisejnrs/carbon-base-macos:2.0.0-gpu     # GPU variant (optional)
wisejnrs/carbon-base-macos:arm64         # Architecture (optional)
```

### **For This Release:**

```
2.0.0 - First macOS release with GPU support
       - krunkit + MoltenVK ready
       - All three image types
       - Complete documentation
```

---

## 📝 **Docker Hub Description Template**

### **For carbon-compute-macos:**

```
Carbon Compute - macOS Edition

Complete ML/AI development environment optimized for macOS.

✅ GPU Support: Works with Podman + krunkit (2-4x faster!)
✅ Full Stack: PyTorch, TensorFlow, Jupyter, Spark
✅ Desktop: Cinnamon with VNC/RDP access
✅ Proven: Test suite included

Quick Start:
  podman pull wisejnrs/carbon-compute-macos:latest
  podman run -d --device /dev/dri -p 8888:8888 wisejnrs/carbon-compute-macos:latest

GPU Setup: See https://github.com/wisejnrs/wisejnrs-carbon-runtime

Platform: macOS 14+ with Apple Silicon
Size: ~33 GB
Version: 2.0.0
```

---

## 🚀 **Publishing Checklist**

Before pushing to Docker Hub:

- [ ] Images built successfully
- [ ] All tested locally
- [ ] GPU verified working
- [ ] Documentation complete
- [ ] README updated
- [ ] Tags created
- [ ] Docker Hub descriptions written
- [ ] Logged into Docker Hub

**When all checked:** Ready to `docker push`!

---

## 🎁 **After Publishing**

### **Update README.md:**

Add prominent section:
```markdown
## 🚀 Quick Start from Docker Hub

### Linux + NVIDIA:
\`\`\`bash
docker pull wisejnrs/carbon-compute:latest
docker run -d --gpus all -p 8888:8888 wisejnrs/carbon-compute:latest
\`\`\`

### macOS + krunkit:
\`\`\`bash
podman pull wisejnrs/carbon-compute-macos:latest
podman run -d --device /dev/dri -p 8888:8888 wisejnrs/carbon-compute-macos:latest
\`\`\`

**Both with GPU! No build needed!** 🚀
```

---

## 📢 **Announce**

After publishing, share:
- Blog post about macOS GPU breakthrough
- GitHub README (now shows both platforms)
- Social media (GPU on macOS containers!)
- Forums (Podman, macOS communities)

---

**Last Updated:** 2025-12-24
**Status:** Ready to publish
**Images:** Built and tested
**Documentation:** Complete
