# Carbon Images Optimization & GPU Access Plan

## Current State

### Image Sizes
- **carbon-base:latest-gpu**: 45GB
- **carbon-tools:latest**: 53.8GB
- **carbon-compute:latest**: 69.6GB

### Issues
1. ❌ **carbon-tools** doesn't have GPU access (uses non-GPU base)
2. ⚠️  Images are very large (45-70GB each)
3. ⚠️  Long build times

## Root Causes of Large Images

### carbon-base (45GB)
- NVIDIA CUDA base image: ~10GB
- CUDA Toolkit 12.2 installation: ~3.5GB
- Desktop environment (Cinnamon + dependencies): ~5GB
- Development tools (build-essential, compilers): ~2GB
- Node.js + npm packages: ~1.5GB
- Python packages (miniconda): ~3GB
- Themes (WhiteSur, icons): ~500MB
- Creative apps (GIMP, Inkscape, etc.): ~8GB
- NVIDIA drivers/utils: ~500MB

### carbon-compute (+25GB on top of base)
- Apache Spark: ~400MB
- Conda packages (numpy, pandas, ML libs): ~5GB
- PyTorch + CUDA libraries: ~10GB
- Jupyter + extensions: ~2GB
- Code-server + extensions: ~3GB
- vLLM inference engine: ~2GB
- Database clients: ~1GB

### carbon-tools (+9GB on top of base)
- Security tools (nmap, nikto, wireshark, etc.): ~2GB
- Retro emulators (VICE, RetroArch, MAME): ~3GB
- Additional creative apps (Blender, OBS, etc.): ~4GB

## GPU Access Fix

### carbon-tools (CRITICAL FIX)
**Current:** Uses `wisejnrs/carbon-base:latest` (no GPU)
**Fix:** Change to `wisejnrs/carbon-base:latest-gpu`

```dockerfile
# carbon-tools/Dockerfile line 2
ARG ROOT_CONTAINER=wisejnrs/carbon-base:latest-gpu
```

### carbon-compute (Already Correct)
✅ Already uses `wisejnrs/carbon-base:latest-gpu`

## Optimization Strategies

### Quick Wins (Can Do Now)
1. **Fix carbon-tools GPU base** - Change 1 line
2. **Clean up apt cache in each layer** - Already done but verify
3. **Remove build dependencies after builds** - Add cleanup
4. **Combine RUN commands** - Reduce layers

### Medium Effort
5. **Multi-stage builds** - Separate build and runtime stages
6. **Conditional installs** - Make some heavy packages optional
7. **Smaller base images** - Consider ubuntu:22.04 + selective CUDA
8. **Remove unnecessary locales** - Save ~500MB

### Advanced (Future)
9. **Separate GPU and CPU variants**
10. **Layer caching strategy** - Optimize build order
11. **Slim variants** - Create lighter versions without desktop

## Recommended Actions (Priority Order)

### 1. Fix GPU Access (IMMEDIATE)
```bash
# Edit carbon-tools/Dockerfile
sed -i 's/wisejnrs\/carbon-base:latest/wisejnrs\/carbon-base:latest-gpu/' carbon-tools/Dockerfile
```

### 2. Add Cleanup to Large Layers
Add to end of large RUN commands:
```dockerfile
&& apt-get clean \
&& rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* \
&& find /usr/share/doc -depth -type f ! -name copyright -delete \
&& find /usr/share/man -depth -type f -delete
```

### 3. Optional: Create Minimal Variants
- `carbon-base:latest-minimal` (no desktop, no themes) ~15GB
- `carbon-compute:latest-minimal` (CLI only) ~35GB
- `carbon-tools:latest-minimal` (essential tools only) ~25GB

### 4. Build Argument Flexibility
Add conditional installs:
```dockerfile
ARG INSTALL_DESKTOP=true
ARG INSTALL_THEMES=true
ARG INSTALL_CREATIVE=true
```

## Expected Results

### After GPU Fix
- carbon-tools will have CUDA access
- Can run GPU-accelerated tools (Blender, etc.)

### After Cleanup Optimizations
- Reduce each image by ~5-10%
- Faster builds (less to compress)

### After Multi-stage Builds
- Reduce images by ~20-30%
- Separate build tools from runtime

## Implementation Plan

**Phase 1: Critical Fix (TODAY)**
- [ ] Fix carbon-tools GPU base image
- [ ] Rebuild carbon-tools with GPU support
- [ ] Test GPU access in carbon-tools

**Phase 2: Quick Optimizations (THIS WEEK)**
- [ ] Add comprehensive cleanup to all RUN commands
- [ ] Verify apt cache is cleaned
- [ ] Combine related RUN commands
- [ ] Rebuild all images

**Phase 3: Advanced (NEXT SPRINT)**
- [ ] Implement multi-stage builds
- [ ] Create minimal variants
- [ ] Add build-time options

## Testing GPU Access

After rebuilding:
```bash
# Test in carbon-compute
docker run --rm --gpus all wisejnrs/carbon-compute:latest nvidia-smi

# Test in carbon-tools
docker run --rm --gpus all wisejnrs/carbon-tools:latest nvidia-smi

# Test in containers
docker exec carbon-compute nvidia-smi
docker exec carbon-tools nvidia-smi  # after creating container
```

## Notes

- GPU access requires `--gpus all` flag when running containers
- Current runtime environment is CPU-only (no NVIDIA drivers on host)
- Images will work in CPU mode but have GPU capability when drivers available
