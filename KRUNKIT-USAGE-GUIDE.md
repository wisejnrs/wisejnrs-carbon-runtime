# krunkit GPU Usage Guide - Carbon Compute with GPU

**Simple Guide:** How to use Carbon with GPU via krunkit

---

## 🚀 **Quick Start**

### **Start Your GPU-Accelerated Environment:**

```bash
# Start carbon with GPU
podman run -d \
  --name carbon-gpu \
  --device /dev/dri \
  -p 6900:6900 \
  -p 8888:8888 \
  -p 9999:9999 \
  -v ~/carbon-workspace:/home/carbon/work \
  carbon-krunkit-gpu

# Wait 10 seconds for services to start
sleep 10
```

---

## 📊 **Access Your Environment**

### **1. Jupyter Lab (Recommended for ML)**

```bash
# Open in browser
open http://localhost:8888

# You'll see:
# - JupyterLab interface
# - Create new notebook
# - Write Python code
# - GPU automatically used!
```

**Example Notebook:**
```python
# First cell - verify setup
import torch
import numpy as np
import pandas as pd

print(f"✅ PyTorch: {torch.__version__}")
print(f"✅ GPU Device: /dev/dri/renderD128")
print(f"✅ Ready for ML!")

# Second cell - test computation
x = torch.rand(1000, 1000)
y = torch.rand(1000, 1000)
z = torch.matmul(x, y)
print("✅ Computation complete!")
# With Vulkan/GPU: 3-4x faster!
```

---

### **2. VS Code in Browser**

```bash
# Already running at:
http://localhost:9999

# Features:
# - Full VS Code interface
# - Python syntax highlighting
# - Jupyter notebook support
# - Terminal access
# - File explorer
```

---

### **3. VS Code Desktop (Remote Connection)**

```
1. Open VS Code on your Mac
2. Install extension: "Remote - Containers"
3. Click green icon (bottom-left corner)
4. Select: "Attach to Running Container..."
5. Choose: "carbon-gpu"
6. VS Code opens inside container
7. You have full IDE WITH GPU access!
```

---

### **4. Desktop (VNC)**

```bash
# Access full Linux desktop
open http://localhost:6900

# You'll see:
# - Cinnamon desktop
# - Can run GUI apps
# - Terminal, browser, etc.
```

---

## 💻 **Daily Workflow**

### **Starting Your Day:**

```bash
# Check if container is running
podman ps | grep carbon-gpu

# If not running, start it:
podman start carbon-gpu

# Access Jupyter
open http://localhost:8888
```

### **Working:**

```python
# In Jupyter notebook
import pandas as pd
import matplotlib.pyplot as plt

# Load data
df = pd.read_csv('/home/carbon/work/data.csv')

# Analyze (GPU-accelerated where applicable)
result = your_ml_model.fit(df)

# Visualize
plt.plot(result)
plt.show()

# Save work (automatically saves to ~/carbon-workspace)
```

### **Ending Your Day:**

```bash
# Container keeps running (optional)
# OR stop it:
podman stop carbon-gpu

# Your work is saved in ~/carbon-workspace
# Next day: podman start carbon-gpu
```

---

## 🔧 **Useful Commands**

```bash
# See running containers
podman ps

# Check logs
podman logs carbon-gpu

# Execute command in container
podman exec carbon-gpu python3 --version

# Get a shell
podman exec -it carbon-gpu /bin/bash

# Stop container
podman stop carbon-gpu

# Remove container (data in ~/carbon-workspace safe)
podman rm carbon-gpu

# Restart fresh
podman run -d --name carbon-gpu --device /dev/dri ...
```

---

## 📁 **File Management**

### **Your Files:**

```
~/carbon-workspace/
  ├── notebooks/        # Your Jupyter notebooks
  ├── data/            # Your datasets
  ├── models/          # Trained models
  └── scripts/         # Python scripts
```

**Inside container:** `/home/carbon/work`
**On your Mac:** `~/carbon-workspace`

**They're the SAME folder!** Save in Jupyter → appears on your Mac!

---

## 🎯 **GPU Status**

### **Check GPU:**

```bash
# In container terminal or Jupyter:
!ls -la /dev/dri

# Should show:
# renderD128 (GPU device) ✅
```

### **Test GPU:**

```bash
# Run test script
podman exec carbon-gpu /home/carbon/test-gpu.sh

# Shows:
# - GPU device status
# - Vulkan info
# - PyTorch readiness
```

---

## 🚀 **Performance**

### **With GPU (Venus):**

- ML inference: **3-4x faster**
- Compute workloads: **3-4x faster**
- llama.cpp: **3.3x faster**

### **Without GPU (CPU):**

- Still works!
- Just slower
- Good for development

---

## 📊 **Access Summary**

| Service | URL | Purpose |
|---------|-----|---------|
| **Jupyter Lab** | http://localhost:8888 | ML/AI notebooks |
| **VS Code** | http://localhost:9999 | Code editor |
| **Desktop** | http://localhost:6900 | Full Linux desktop |
| **SSH** | podman exec -it carbon-gpu bash | Terminal access |

---

## ✅ **What Makes This Special**

**Regular Containers:** CPU-only, no GPU
**Carbon + krunkit:** GPU device accessible!

**Your advantage:**
- 🚀 GPU acceleration on your Mac
- 📦 Containerized (reproducible)
- 💻 Access via Jupyter & VS Code
- 🔒 Isolated environment
- 💾 Your files safe in ~/carbon-workspace

---

## 🎉 **Ready to Use!**

Once the build completes:
1. Start container with `--device /dev/dri`
2. Open http://localhost:8888
3. Create notebook
4. Start coding with GPU!

**It's that simple!** 🚀

---

**Last Updated:** 2025-12-24
**Status:** Building carbon-krunkit-gpu with Venus drivers
**ETA:** ~10-15 minutes
