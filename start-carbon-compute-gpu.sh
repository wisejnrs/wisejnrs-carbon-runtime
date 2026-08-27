#!/bin/bash
# Start carbon-compute with GPU support

set -e

echo "🚀 Starting Carbon Compute with GPU Support"
echo "============================================="
echo ""

# Test GPU on host first
echo "1. Verifying NVIDIA GPU on host..."
if nvidia-smi &>/dev/null; then
    echo "   ✅ NVIDIA GPU detected!"
    nvidia-smi --query-gpu=name,driver_version,memory.total --format=csv,noheader
else
    echo "   ❌ ERROR: nvidia-smi failed. Reboot may not have loaded drivers."
    echo "   Try: sudo reboot"
    exit 1
fi

echo ""
echo "2. Stopping any existing carbon-compute container..."
docker stop carbon-compute 2>/dev/null || true
docker rm carbon-compute 2>/dev/null || true

echo ""
echo "3. Starting carbon-compute with GPU (--gpus all)..."
docker run -d \
  --gpus all \
  --name carbon-compute \
  -p 8888:8888 \
  -p 9999:9999 \
  -p 8080:8080 \
  -p 6080:6080 \
  -p 3390:3389 \
  -p 2222:22 \
  -v /path/to/your-workspace:/work \
  -e JUPYTER_ENABLE_LAB=yes \
  wisejnrs/carbon-compute:latest

echo ""
echo "4. Waiting for services to start..."
sleep 15

echo ""
echo "5. Verifying GPU access in container..."
docker exec carbon-compute nvidia-smi --query-gpu=name,memory.total --format=csv,noheader

echo ""
echo "6. Testing PyTorch CUDA..."
docker exec carbon-compute python3 -c "import torch; print(f'CUDA available: {torch.cuda.is_available()}'); print(f'GPU count: {torch.cuda.device_count()}'); print(f'GPU name: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else \"N/A\"}')"

echo ""
echo "============================================="
echo "✅ Carbon Compute Started with GPU Support!"
echo "============================================="
echo ""
echo "Access your environment:"
echo "  - VNC Desktop:    http://localhost:6080"
echo "  - Jupyter Lab:    http://localhost:8888"
echo "  - VS Code:        http://localhost:9999"
echo "  - Spark UI:       http://localhost:8080"
echo ""
echo "Services status:"
docker exec carbon-compute supervisorctl status | grep RUNNING | head -10
echo ""
echo "Image: wisejnrs/carbon-compute:latest (55GB optimized)"
echo "GPU: ENABLED ✅"
echo ""
