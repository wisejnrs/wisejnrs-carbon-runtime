# Aggressive Optimization Plan - Target: 30-40% Size Reduction

## Current State
- carbon-base: 45GB
- carbon-compute: 69.6GB
- carbon-tools: 53.8GB
- **Total: 168.4GB**

## Target State
- carbon-base: ~30GB (33% reduction, -15GB)
- carbon-compute: ~50GB (28% reduction, -19.6GB)
- carbon-tools: ~40GB (26% reduction, -13.8GB)
- **Target Total: ~120GB (save ~48GB)**

---

## 🎯 Strategy 1: Multi-Stage Builds (HIGHEST IMPACT)

### Concept
Separate build-time dependencies from runtime. Build tools aren't needed at runtime.

### Implementation for carbon-base

```dockerfile
# ===== STAGE 1: Builder =====
FROM nvidia/cuda:12.1.1-cudnn8-devel-ubuntu22.04 AS builder

# Install ALL build dependencies here
RUN apt-get update && apt-get install -y \
    build-essential cmake ninja-build \
    git wget curl \
    # ... all dev packages

# Build everything that needs compilation
# (Node.js native modules, Python wheels, etc.)

# ===== STAGE 2: Runtime =====
FROM nvidia/cuda:12.1.1-cudnn8-runtime-ubuntu22.04 AS runtime

# Copy ONLY compiled artifacts from builder
COPY --from=builder /usr/local/bin /usr/local/bin
COPY --from=builder /usr/local/lib /usr/local/lib

# Install ONLY runtime dependencies
# NO build-essential, NO compilers, NO dev headers
```

**Expected Savings:** 5-8GB (build tools, headers, static libs)

---

## 🎯 Strategy 2: Conditional Desktop (MEDIUM IMPACT)

### Make Desktop Optional

```dockerfile
ARG INSTALL_DESKTOP=true
ARG INSTALL_CREATIVE_APPS=true

RUN if [ "$INSTALL_DESKTOP" = "true" ]; then \
      # Install Cinnamon + desktop
    fi

RUN if [ "$INSTALL_CREATIVE_APPS" = "true" ]; then \
      # Install GIMP, Blender, OBS, etc.
    fi
```

### Create Variants
- `carbon-base:latest-gpu` - Full desktop (45GB)
- `carbon-base:latest-gpu-minimal` - No desktop (30GB, save 15GB)
- `carbon-base:latest-gpu-server` - CLI only (25GB, save 20GB)

**Expected Savings:** 15-20GB for minimal variants

---

## 🎯 Strategy 3: Remove Heavy Desktop Components (QUICK WIN)

### Identify & Remove Unnecessary Desktop Apps

Current desktop install includes ~12GB of apps. Many may not be essential.

#### High-Impact Removals (Won't affect core functionality):

**Creative Apps (Can Remove ~8GB):**
```bash
# These are HEAVY and rarely used in compute/ML workflows:
- GIMP (1.5GB)
- Blender (2GB)
- Inkscape (500MB)
- Scribus (400MB)
- Audacity (300MB)
- OBS Studio (800MB)
- Krita (1GB)
- Darktable (800MB)
- FreeCAD (600MB)
```

**Keep Essential Tools:**
- Firefox (web browser)
- VS Code (already installed separately)
- Tilix (terminal)
- Basic utilities

#### Implementation:
```dockerfile
# In carbon-base, make creative apps optional
ARG INSTALL_CREATIVE=false

RUN if [ "$INSTALL_CREATIVE" = "true" ]; then \
      apt-get install -y gimp inkscape blender ...; \
    fi
```

Move creative apps to carbon-tools ONLY (they make sense there, not in base).

**Expected Savings:** 8-10GB from carbon-base

---

## 🎯 Strategy 4: Slim Down Node.js Packages (MEDIUM WIN)

### Current Global Packages
Looking at carbon-base line 229, we install:
```bash
npm i -g typescript ts-node eslint prettier npm-check-updates nodemon pm2 http-server serve zx @anthropic-ai/claude-code
```

### Optimization
```dockerfile
# Essential only:
npm i -g @anthropic-ai/claude-code typescript

# Move dev tools to carbon-compute/carbon-tools only
# (in carbon-compute/tools:)
npm i -g eslint prettier nodemon pm2 ts-node
```

