# Carbon Port Mappings - Avoiding Conflicts

## 🔌 Standard Port Mappings

All Carbon images use these **host ports** to avoid conflicts with common services:

| Service | Container Port | Host Port | Why Different? |
|---------|---------------|-----------|----------------|
| **xRDP** | 3389 | **3390** | Avoids Windows RDP (3389) |
| **VNC** | 5901 | **5900** | Standard VNC port |
| **noVNC** | 6900 | **6900** | No conflict |
| **PostgreSQL** | 5432 | **5432** | Standard (changeable) |
| **MongoDB** | 27017 | **27017** | Standard (changeable) |
| **Redis** | 6379 | **6379** | Standard (changeable) |

## 🚨 Common Conflicts & Solutions

### Conflict 1: Windows RDP (Port 3389)
**Problem**: Windows uses 3389 for its own Remote Desktop
**Solution**: ✅ We use port **3390** on host → 3389 in container

**Connect with:**
```
Host: localhost:3390
User: carbon
Pass: Carbon123#
```

### Conflict 2: PostgreSQL Already Running
**Problem**: You have PostgreSQL running on host port 5432
**Solution**: Use alternate port mapping

**Option A - Stop host PostgreSQL:**
```bash
sudo systemctl stop postgresql
./start-carbon-gpu.sh
```

**Option B - Use different port (5433):**
Edit start script to use:
```bash
-p 0.0.0.0:5433:5432 \
```
Then connect to: `localhost:5433`

### Conflict 3: MongoDB Already Running
**Problem**: MongoDB running on host port 27017
**Solution**: Use alternate port

Edit start script:
```bash
-p 0.0.0.0:27018:27017 \
```
Then connect to: `localhost:27018`

### Conflict 4: Multiple Carbon Containers
**Problem**: Want to run multiple Carbon containers simultaneously
**Solution**: Use different host ports for each

**Example - Run both base and compute:**

```bash
# Container 1: carbon-gpu on standard ports
docker run -d --name carbon-gpu \
  -p 3390:3389 \
  -p 6900:6900 \
  -p 5900:5901 \
  wisejnrs/carbon-base:latest-gpu

# Container 2: carbon-compute on alternate ports
docker run -d --name carbon-compute \
  -p 3391:3389 \  # RDP on 3391
  -p 6901:6900 \  # noVNC on 6901
  -p 5901:5901 \  # VNC on 5901
  -p 8888:8888 \  # Jupyter
  -p 9999:9999 \  # code-server
  wisejnrs/carbon-compute:latest

# Access:
# Container 1 RDP: localhost:3390
# Container 2 RDP: localhost:3391
# Container 1 noVNC: http://localhost:6900
# Container 2 noVNC: http://localhost:6901
```

## 📊 Complete Port Reference

### carbon-base (All Variants)
```
3390 → 3389   # xRDP (Remote Desktop Protocol)
5900 → 5901   # VNC (TigerVNC)
6900 → 6900   # noVNC (Web Access)
5432 → 5432   # PostgreSQL
6379 → 6379   # Redis
27017 → 27017 # MongoDB
11434 → 11434 # Ollama API (GPU only)
```

### carbon-compute (Additional Ports)
```
8888 → 8888   # Jupyter Lab
9999 → 9999   # code-server (VS Code in browser)
7077 → 7077   # Spark Master
8080 → 8080   # Spark Master UI
8081 → 8081   # Spark Worker UI
```

### carbon-tools (Additional Ports)
```
8080 → 8080   # General development server
3000 → 3000   # Node.js/development
```

## 🛠️ Customizing Ports

### Method 1: Edit Start Scripts
Modify the start scripts directly:

```bash
nano start-carbon-gpu.sh

# Change line:
-p 0.0.0.0:3390:3389 \
# To:
-p 0.0.0.0:YOUR_PORT:3389 \
```

### Method 2: Manual Docker Run
Skip the start scripts and run Docker directly:

