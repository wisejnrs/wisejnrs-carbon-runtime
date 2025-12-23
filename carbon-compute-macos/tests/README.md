# Carbon macOS Test Suite

This directory contains test scripts to verify all functionality of carbon-compute-macos, replicating the [Carbon Development Suite AI Playground](https://www.wisejnrs.net/blog/carbon-development-suite-ai-playground) for macOS with MPS GPU acceleration.

## Quick Start

### 1. Verify MPS GPU Acceleration

```bash
docker exec carbon-compute python3 /home/carbon/tests/verify_mps.py
```

**Expected Output:**
```
✅ SUCCESS: All GPU acceleration features working!
 PyTorch MPS:        PASS
 TensorFlow Metal:   PASS
 llama-cpp-python:   PASS
```

### 2. Run Individual Tests

```bash
# Test 1: PyTorch Neural Network Training (MPS)
docker exec carbon-compute python3 /home/carbon/tests/test1_pytorch_mps.py

# Expected: ~1000-2000 samples/sec on M1/M2
# Expected: ~2000-4000 samples/sec on M3/M4
```

## Test Suite Overview

| Test | Description | GPU | Expected Performance |
|------|-------------|-----|---------------------|
| `verify_mps.py` | Quick MPS verification | ✅ | < 5 seconds |
| `test1_pytorch_mps.py` | Neural network training | ✅ MPS | 4-6x speedup |
| `test2_llm_inference.py` | LLM deployment | ✅ Metal | 5-8x speedup |
| `test3_vector_search.py` | pgvector semantic search | ❌ CPU | < 10ms |
| `test4_transformer_mps.py` | BERT fine-tuning | ✅ MPS | 2-4x speedup |
| `test5_computer_vision.py` | YOLOv5 detection | ✅ MPS | 3-4x speedup |

## Performance Expectations

### Apple Silicon (M1/M2/M3/M4)

- **PyTorch Training:** 1000-4000 samples/sec (4-6x faster than CPU)
- **TensorFlow Training:** 3-5x faster than CPU
- **LLM Inference:** 5-8x faster with llama-cpp Metal
- **Computer Vision:** 20-30 FPS with YOLOv5

### Intel Mac

- **All operations:** CPU-only (no GPU acceleration)
- **Still functional:** Great for development and testing

## Monitoring GPU Usage

While tests run, monitor GPU usage:

1. Open **Activity Monitor**
2. **Window** → **GPU History**
3. Watch GPU utilization spike during MPS operations

## Full Documentation

See `CARBON-MACOS-TESTING.md` in the project root for:
- Complete test descriptions
- Additional test scripts
- Troubleshooting guide
- Performance benchmarks

## Requirements

- Apple Silicon Mac (M1/M2/M3/M4) for GPU acceleration
- Docker Desktop for Mac
- carbon-compute-macos container running

## Support

For issues or questions:
- GitHub: https://github.com/wisejnrs/wisejnrs-carbon-runtime
- Blog: https://www.wisejnrs.net
