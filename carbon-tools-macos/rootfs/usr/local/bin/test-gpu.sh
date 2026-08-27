#!/bin/bash
# GPU Test Script for Carbon macOS Images
# Tests GPU device access and performance

echo "=========================================="
echo "  Carbon GPU Test"
echo "=========================================="
echo ""

# Test 1: GPU Device
echo "=== GPU Device Status ==="
echo ""
if [ -d "/dev/dri" ]; then
    echo "✅ GPU device directory exists!"
    devices=$(ls /dev/dri 2>/dev/null)
    echo "   Devices: $devices"

    if echo "$devices" | grep -q "renderD128"; then
        echo "   ✅ renderD128 (GPU render node) FOUND!"
    else
        echo "   ⚠️  renderD128 not found"
    fi
else
    echo "❌ No GPU device directory"
    echo "   Container must be started with: --device /dev/dri"
fi
echo ""

# Test 2: Vulkan
echo "=== Vulkan Status ==="
echo ""
if command -v vulkaninfo &> /dev/null; then
    vulkaninfo --summary 2>&1 | head -15 || echo "Vulkan info unavailable"
else
    echo "vulkaninfo not installed"
fi
echo ""

# Test 3: Python (if available)
echo "=== Python GPU Test ==="
echo ""
if command -v python3 &> /dev/null; then
    python3 << 'PYTHON'
try:
    import os
    print("Python GPU environment check:")

    # Check GPU device
    if os.path.exists('/dev/dri/renderD128'):
        print("  ✅ GPU device accessible from Python")
    else:
        print("  ⚠️  GPU device not found")

    # Try importing torch
    try:
        import torch
        print(f"  ✅ PyTorch {torch.__version__} available")
    except ImportError:
        print("  ℹ️  PyTorch not installed (install in carbon-compute)")

    print("  ✅ Python environment ready!")
except Exception as e:
    print(f"  ⚠️  Error: {e}")
PYTHON
else
    echo "Python not available"
fi
echo ""

echo "=========================================="
echo "Test complete!"
echo ""
echo "To use GPU, run container with:"
echo "  podman run --device /dev/dri ..."
echo "=========================================="