```bash
docker run -d \
  --name my-carbon \
  -p 13389:3389 \    # RDP on port 13389
  -p 16900:6900 \    # noVNC on port 16900
  -p 15900:5901 \    # VNC on port 15900
  wisejnrs/carbon-base:latest-gpu
```

### Method 3: Environment Variable (Advanced)
Create wrapper scripts with custom ports:

```bash
#!/bin/bash
# my-custom-carbon.sh

RDP_PORT=${RDP_PORT:-3390}
NOVNC_PORT=${NOVNC_PORT:-6900}
VNC_PORT=${VNC_PORT:-5900}

docker run -d \
  --name carbon-custom \
  -p ${RDP_PORT}:3389 \
  -p ${NOVNC_PORT}:6900 \
  -p ${VNC_PORT}:5901 \
  wisejnrs/carbon-base:latest-gpu
```

Then use:
```bash
RDP_PORT=13389 NOVNC_PORT=16900 ./my-custom-carbon.sh
```

## 🔍 Checking Port Conflicts

### Before Starting Container

**Check if port is in use:**
```bash
# Linux/Mac
sudo lsof -i :3390
sudo netstat -tulpn | grep :3390

# Windows PowerShell
netstat -ano | findstr :3390
```

**Check all Carbon ports at once:**
```bash
# Linux/Mac
for port in 3390 5900 6900 5432 6379 27017; do
  echo -n "Port $port: "
  sudo lsof -i :$port > /dev/null 2>&1 && echo "IN USE" || echo "FREE"
done
```

### While Container is Running

**List all ports for a container:**
```bash
docker port carbon-gpu
```

**Check what's listening on host:**
```bash
# Linux/Mac
sudo ss -tulpn | grep -E ":(3390|5900|6900)"

# Windows PowerShell
netstat -ano | findstr "3390 5900 6900"
```

## 🌐 Accessing from Remote Machines

If connecting from another computer on your network:

```bash
# Get your server's IP
hostname -I  # Linux
ipconfig     # Windows

# Then use that IP instead of localhost:
RDP:    <SERVER_IP>:3390
noVNC:  http://<SERVER_IP>:6900
VNC:    <SERVER_IP>:5900
```

**Security Note**: Only expose ports on private networks. For internet access, use VPN or SSH tunneling.

## 🔒 Firewall Configuration

If you need to allow Carbon ports through firewall:

### Ubuntu/Debian (ufw)
```bash
sudo ufw allow 3390/tcp comment "Carbon xRDP"
sudo ufw allow 6900/tcp comment "Carbon noVNC"
sudo ufw allow 5900/tcp comment "Carbon VNC"
```

### RHEL/CentOS (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=3390/tcp
sudo firewall-cmd --permanent --add-port=6900/tcp
sudo firewall-cmd --permanent --add-port=5900/tcp
sudo firewall-cmd --reload
```

### Windows Firewall
```powershell
New-NetFirewallRule -DisplayName "Carbon xRDP" -Direction Inbound -Protocol TCP -LocalPort 3390 -Action Allow
New-NetFirewallRule -DisplayName "Carbon noVNC" -Direction Inbound -Protocol TCP -LocalPort 6900 -Action Allow
New-NetFirewallRule -DisplayName "Carbon VNC" -Direction Inbound -Protocol TCP -LocalPort 5900 -Action Allow
```

## 📝 Quick Reference

**Connect via RDP:**
```
localhost:3390  (or SERVER_IP:3390)
```

**Connect via noVNC (web browser):**
```
http://localhost:6900  (or http://SERVER_IP:6900)
```

**Connect via VNC client:**
```
localhost:5900  (or SERVER_IP:5900)
```

**Access Jupyter (compute only):**
```
http://localhost:8888
```

**Access code-server (compute only):**
```
http://localhost:9999
```

---

**Remember**: Port **3390** (not 3389) for RDP to avoid Windows conflicts! 🎯
