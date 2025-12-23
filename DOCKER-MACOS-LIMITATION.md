# Docker on macOS - GPU Limitation

**Important Discovery:** Docker containers **cannot access macOS Metal/MPS GPU** acceleration.

---

## Why MPS Doesn't Work in Docker

### How Docker Works on Mac

```
┌─────────────────────────────────────┐
│         Your Mac (macOS)            │
│    - Apple Silicon M1/M2/M3/M4      │
│    - Metal Performance Shaders      │
│    - macOS GPU APIs                 │
│                                     │
│  ┌───────────────────────────────┐ │
│  │   Docker Desktop (Linux VM)   │ │
│  │                               │ │
│  │  ┌─────────────────────────┐ │ │
│  │  │  Container (Ubuntu)     │ │ │
│  │  │  - Sees Linux only      │ │ │
│  │  │  - No access to Metal   │ │ │
│  │  │  - No macOS APIs        │ │ │
│  │  │  - CPU-only             │ │ │
│  │  └─────────────────────────┘ │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Key Points:**
1. Docker Desktop runs a **Linux VM** on your Mac
2. Containers run **Ubuntu Linux**, not macOS
3. Linux containers **cannot access macOS frameworks** like Metal
4. MPS/Metal are **macOS-exclusive** APIs
5. Docker Desktop doesn't currently support GPU passthrough on Mac

---

## What This Means

### ❌ **Not Available in Containers:**

- PyTorch MPS (Metal GPU)
- TensorFlow Metal plugin
- Metal-accelerated llama-cpp-python
- Any macOS GPU APIs
- Direct GPU access

### ✅ **What DOES Work:**

- All ML/AI frameworks (CPU mode)
- PyTorch 2.9.1 (CPU-only, but full-featured)
- TensorFlow 2.20.0 (CPU-only)
- llama-cpp-python (CPU mode)
- Jupyter Lab with all extensions
- code-server (VS Code in browser)
- Apache Spark
- All databases (PostgreSQL, MongoDB, Redis)
- All development tools
- Full desktop environment

---

## Performance Reality

### CPU Performance (in Docker on Mac):

| Task | Performance | Status |
|------|-------------|--------|
| **Development** | Native speed | ✅ Excellent |
| **Code editing** | Native speed | ✅ Perfect |
| **Small ML training** | Moderate | ✅ Usable |
| **Large ML training** | Slow | ⚠️ Use cloud |
| **LLM inference** | Slow | ⚠️ CPU-only |
| **Data analysis** | Good | ✅ Fine for dev |

**Bottom line:** Great for development, not for production training.

---

## Alternative Solutions

### For GPU-Accelerated ML on Mac:

#### **Option 1: Native macOS Installation (Recommended for Mac GPU)**

Install tools directly on macOS (not Docker):

```bash
# Install Python with Homebrew
brew install python@3.10

# Install PyTorch with MPS
pip3 install torch torchvision torchaudio

# Install TensorFlow with Metal
pip3 install tensorflow tensorflow-metal

# Now you have real GPU acceleration!
```

**Pros:**
- ✅ Actual MPS GPU acceleration (4-6x faster)
- ✅ TensorFlow Metal support
- ✅ Native performance

**Cons:**
- ❌ Not containerized (harder to reproduce)
- ❌ Installs directly on your Mac
- ❌ Can conflict with other projects

---

#### **Option 2: Hybrid Workflow (Recommended)**

**Develop in Docker on Mac → Train in Cloud with GPU**

```bash
# 1. Develop on Mac (carbon-compute-macos)
docker run -d --name carbon-dev \
  -p 8888:8888 -v ~/project:/work \
  wisejnrs/carbon-compute-macos:latest

# Work on your code, prototype, test

# 2. When ready to train, use cloud Linux
# Deploy to AWS/GCP/Azure with NVIDIA GPU
# Use carbon-compute (Linux variant with CUDA)

# 3. Train on GPU in cloud (fast)
# 4. Deploy to production
```

**Pros:**
- ✅ Clean development environment (Docker)
- ✅ Fast GPU training (cloud NVIDIA)
- ✅ Same codebase everywhere
- ✅ Cost-effective (only pay for GPU when training)

**Cons:**
- ⚠️ Requires cloud account
- ⚠️ Data transfer to/from cloud

---

#### **Option 3: Linux with NVIDIA GPU**

Use carbon-compute (Linux variant) on a machine with NVIDIA GPU:

```bash
# On Linux with NVIDIA GPU
docker run -d --gpus all --name carbon-gpu \
  -p 8888:8888 -v ~/project:/work \
  wisejnrs/carbon-compute:latest

# Full CUDA GPU acceleration
```

**Pros:**
- ✅ Fastest GPU training
- ✅ Containerized (reproducible)
- ✅ Full CUDA support

**Cons:**
- ❌ Requires Linux machine with NVIDIA GPU
- ❌ Not on your Mac

---

## What carbon-compute-macos IS Good For

### ✅ **Excellent Use Cases:**

1. **Development & Prototyping**
   - Write and test code
   - Prototype models
   - Debug algorithms
   - Test pipelines

2. **Learning ML/AI**
   - Follow tutorials
   - Experiment with frameworks
   - Understand concepts
   - Build portfolio projects

3. **Data Analysis**
   - pandas, numpy, scipy
   - Jupyter notebooks
   - Data visualization
   - SQL queries

4. **Small Model Training**
   - Fine-tune small models
   - Transfer learning
   - Quick experiments
   - Hyperparameter search (small scale)

5. **Testing & CI/CD**
   - Test ML code
   - Validate pipelines
   - Integration tests
   - Reproducible environment

6. **Cross-platform Development**
   - Develop on Mac
   - Deploy to Linux
   - Same environment everywhere

---

## Recommendations

### **For Mac Users:**

**Best workflow:**
```
1. Develop:      carbon-compute-macos (Docker on Mac)
2. Test:         carbon-compute-macos (CPU training)
3. GPU Training: Cloud Linux + NVIDIA (carbon-compute)
4. Production:   Linux servers
```

**Why this works:**
- ✅ Clean dev environment on your Mac
- ✅ No conflicts with your system
- ✅ Easy to reproduce and share
- ✅ GPU acceleration when you need it (cloud)
- ✅ Cost-effective (only pay for GPU when training)

### **For Native macOS GPU:**

If you really want GPU on your Mac:
```bash
# Skip Docker, install directly on macOS
brew install python@3.10
pip3 install torch tensorflow tensorflow-metal
# Now you have MPS GPU support
```

---

## Future Possibilities

### Docker Desktop GPU Support

Apple and Docker may eventually add GPU passthrough support, which would enable:
- ✅ MPS access from containers
- ✅ Metal API exposure
- ✅ GPU-accelerated training in Docker

**Current status:** Not available (as of Dec 2023)

**When available:** The MoltenVK and architecture we built will be ready!

---

## Summary

**Docker on macOS Limitation:**
- ❌ No GPU acceleration (MPS/Metal unavailable in containers)
- ✅ CPU-only mode (still great for development)

**carbon-compute-macos Value:**
- ✅ Complete ML/AI development environment
- ✅ All frameworks and tools
- ✅ Reproducible and shareable
- ✅ Perfect for learning and prototyping
- ✅ Hybrid workflow (dev on Mac, train in cloud)

**For GPU Training:**
- Use native macOS installation (MPS)
- OR use cloud Linux with NVIDIA (faster)
- OR use local Linux machine with NVIDIA

---

**The images we built are still incredibly valuable** - just understand the GPU limitation is a Docker architecture constraint, not a flaw in our implementation.

**Last Updated:** 2025-12-23