**Expected Savings:** 500MB-1GB

---

## 🎯 Strategy 5: Optimize Python/Conda (HIGH IMPACT)

### Current Issue
Conda/pip installs include:
- Full package tarballs in /opt/conda/pkgs/
- Multiple Python versions
- Unused dependencies

### Optimization
```dockerfile
# After conda/pip installs, aggressively clean:
RUN /opt/conda/bin/conda clean -afy && \
    /opt/conda/bin/conda clean --force-pkgs-dirs && \
    find /opt/conda -name "*.pyc" -delete && \
    find /opt/conda -name "*.pyo" -delete && \
    find /opt/conda -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true && \
    find /opt/conda -type d -name "tests" -exec rm -rf {} + 2>/dev/null || true && \
    find /opt/conda -type d -name "test" -exec rm -rf {} + 2>/dev/null || true
```

**Expected Savings:** 3-5GB

---

## 🎯 Strategy 6: Remove Duplicate CUDA (CRITICAL)

### Current Issue
We have BOTH:
1. NVIDIA CUDA base image (12.1.1) - ~10GB
2. CUDA Toolkit 12.2 installed manually - ~3.5GB

### Optimization
Pick ONE CUDA version:

**Option A:** Use only the base image CUDA
```dockerfile
# Remove the manual CUDA toolkit installation at line 333
# Keep nvidia/cuda:12.1.1 base
```

**Option B:** Use slim base + manual CUDA
```dockerfile
# Use ubuntu:22.04 as base
# Install only needed CUDA components (not full toolkit)
```

**Expected Savings:** 3-8GB

---

## 🎯 Strategy 7: Lazy Install Heavy Packages

### Move to Runtime Install
Instead of baking into image, install on first run:
- Blender
- OBS Studio
- Large ML models
- Retro emulators

### Create Install Scripts
```bash
# /usr/local/bin/install-blender.sh
# /usr/local/bin/install-creative-apps.sh
# etc.
```

User runs them as needed.

**Expected Savings:** 5-10GB (moved to optional runtime installs)

---

## 📋 Recommended Implementation Order

### Phase 1: Quick Wins (30 min work + 1hr rebuild)
**Target: Save 10-15GB**

1. ✅ Remove creative apps from carbon-base → Move to carbon-tools only
2. ✅ Optimize Conda cleanup (already started, enhance)
3. ✅ Slim down Node.js global packages
4. ✅ Remove duplicate CUDA

**Files to modify:**
- carbon-base/Dockerfile (remove creative apps, optimize CUDA)
- Estimated savings: 10-15GB on base = cascades to all images

### Phase 2: Multi-Stage Builds (2-3 hrs work + 1.5hr rebuild)
**Target: Save 15-20GB**

1. Separate builder and runtime stages
2. Remove build-essential from runtime
3. Copy only compiled artifacts

**Files to create:**
- carbon-base/Dockerfile.multistage
- Estimated savings: 5-8GB on base + 10-12GB on compute/tools

### Phase 3: Conditional Builds (1 hr work)
**Target: Create variants**

1. Add build args for optional components
2. Create minimal variants
3. Document build options

**New images:**
- carbon-base:latest-gpu-minimal (30GB)
- carbon-base:latest-gpu-server (25GB)

---

## 🚀 Let's Start: Phase 1 Quick Wins

Would you like me to:

**A) Go full aggressive** - Implement all Phase 1 optimizations now
  - Remove creative apps from base
  - Optimize CUDA (pick one version)
  - Enhanced Python/Conda cleanup
  - Slim Node.js packages
  - Expected time: 30 min edits + 1hr rebuild
  - Expected result: carbon-base ~32GB, compute ~55GB, tools ~48GB

**B) Start with creative apps only** - Safest first step
  - Move GIMP, Blender, OBS, etc. from base to tools
  - Keep everything else the same
  - Expected time: 15 min + 1hr rebuild
  - Expected result: carbon-base ~37GB (save 8GB)

**C) Do Phase 2 multi-stage** - Biggest long-term win
  - Requires restructuring Dockerfiles
  - More complex but maximum savings
  - Expected time: 2-3 hrs + 1.5hr rebuild
  - Expected result: carbon-base ~28GB (save 17GB)

What's your priority: **speed (B), balance (A), or maximum savings (C)**?
