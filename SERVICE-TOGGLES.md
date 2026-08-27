# Service Toggle Quick Reference

## 🎯 Default Configuration

**Databases: OFF** (enable only what you need)
**Development Tools: ON** (Jupyter, code-server, Spark)
**Desktop: ON** (VNC, xRDP)

This saves ~2-4GB of RAM by not running unused databases.

---

## ⚡ Quick Examples

### Enable PostgreSQL Only
```bash
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh
```

### Enable All Databases
```bash
ENABLE_POSTGRESQL=true \
ENABLE_MONGODB=true \
ENABLE_REDIS=true \
./start-carbon-configurable.sh
```

### Enable PostgreSQL + Ollama
```bash
ENABLE_POSTGRESQL=true \
ENABLE_OLLAMA=true \
./start-carbon-configurable.sh --image base --variant gpu
```

### Desktop Only (No Development Tools)
```bash
ENABLE_JUPYTER=false \
ENABLE_CODE_SERVER=false \
ENABLE_SPARK=false \
./start-carbon-configurable.sh
```

### Minimal Container (Just Desktop + Filesystem)
```bash
ENABLE_POSTGRESQL=false \
ENABLE_MONGODB=false \
ENABLE_REDIS=false \
ENABLE_JUPYTER=false \
ENABLE_CODE_SERVER=false \
ENABLE_SPARK=false \
ENABLE_OLLAMA=false \
./start-carbon-configurable.sh
```

---

## 📋 All Service Toggles

### Databases (Default: OFF)

| Service | Variable | Default | Memory Impact |
|---------|----------|---------|---------------|
| PostgreSQL | `ENABLE_POSTGRESQL` | `false` | ~200MB |
| MongoDB | `ENABLE_MONGODB` | `false` | ~500MB |
| Redis | `ENABLE_REDIS` | `false` | ~50MB |
| Mosquitto | `ENABLE_MOSQUITTO` | `false` | ~10MB |

### AI/ML Services (Default: OFF)

| Service | Variable | Default | Memory Impact |
|---------|----------|---------|---------------|
| Ollama | `ENABLE_OLLAMA` | `false` | ~1GB+ |
| vLLM | `ENABLE_VLLM` | `false` | ~2GB+ |

### Development Tools (Default: ON)

| Service | Variable | Default | Memory Impact |
|---------|----------|---------|---------------|
| Jupyter Lab | `ENABLE_JUPYTER` | `true` | ~500MB |
| code-server | `ENABLE_CODE_SERVER` | `true` | ~300MB |
| Spark | `ENABLE_SPARK` | `true` | ~1GB |

### Desktop (Default: ON)

| Service | Variable | Default | Memory Impact |
|---------|----------|---------|---------------|
| VNC | `ENABLE_VNC` | `true` | ~200MB |
| xRDP | `ENABLE_XRDP` | `true` | ~50MB |

---

## 💾 Using .env File

Create a `.env` file for persistent configuration:

```bash
# Copy example
cp .env.example .env

# Edit
nano .env
```

**Example .env for Database Development:**
```bash
# Enable only databases
ENABLE_POSTGRESQL=true
ENABLE_MONGODB=true
ENABLE_REDIS=true

# Disable dev tools to save resources
ENABLE_JUPYTER=false
ENABLE_CODE_SERVER=false
ENABLE_SPARK=false
```

**Example .env for ML Work:**
```bash
# Enable AI/ML tools
ENABLE_OLLAMA=true
ENABLE_JUPYTER=true

# Enable PostgreSQL for data storage
ENABLE_POSTGRESQL=true

# Disable other databases
ENABLE_MONGODB=false
ENABLE_REDIS=false
```

---

## 🔍 Checking What's Running

### See Enabled Services
```bash
docker exec carbon-base supervisorctl status
```

### See Disabled Services
```bash
docker exec carbon-base ls /etc/supervisor/conf.d/*.disabled
```

### View Service Configuration
```bash
# Check what's enabled
docker exec carbon-base bash -c 'env | grep ENABLE_'
```

---

## 🎛️ Changing Services After Start

You can't change services after container is started. Instead:

### Option 1: Restart with New Config
```bash
# Stop container
docker stop carbon-base && docker rm carbon-base

# Start with new configuration
ENABLE_POSTGRESQL=true ./start-carbon-configurable.sh
```

### Option 2: Manually Enable/Disable in Running Container
```bash
# Enable PostgreSQL in running container
docker exec carbon-base bash -c '
  mv /etc/supervisor/conf.d/postgres.conf.disabled /etc/supervisor/conf.d/postgres.conf
  supervisorctl reread
  supervisorctl update
  supervisorctl start postgres
'

# Disable MongoDB in running container
docker exec carbon-base bash -c '
  supervisorctl stop mongodb
  mv /etc/supervisor/conf.d/mongodb.conf /etc/supervisor/conf.d/mongodb.conf.disabled
'
```

---

## 💡 Resource Optimization Tips

### Minimal Development (4GB RAM)
```bash
ENABLE_POSTGRESQL=false
ENABLE_MONGODB=false
ENABLE_REDIS=false
ENABLE_SPARK=false
ENABLE_OLLAMA=false
MEMORY_LIMIT=4g
```

### Data Science (16GB RAM)
```bash
ENABLE_JUPYTER=true
ENABLE_POSTGRESQL=true  # For storing results
ENABLE_SPARK=true
ENABLE_OLLAMA=false     # Use external Ollama if needed
MEMORY_LIMIT=16g
```

### Full ML Workstation (32GB+ RAM)
```bash
ENABLE_JUPYTER=true
ENABLE_CODE_SERVER=true
ENABLE_POSTGRESQL=true
ENABLE_MONGODB=true
ENABLE_REDIS=true
ENABLE_OLLAMA=true
ENABLE_SPARK=true
MEMORY_LIMIT=32g
```

---

## 🚨 Common Issues

### "Service failed to start"
- Check if you have enough memory
- Reduce `MEMORY_LIMIT` or disable some services
- Check logs: `docker logs carbon-base`

### "Database connection refused"
- Make sure service is enabled: `ENABLE_POSTGRESQL=true`
- Check it's running: `docker exec carbon-base supervisorctl status postgres`
- Check logs: `docker exec carbon-base tail /var/log/postgres.err.log`

### "Out of memory"
- Disable unnecessary services
- Increase `MEMORY_LIMIT`
- Check usage: `docker stats carbon-base`

---

## 📖 Related Docs

- **[CONFIGURATION.md](CONFIGURATION.md)** - Full configuration guide
- **[.env.example](.env.example)** - Template with all options
- **[QUICK-START.md](QUICK-START.md)** - Getting started guide

---

**Remember**: Only enable what you need - saves memory and startup time! 🚀
