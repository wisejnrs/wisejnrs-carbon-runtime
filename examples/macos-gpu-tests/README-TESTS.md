# Carbon macOS + GPU Test Suite

**Purpose:** Prove GPU acceleration working on macOS with krunkit
**Reference:** https://www.wisejnrs.net/blog/carbon-development-suite-ai-playground

---

## Test Notebooks

### **01-GPU-Verification.ipynb**
**Proves:** GPU device accessible
**Tests:**
- /dev/dri/renderD128 device exists
- krunkit passthrough working
- System configuration

**Expected Output:**
```
✅ /dev/dri exists
✅ renderD128 (GPU render node) FOUND!
✅ GPU passthrough via krunkit WORKING!
```

---

### **02-PyTorch-Performance.ipynb**
**Proves:** GPU-accelerated compute
**Tests:**
- Matrix multiplication benchmarks
- Performance at different scales
- Throughput measurements

**Expected Results:**
- 100x100: ~4500 ops/sec
- 1000x1000: ~150 ops/sec
- 3000x3000: GPU benefits visible

---

### **03-ML-Pipeline-Demo.ipynb**
**Proves:** Complete ML workflow
**Tests:**
- Data generation and preparation
- Model training (Random Forest)
- Evaluation and metrics
- Visualization

**Expected Output:**
- Dataset: 10,000 samples, 20 features
- Training: Complete in <10s
- Accuracy: >0.85
- Feature importance plot

---

## How to Run

### **In JupyterLab:**

1. Open http://localhost:8888
2. Navigate to test notebooks
3. Run: Cell → Run All Cells
4. Observe results

### **Expected Proof:**

All notebooks should run successfully showing:
- ✅ GPU device accessible
- ✅ Vulkan working (where applicable)
- ✅ PyTorch computations fast
- ✅ Complete ML pipeline functional
- ✅ All on macOS with krunkit GPU!

---

## Performance Baseline

**Platform:** macOS 26.2 + Apple Silicon
**Container:** carbon-compute-macos
**GPU:** krunkit + MoltenVK + Vulkan

**Expected Performance:**
- Compute operations: 2-4x faster vs CPU
- ML inference: Improved throughput
- Vulkan shaders: 3-4x faster

---

## Proof Documentation

After running tests, you have:
- ✅ Screenshots of output
- ✅ Performance numbers
- ✅ GPU device confirmation
- ✅ Complete workflow proof

**Ready for blog post or presentation!**

---

**Last Updated:** 2025-12-24
**Status:** Ready to execute
**Container:** carbon-compute-gpu-full
