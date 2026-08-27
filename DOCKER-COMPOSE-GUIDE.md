# Docker Compose Profiles Guide

This guide explains how to use Docker Compose profiles to run different Carbon configurations for different use cases.

## 📋 Table of Contents

- [Quick Start](#quick-start)
- [Available Profiles](#available-profiles)
- [Usage Examples](#usage-examples)
- [Helper Scripts](#helper-scripts)
- [Service Details](#service-details)
- [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Using Helper Scripts (Recommended)

```bash
# Interactive menu
./scripts/dc-up.sh

# Direct profile selection
./scripts/dc-up.sh ml          # ML/AI workstation
./scripts/dc-up.sh dev         # Development setup
./scripts/dc-up.sh full        # Everything
```

### Using Docker Compose Directly

```bash
# Start with a specific profile
docker compose --profile ml up -d

# Combine multiple profiles
docker compose --profile ml --profile databases up -d

# View what services would run
docker compose --profile ml config --services
```

---

## 📦 Available Profiles

### `minimal` / `base`
**Basic desktop environment**

**Services**: carbon-base
**Use Case**: Lightweight desktop for general computing

```bash
./scripts/dc-up.sh minimal
# OR
docker compose --profile minimal up -d
```

**Access**:
- noVNC: http://localhost:6900
- xRDP: localhost:3390
- VNC: localhost:5900

**Size**: ~17GB
**RAM**: ~2GB

---

### `ml` / `data-science` / `compute`
**Machine Learning & Data Science Workstation**

**Services**: carbon-compute, postgres-pgvector, qdrant
**Use Case**: ML/AI development, Jupyter notebooks, Spark processing

```bash
./scripts/dc-up.sh ml
# OR
docker compose --profile ml up -d
```

**Includes**:
- Jupyter Lab (http://localhost:8888)
- VS Code (code-server) (http://localhost:9999)
- Apache Spark cluster
- PyTorch 2.4 + CUDA 12.1
- PostgreSQL with pgvector
- Qdrant vector database

**Access**:
- Jupyter Lab: http://localhost:8888
- VS Code: http://localhost:9999
- Spark Master UI: http://localhost:8080
- Qdrant Dashboard: http://localhost:6333/dashboard
- noVNC: http://localhost:6901

**Size**: ~43GB
**RAM**: 8-16GB recommended

---

### `creative`
**Creative Tools & Media Production**

**Services**: carbon-tools
**Use Case**: Blender, GIMP, video editing, graphic design

```bash
./scripts/dc-up.sh creative
# OR
docker compose --profile creative up -d
```

**Includes**:
- Blender 4.5
- GIMP, Krita, Inkscape
- Kdenlive (video editing)
- OBS Studio
- Audacity
- GPU acceleration

**Access**:
- noVNC: http://localhost:6902
- xRDP: localhost:3392

**Size**: ~39GB
**RAM**: 4-8GB recommended

---

### `security`
**Security Research & Penetration Testing**

**Services**: carbon-tools
**Use Case**: Security auditing, network analysis, CTF challenges

```bash
./scripts/dc-up.sh security
# OR
docker compose --profile security up -d
```

**Includes**:
- Wireshark, nmap, masscan
- Burp Suite, sqlmap
- Metasploit Framework
- hashcat (GPU-accelerated)
- John the Ripper
- SecLists wordlists
- Docker CLI access

**Access**:
- noVNC: http://localhost:6902
- SSH: localhost:2223

**Size**: ~39GB
**RAM**: 4-8GB recommended

---

### `dev`
**Full Development Environment**

**Services**: carbon-compute, postgres, mongodb, redis, portainer
**Use Case**: Full-stack development with all databases

```bash
./scripts/dc-up.sh dev
# OR
docker compose --profile dev up -d
```

**Includes**:
- All from `ml` profile
- PostgreSQL 15
- MongoDB 7
- Redis 7
- Portainer (Docker management UI)

**Access**:
- All ML/AI tools
- PostgreSQL: localhost:5432
- MongoDB: localhost:27017
- Redis: localhost:6379
- Portainer: http://localhost:9000

**Size**: ~45GB + databases
**RAM**: 12-16GB recommended

---

### `databases`
**Standalone Databases**

**Services**: postgres, postgres-pgvector, redis, mongodb, qdrant
**Use Case**: External database services for other applications

```bash
docker compose --profile databases up -d
```

**Includes**:
- PostgreSQL 15 (port 5432)
- PostgreSQL with pgvector (port 5433)
- Redis 7 (port 6379)
- MongoDB 7 (port 27017)
- Qdrant (ports 6333, 6334)

---

### `spark-cluster`
**Standalone Spark Cluster**

**Services**: spark-master, spark-worker-1
**Use Case**: Separate Spark cluster for distributed processing

```bash
docker compose --profile spark-cluster up -d
```

**Access**:
- Spark Master UI: http://localhost:8082
- Spark Worker UI: http://localhost:8083

---

### `monitoring`
**Monitoring & Management**

**Services**: portainer
**Use Case**: Docker container management UI

```bash
docker compose --profile monitoring up -d
```

**Access**:
- Portainer: http://localhost:9000

---

### `ai`
**AI/LLM Services**

**Services**: ollama
**Use Case**: Local LLM hosting with Ollama

```bash
docker compose --profile ai up -d
```

**Access**:
- Ollama API: http://localhost:11434

---

### `full`
**Everything**

**Services**: All services
**Use Case**: Complete Carbon suite with all features

```bash
./scripts/dc-up.sh full
# OR
docker compose --profile full up -d
```

**Size**: ~100GB + all data
**RAM**: 16-32GB recommended

---

## 💻 Usage Examples

### ML Development with Databases

```bash
# Combine ML and databases profiles
docker compose --profile ml --profile databases up -d
```

### Creative Work with Monitoring

```bash
# Creative tools + Portainer
docker compose --profile creative --profile monitoring up -d
```

### Full Development Stack

```bash
# Everything except creative/security tools
docker compose --profile dev --profile ai up -d
```

### Minimal + External Databases

```bash
# Base desktop + database services
docker compose --profile minimal --profile databases up -d
```

---

## 🛠️ Helper Scripts

### `dc-up.sh` - Start Services

Interactive launcher with menu or direct profile selection.

```bash
# Interactive menu
./scripts/dc-up.sh

# Direct selection
./scripts/dc-up.sh ml
./scripts/dc-up.sh dev
./scripts/dc-up.sh "ml databases"  # Multiple profiles
```

### `dc-down.sh` - Stop Services

Shutdown all services with optional volume removal.

```bash
# Stop services (keep data)
./scripts/dc-down.sh

# Stop and remove volumes
./scripts/dc-down.sh --volumes
```

### `carbon-status.sh` - View Status

Check running containers, resource usage, and access points.

```bash
./scripts/carbon-status.sh
```

Output includes:
- Running containers
- CPU/Memory usage
- Network ports
- Access URLs

### `dc-logs.sh` - View Logs

View logs from services.

```bash
# View all logs (last 50 lines)
./scripts/dc-logs.sh

# View specific service
./scripts/dc-logs.sh carbon-compute

# Follow logs in real-time
./scripts/dc-logs.sh carbon-compute --follow
```

### `carbon-shell.sh` - Shell Access

Quick shell access to containers.

```bash
# Interactive selection
./scripts/carbon-shell.sh

# Direct access
./scripts/carbon-shell.sh carbon-compute
./scripts/carbon-shell.sh carbon-tools
```

### `carbon-cleanup.sh` - Clean Docker

Remove unused Docker resources.

```bash
# Standard cleanup (dangling images, build cache)
./scripts/carbon-cleanup.sh

# Aggressive cleanup (all unused resources)
./scripts/carbon-cleanup.sh --aggressive
```

---

## 🔧 Service Details

### Port Mappings

| Service | Ports | Purpose |
|---------|-------|---------|
| carbon-base | 3390, 5900, 6900 | xRDP, VNC, noVNC |
| carbon-compute | 3391, 5901, 6901, 8888, 9999, 8080, 8081, 7077, 4040, 2222 | Desktop, Jupyter, Code, Spark, SSH |
| carbon-tools | 3392, 5902, 6902, 3000, 2223 | Desktop, Web dev, SSH |
| postgres | 5432 | PostgreSQL |
| postgres-pgvector | 5433 | PostgreSQL with pgvector |
| mongodb | 27017 | MongoDB |
| redis | 6379 | Redis |
| qdrant | 6333, 6334 | HTTP API, gRPC API |
| ollama | 11434 | Ollama API |
| portainer | 9000, 9443 | Web UI, HTTPS |

### Volume Persistence

All data is persisted in Docker volumes:
- `carbon-*-home` - User home directories
- `*-data` - Database data
- `spark-logs` - Spark logs
- `jupyter-config` - Jupyter configuration
- `ollama-data` - Ollama models

### Default Credentials

- **User**: `carbon`
- **Password**: `Carbon123#` (⚠️ Change in production!)
- **PostgreSQL**: `carbon` / `Carbon123#`
- **MongoDB**: `carbon` / `Carbon123#`
- **Redis**: Password `Carbon123#`

---

## 🐛 Troubleshooting

### Ports Already in Use

If you get port conflicts:

```bash
# Check what's using a port
sudo lsof -i :8888

# Or use alternate ports by modifying docker-compose.yml
```

### Services Not Starting

```bash
# View logs
./scripts/dc-logs.sh [service-name] --follow

# Check status
docker compose ps

# Restart specific service
docker compose restart [service-name]
```

### Out of Memory

```bash
# Check resource usage
./scripts/carbon-status.sh

# Reduce memory limits in docker-compose.yml
# Or use lighter profiles (minimal instead of full)
```

### GPU Not Available

```bash
# Verify GPU support
docker run --rm --gpus all nvidia/cuda:12.1.1-base-ubuntu22.04 nvidia-smi

# Check NVIDIA Container Toolkit
sudo systemctl status docker
nvidia-smi
```

### Clean Start

```bash
# Stop everything
./scripts/dc-down.sh --volumes

# Clean Docker resources
./scripts/carbon-cleanup.sh --aggressive

# Start fresh
./scripts/dc-up.sh [profile]
```

---

## 📚 Additional Resources

- [Main README](README.md) - Project overview
- [Configuration Guide](CONFIGURATION.md) - Environment variables and settings
- [Service Toggles](SERVICE-TOGGLES.md) - Enable/disable services
- [Images Documentation](IMAGES.md) - Detailed image information

---

## 🤝 Contributing

Found an issue or want to add a new profile? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

**Last Updated**: 2025-12-15
