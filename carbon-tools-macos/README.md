# Carbon Tools - macOS Edition

**Version:** 2.0.0-macos-tools
**Platform:** macOS (Intel + Apple Silicon via krunkit)
**GPU Support:** ✅ Via krunkit + Podman
**Base:** carbon-base-macos

---

## Overview

carbon-tools-macos adds creative applications, security tools, and DevOps utilities to carbon-base-macos, providing a complete toolkit for:

- Creative work (Blender, GIMP, Inkscape)
- Security research and pentesting
- DevOps and infrastructure management
- **All with GPU acceleration via krunkit!**

---

## What's Included

### **Creative Applications:**
- **Blender** - 3D modeling and animation (GPU-accelerated rendering!)
- **GIMP** - Image editing
- **Inkscape** - Vector graphics
- **Krita** - Digital painting
- **Kdenlive** - Video editing
- **Audacity** - Audio editing
- **LibreOffice** - Office suite

### **Security & Network Tools:**
- **nmap, nikto** - Network scanning
- **sqlmap** - SQL injection
- **gobuster, dirb** - Directory/DNS brute forcing
- **hydra** - Password cracking
- **Wireshark** - Packet analysis
- **aircrack-ng** - WiFi security
- **SecLists** - Security wordlists
- **Python tools:** scapy, requests

### **DevOps Tools:**
- **Docker CLI** - Container management
- **kubectl** - Kubernetes
- **Terraform** - Infrastructure as code
- **Ansible** - Configuration management
- **httpie** - Modern HTTP client
- **AWS CLI** - Cloud management

### **From carbon-base-macos:**
- All programming languages (Python, Node.js, Go, Java, Rust, Swift, R)
- Databases (PostgreSQL, MongoDB, Redis)
- Desktop environment (Cinnamon)
- Remote access (VNC, RDP, SSH)

---

## Quick Start

### **Build:**

```bash
# From repository root
podman build -t carbon-tools-macos -f carbon-tools-macos/Dockerfile carbon-tools-macos/
```

### **Run with GPU:**

```bash
podman run -d --name carbon-tools-gpu \
  --device /dev/dri \
  -p 6900:6900 \
  -p 5900:5901 \
  -v ~/carbon-workspace:/work \
  carbon-tools-macos:latest

# Access desktop
open http://localhost:6900
```

---

## GPU Support

### **GPU-Accelerated Applications:**

**Blender:**
- 3D rendering with GPU
- Cycles render engine
- GPU-accelerated viewport

**Video Editing:**
- Kdenlive with GPU encoding
- Faster video processing

**General:**
- OpenGL/Vulkan apps benefit from GPU
- 2-4x faster compute workloads

### **Test GPU:**

```bash
podman exec carbon-tools-gpu test-gpu.sh

# In Blender (via VNC):
# Edit → Preferences → System
# Cycles Render Devices → Check GPU
```

---

## Access

**VNC Desktop:** http://localhost:6900
**RDP:** localhost:3390 (carbon / Carbon123#)
**SSH:** podman exec -it carbon-tools-gpu bash

All applications available in desktop menu!

---

## Use Cases

### **Creative Work:**
- 3D modeling and animation with Blender
- Graphic design with GIMP/Inkscape
- Video editing with Kdenlive
- **All GPU-accelerated!**

### **Security Research:**
- Network penetration testing
- Web application security
- Password auditing
- OSINT investigations

### **DevOps:**
- Infrastructure automation
- Container orchestration
- Cloud deployment
- Configuration management

---

## Comparison

| Feature | carbon-base | carbon-compute | **carbon-tools** |
|---------|-------------|----------------|------------------|
| Languages | ✅ All | ✅ All | ✅ All |
| Desktop | ✅ Yes | ✅ Yes | ✅ Yes |
| ML/AI | Basic | ✅ Full stack | Basic |
| **Creative Apps** | ❌ | ❌ | **✅ Blender, GIMP, etc.** |
| **Security Tools** | Basic | Basic | **✅ Full toolkit** |
| **DevOps** | Basic | Basic | **✅ K8s, Terraform, Ansible** |
| GPU Support | ✅ krunkit | ✅ krunkit | ✅ krunkit |

---

## File Locations

**SecLists:** `/usr/share/seclists` or `/usr/share/wordlists`
**Work Directory:** `/work` (mount ~/carbon-workspace)
**User Home:** `/home/carbon`

---

## GPU Performance

**Expected speedups with krunkit:**
- Blender rendering: 2-3x faster
- Video encoding: 1.5-2x faster
- General compute: 2-4x faster

---

## Build Time

- **From scratch:** ~20-30 minutes
- **With cache:** ~5-10 minutes
- **Image size:** ~28-30 GB

---

**Last Updated:** 2025-12-24
**Status:** Built and ready with GPU support
**GPU:** Works with krunkit + `--device /dev/dri`
