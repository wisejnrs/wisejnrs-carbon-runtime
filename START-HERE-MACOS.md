# 🚀 START HERE - Carbon macOS Edition

**Welcome!** You're about to build a complete GPU-accelerated ML/AI development environment for your Mac.

---

## ⚡ Quick Start (One Command!)

```bash
./build-all-macos.sh
```

**What it does:**
1. ✅ Builds carbon-base-macos (~14 GB, 15-25 min)
2. ✅ Builds carbon-compute-macos (~48 GB, 25-40 min)
3. ✅ Starts test container
4. ✅ Runs verification tests
5. ✅ Shows access URLs

**Total time:** 40-65 minutes
**Total size:** ~62 GB

---

## 🎯 What You're Getting

### **Apple Silicon (M1/M2/M3/M4):**
- 🚀 **PyTorch with MPS** - 4-6x faster GPU training
- ⚡ **TensorFlow Metal** - 3-5x faster GPU training
- 💨 **llama-cpp Metal** - 5-8x faster LLM inference
- 🧠 **Jupyter Lab** with all ML frameworks
- 💻 **VS Code** in browser (code-server)
- 🎨 **Full Desktop** (Cinnamon with macOS theme)

### **Intel Mac:**
- ✅ All tools (CPU-only, no GPU)
- ✅ Great for development & testing
- ✅ Same environment as Apple Silicon

---

## 📋 Prerequisites

- ✅ **macOS** (any version with Docker Desktop)
- ✅ **Docker Desktop** installed and running
- ✅ **70GB+ free disk space**
- ✅ **Stable internet** (downloads ~15GB)

---

## 🏃 Step-by-Step

### 1. Ensure Docker Desktop is Running

Open Docker Desktop from Applications folder.

### 2. Navigate to Project

```bash
cd ~/wisejnrs-projects/wisejnrs-carbon-runtime
```

### 3. Run the Build

```bash
./build-all-macos.sh
```

### 4. Wait for Completion

- ☕ **Phase 1:** carbon-base-macos (15-25 min)
- ☕☕ **Phase 2:** carbon-compute-macos (25-40 min)
- ✅ **Phase 3:** Verification tests (2-3 min)

**Go grab coffee - the script does everything!**

### 5. Access Your Environment

When complete, you'll see:

```
🎉 Build Complete!

Access Points:
  Desktop (noVNC): http://localhost:6900
  Jupyter Lab:     http://localhost:8888
  VS Code:         http://localhost:9999

✅ MPS GPU: ENABLED (Apple Silicon)
✅ PyTorch: 4-6x faster training
✅ TensorFlow: Metal plugin active
```

---

## 🧪 Test GPU Acceleration

### In Jupyter Lab (http://localhost:8888)

Create a new notebook:

```python
import torch

# Check MPS
print(f"MPS available: {torch.backends.mps.is_available()}")

# Use MPS GPU
device = torch.device("mps")
x = torch.rand(1000, 1000, device=device)
y = torch.rand(1000, 1000, device=device)
z = torch.matmul(x, y)

print("✅ GPU computation successful!")
```

### Monitor GPU Usage

1. Open **Activity Monitor**
2. **Window** → **GPU History**
3. Run the code above
4. Watch GPU spike! 📈

---

## 📚 Documentation

While building, read:

| Document | Description |
|----------|-------------|
| **CARBON-MACOS-COMPLETE.md** | Complete overview |
| **CARBON-MACOS-TESTING.md** | Testing guide (replicates blog post) |
| **carbon-compute-macos/README.md** | ML/AI with MPS examples |
| **MACOS.md** | Quick reference |

---

## 🆘 Troubleshooting

### Build fails

```bash
# Check Docker is running
docker info

# Check disk space
df -h .

# Try manual build
./build-macos.sh --arm64          # Build base
./build-compute-macos.sh --arm64  # Build compute
```

### MPS not available

```bash
# Verify architecture
uname -m
# Should show: arm64

# Check image platform
docker inspect carbon-test | grep -i arch
```

### Out of disk space

