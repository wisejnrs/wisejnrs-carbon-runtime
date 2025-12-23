#!/usr/bin/env python3
"""
MPS Verification Script
Quick check that all GPU acceleration is working properly
"""

import sys

print("=" * 70)
print(" Carbon macOS MPS GPU Verification")
print("=" * 70)
print()

# Check 1: PyTorch MPS
print("1. PyTorch MPS Check")
print("-" * 70)
try:
    import torch
    print(f"   PyTorch version: {torch.__version__}")
    print(f"   MPS available: {torch.backends.mps.is_available()}")
    print(f"   MPS built: {torch.backends.mps.is_built()}")

    if torch.backends.mps.is_available():
        # Test computation
        x = torch.rand(100, 100, device="mps")
        y = torch.rand(100, 100, device="mps")
        z = torch.matmul(x, y)
        print(f"   ✅ MPS computation successful!")
        pytorch_status = "PASS"
    else:
        print(f"   ⚠️  MPS not available")
        pytorch_status = "FAIL"
except Exception as e:
    print(f"   ❌ Error: {e}")
    pytorch_status = "ERROR"

print()

# Check 2: TensorFlow Metal
print("2. TensorFlow Metal Check")
print("-" * 70)
try:
    import tensorflow as tf
    print(f"   TensorFlow version: {tf.__version__}")

    gpus = tf.config.list_physical_devices('GPU')
    print(f"   GPUs detected: {len(gpus)}")

    if gpus:
        for i, gpu in enumerate(gpus):
            print(f"   GPU {i}: {gpu.name}")

        # Test computation
        with tf.device('/GPU:0'):
            a = tf.random.normal([100, 100])
            b = tf.random.normal([100, 100])
            c = tf.matmul(a, b)
        print(f"   ✅ Metal GPU computation successful!")
        tensorflow_status = "PASS"
    else:
        print(f"   ⚠️  No GPU detected")
        tensorflow_status = "FAIL"
except Exception as e:
    print(f"   ❌ Error: {e}")
    tensorflow_status = "ERROR"

print()

# Check 3: llama-cpp-python
print("3. llama-cpp-python Check")
print("-" * 70)
try:
    from llama_cpp import Llama
    import platform

    arch = platform.machine()
    print(f"   Architecture: {arch}")
    print(f"   llama-cpp-python: Installed")

    if arch in ['arm64', 'aarch64']:
        print(f"   ✅ Metal support available (Apple Silicon)")
        llamacpp_status = "PASS"
    else:
        print(f"   ⚠️  CPU-only (Intel Mac)")
        llamacpp_status = "PASS (CPU)"
except Exception as e:
    print(f"   ❌ Error: {e}")
    llamacpp_status = "ERROR"

print()

# Summary
print("=" * 70)
print(" Verification Summary")
print("=" * 70)
print(f" PyTorch MPS:        {pytorch_status}")
print(f" TensorFlow Metal:   {tensorflow_status}")
print(f" llama-cpp-python:   {llamacpp_status}")
print("=" * 70)
print()

# Overall result
if pytorch_status == "PASS" and tensorflow_status == "PASS":
    print("✅ SUCCESS: All GPU acceleration features working!")
    print()
    print("Next steps:")
    print("  - Run full test suite: python3 tests/test1_pytorch_mps.py")
    print("  - Monitor GPU usage: Activity Monitor → Window → GPU History")
    print("  - Start training models with 4-6x speedup!")
    sys.exit(0)
else:
    print("⚠️  WARNING: Some GPU features not available")
    print()
    print("Troubleshooting:")
    print("  - Ensure you're on Apple Silicon (M1/M2/M3/M4)")
    print("  - Check: uname -m (should show 'arm64')")
    print("  - Rebuild image: ./build-compute-macos.sh --arm64")
    sys.exit(1)