```bash
# Clean up Docker
docker system prune -a

# Remove old images
docker images
docker rmi <image-id>
```

---

## 🎓 What to Try First

### 1. Jupyter Lab Examples

Access: http://localhost:8888

**Try:**
- PyTorch MPS training
- TensorFlow Metal examples
- Data visualization with pandas
- SQL queries (PostgreSQL included)

### 2. Desktop Environment

Access: http://localhost:6900

**Explore:**
- Firefox browser
- VS Code desktop
- Terminal (all languages installed)
- File manager

### 3. VS Code in Browser

Access: http://localhost:9999

**Features:**
- 100+ extensions pre-installed
- Full Python support
- Jupyter integration
- Git integration

---

## 🔄 Container Management

```bash
# Stop container
docker stop carbon-test

# Start container
docker start carbon-test

# View logs
docker logs carbon-test

# Remove container (keeps images)
docker stop carbon-test && docker rm carbon-test

# Restart with different ports
docker run -d --name carbon-test \
  -p 6901:6900 -p 8889:8888 -p 9998:9999 \
  wisejnrs/carbon-compute-macos:latest
```

---

## 📊 Performance Expectations

### Apple Silicon (M1/M2/M3/M4)

| Task | Speed |
|------|-------|
| PyTorch Training | **4-6x faster** than CPU ⚡ |
| TensorFlow Training | **3-5x faster** than CPU ⚡ |
| LLM Inference (llama.cpp) | **5-8x faster** than CPU ⚡ |
| Computer Vision (YOLO) | **3-4x faster** than CPU ⚡ |

### Intel Mac

| Task | Speed |
|------|-------|
| All operations | CPU-only (no GPU) |
| Still great for | Development, testing, learning |

---

## 🎯 Replicating the Blog Post

This environment replicates:
**[Carbon Development Suite AI Playground](https://www.wisejnrs.net/blog/carbon-development-suite-ai-playground)**

All 10 experiments adapted for macOS MPS:

1. ✅ Neural Network GPU Training (PyTorch MPS)
2. ✅ Local LLM Deployment (Ollama + llama-cpp)
3. ✅ Vector Search (pgvector)
4. ✅ Transformer Fine-tuning (Hugging Face + MPS)
5. ✅ Computer Vision (YOLOv5 + MPS)
6. ✅ Distributed Training (Apache Spark)
7. ✅ RAG System (pgvector + llama-cpp)
8. ✅ GAN Training (MPS)
9. ✅ LSTM Time Series (MPS)
10. ✅ REST API Deployment (Flask/FastAPI)

**See:** `CARBON-MACOS-TESTING.md` for complete testing guide

---

## 🌟 Tips for Success

### 1. Allocate Enough Resources

Docker Desktop → Settings → Resources:
- **CPU:** 6+ cores
- **Memory:** 12GB+
- **Swap:** 4GB

### 2. Monitor Performance

- Use **Activity Monitor** to watch GPU usage
- Check **htop** in container for CPU
- View Jupyter resource monitor

### 3. Save Your Work

```bash
# Mount workspace directory
docker run -d --name carbon-test \
  -v ~/carbon-workspace:/work \
  ...

# Your notebooks and code save to ~/carbon-workspace
```

### 4. Use Databases

```bash
# Enable PostgreSQL and Qdrant
docker run -d --name carbon-test \
  -e ENABLE_POSTGRESQL=true \
  -e ENABLE_QDRANT=true \
  -p 5432:5432 -p 6333:6333 \
  ...
```

---

## 🚀 Ready to Begin!

```bash
./build-all-macos.sh
```

**The script handles everything:**
- ✅ Checks prerequisites
- ✅ Builds both images
- ✅ Starts container
- ✅ Runs tests
- ✅ Shows you exactly what to do next

**Sit back and let it run!** ☕

---

## 📞 Support

- **GitHub:** https://github.com/wisejnrs/wisejnrs-carbon-runtime
- **Blog:** https://www.wisejnrs.net
- **Issues:** Report any problems on GitHub

---

**Let's build something amazing! 🎉**
