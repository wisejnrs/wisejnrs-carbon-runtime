# Carbon on Raspberry Pi - IoT & Edge Server Guide

Deploy Carbon as a headless IoT server on Raspberry Pi with MySQL, MQTT, Next.js, AI, and SSH access.

---

## 🍓 Use Case: Raspberry Pi IoT Server

**Perfect for:**
- Home automation server
- IoT sensor data collection
- Edge AI with Ollama
- Web dashboard with Next.js
- MQTT broker for devices
- MySQL database for sensor data
- SSH remote management

**No desktop needed** - Headless, lightweight, SSH-accessible

---

## ⚡ Quick Start on Raspberry Pi

### 1. Prerequisites

**Hardware:**
- Raspberry Pi 4 (8GB) or Pi 5 (8GB) recommended
- 64GB+ SD card or SSD
- Network connection
- Optional: External cooling

**Software:**
- Ubuntu Server 22.04 ARM64
- Docker installed

### 2. Install Docker on Pi

```bash
# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker

# Test
docker run hello-world
```

### 3. Deploy Carbon

```bash
# Clone repository
git clone https://github.com/wisejnrs/wisejnrs-carbon-runtime.git
cd wisejnrs-carbon-runtime

# Copy Pi configuration
cp .env.pi-server .env

# Edit configuration
nano .env
# Change password, adjust memory limit for your Pi

# Start Pi server
./start-carbon-pi.sh
```

### 4. Access via SSH

```bash
# From another computer
ssh -p 2222 carbon@<pi-ip-address>

# Password: (what you set in .env)
```

---

## 🔧 Configuration for Raspberry Pi

### Recommended .env Settings

**For Pi 4/5 with 8GB RAM:**
```bash
# Security
CARBON_PASSWORD=YourSecurePassword
SSH_PORT=2222

# Resources
MEMORY_LIMIT=6g
CPU_LIMIT=4

# Services (headless)
ENABLE_VNC=false         # No desktop needed
ENABLE_XRDP=false        # No desktop needed
ENABLE_SSH=true          # Primary access method

# Databases for IoT
ENABLE_MYSQL=true        # Sensor data storage
ENABLE_REDIS=true        # Caching, real-time data
ENABLE_MOSQUITTO=true    # MQTT broker for sensors

# Optional
ENABLE_OLLAMA=true       # AI on edge (if 8GB RAM)
ENABLE_POSTGRESQL=false  # Use MySQL instead
ENABLE_MONGODB=false     # Optional
```

**For Pi 4 with 4GB RAM (Minimal):**
```bash
MEMORY_LIMIT=3g
ENABLE_OLLAMA=false      # Skip AI on 4GB Pi
ENABLE_MYSQL=true
ENABLE_REDIS=true
ENABLE_MOSQUITTO=true
```

---

## 📡 IoT Server Architecture

```
┌─────────────────────────────────────────┐
│         Raspberry Pi Running            │
│         Carbon Container                │
├─────────────────────────────────────────┤
│                                         │
│  🔐 SSH (Port 2222)                    │
│     Remote management & deployment     │
│                                         │
│  📊 MySQL (Port 3306)                  │
│     Store sensor readings              │
│                                         │
│  📡 Mosquitto MQTT (Port 1883)         │
│     Receive data from IoT devices      │
│                                         │
│  ⚡ Redis (Port 6379)                   │
│     Real-time data caching             │
│                                         │
│  🌐 Next.js (Port 3000)                │
│     Web dashboard                      │
│                                         │
│  🤖 Ollama (Port 11434) [Optional]    │
│     AI processing on edge              │
│                                         │
└─────────────────────────────────────────┘
           ↑
           │ WiFi/Ethernet
           ↓
  ┌─────────────────┐
  │ IoT Devices:    │
  │ - Sensors       │
  │ - Actuators     │
  │ - ESP32/ESP8266 │
  │ - Arduino       │
  └─────────────────┘
```

---

## 🚀 Quick Deploy Commands

### Start IoT Server
```bash
./start-carbon-pi.sh
```

### Connect via SSH
```bash
ssh -p 2222 carbon@<pi-ip>
```

### Deploy Next.js App
```bash
# Copy your Next.js app to Pi
scp -P 2222 -r ./my-nextjs-app carbon@<pi-ip>:/work/

# SSH into Pi
ssh -p 2222 carbon@<pi-ip>

# Inside container
cd /work/my-nextjs-app
npm install
npm run build
npm start
```

### Setup MQTT for Sensors
```bash
# SSH into container
ssh -p 2222 carbon@<pi-ip>

# Configure mosquitto
sudo nano /etc/mosquitto/mosquitto.conf

# Add:
# listener 1883
# allow_anonymous true

# Restart
supervisorctl restart mosquitto

# Test from your sensor (ESP32, etc.)
# Connect to: <pi-ip>:1883
```

---

## 📊 Example IoT Workflow

### 1. Sensors Publish to MQTT
```python
# On ESP32/Arduino/Sensor
import paho.mqtt.client as mqtt

client = mqtt.Client()
client.connect("pi-ip-address", 1883)
client.publish("sensors/temperature", "23.5")
client.publish("sensors/humidity", "65")
```

### 2. Python Script Processes Data
```python
# On Pi (in Carbon container)
import paho.mqtt.client as mqtt
import mysql.connector

# Connect to MySQL
db = mysql.connector.connect(
    host="localhost",
    user="carbon",
    password="Carbon123#",
    database="iot_data"
)

# Subscribe to MQTT
def on_message(client, userdata, message):
    topic = message.topic
    value = float(message.payload.decode())

    # Store in MySQL
    cursor = db.cursor()
    cursor.execute(
        "INSERT INTO sensor_readings (sensor, value, timestamp) VALUES (%s, %s, NOW())",
        (topic, value)
    )
    db.commit()

client = mqtt.Client()
client.on_message = on_message
client.connect("localhost", 1883)
client.subscribe("sensors/#")
client.loop_forever()
```

### 3. Next.js Dashboard Displays Data
```javascript
// pages/api/sensors.js
import mysql from 'mysql2/promise'

export default async function handler(req, res) {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'carbon',
    password: 'Carbon123#',
    database: 'iot_data'
  })

  const [rows] = await connection.execute(
    'SELECT * FROM sensor_readings ORDER BY timestamp DESC LIMIT 100'
  )

  res.status(200).json(rows)
}
```

### 4. Ollama AI Analyzes Patterns
```python
# AI analysis of sensor data
import ollama

response = ollama.chat(model='llama3.2:1b', messages=[
  {
    'role': 'user',
    'content': f'Analyze these temperature readings: {readings}'
  }
])
print(response['message']['content'])
```

---

## 🔌 Port Mappings for Pi

| Service | Pi Port | Access |
|---------|---------|--------|
| SSH | 2222 | `ssh -p 2222 carbon@<pi-ip>` |
| MySQL | 3306 | Database clients |
| MQTT | 1883 | IoT devices |
| Redis | 6379 | Cache/sessions |
| Next.js | 3000 | `http://<pi-ip>:3000` |
| Ollama | 11434 | `http://<pi-ip>:11434` |

---

## 💾 Data Persistence on Pi

All data stored in `/data` volume:

```bash
# Use SD card/SSD location
DATA_DIR=/mnt/ssd/carbon-data ./start-carbon-pi.sh

# Directory structure:
/mnt/ssd/carbon-data/
├── mysql/          # MySQL databases
├── redis/          # Redis dumps
└── mosquitto/      # MQTT persistence
```

---

## 🎯 Pi-Specific Optimizations

### Memory Management
```bash
# 8GB Pi - Full features
MEMORY_LIMIT=6g
ENABLE_OLLAMA=true

# 4GB Pi - Minimal
MEMORY_LIMIT=3g
ENABLE_OLLAMA=false
```

### CPU Affinity
```bash
# Reserve CPU 0 for system
docker run --cpuset-cpus="1-3" ...
```

### Storage
```bash
# Use external SSD for better performance
DATA_DIR=/mnt/ssd/carbon ./start-carbon-pi.sh
```

### Ollama Models
```bash
# Use tiny models for Pi
OLLAMA_MODELS="llama3.2:1b"      # 1.3GB
OLLAMA_MODELS="phi3:mini"        # 2.3GB
OLLAMA_MODELS="tinyllama:latest" # 637MB

# Avoid large models
# llama3.2:3b (too big for 8GB Pi with other services)
```

---

## 🔒 Security for Internet-Facing Pi

### SSH Hardening
```bash
# In .env
SSH_PORT=2222           # Non-standard port
PERMIT_ROOT_LOGIN=no    # Block root
PASSWORD_AUTH=yes       # Or use key-based only

# Add your SSH key
docker cp ~/.ssh/id_rsa.pub carbon-pi:/home/carbon/.ssh/authorized_keys
docker exec carbon-pi chown carbon:carbon /home/carbon/.ssh/authorized_keys
docker exec carbon-pi chmod 600 /home/carbon/.ssh/authorized_keys

# Then disable password auth
# Edit sshd_config in container
```

### Firewall Setup
```bash
# On Pi host
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 2222/tcp   # SSH
sudo ufw allow 1883/tcp   # MQTT
sudo ufw allow 3000/tcp   # Next.js
sudo ufw enable
```

### Change Default Passwords
```bash
# In .env
CARBON_PASSWORD=YourStrongPassword123!
MYSQL_ROOT_PASSWORD=YourMySQLPassword123!
MQTT_PASSWORD=YourMQTTPassword123!
```

---

## 📈 Performance Tips

### 1. Use SSD instead of SD Card
```bash
# Mount SSD
sudo mount /dev/sda1 /mnt/ssd

# Use for data
DATA_DIR=/mnt/ssd/carbon ./start-carbon-pi.sh
```

### 2. Overclock Pi (Carefully!)
```bash
# In /boot/config.txt
over_voltage=6
arm_freq=2000
```

### 3. Monitor Resources
```bash
# On Pi host
htop

# Container stats
docker stats carbon-pi

# Temperatures
vcgencmd measure_temp
```

### 4. Optimize MySQL
```bash
# For Pi, use smaller buffers
# Already optimized in run-mysql.sh:
# - innodb_buffer_pool_size=256M
# - max_connections=50
```

---

## 🛠️ Maintenance

### Auto-start on Boot
```bash
# Container has --restart always flag
# Just ensure Docker starts on boot
sudo systemctl enable docker
```

### Backups
```bash
# Automated backup script
#!/bin/bash
docker exec carbon-pi mysqldump -u root -p$MYSQL_ROOT_PASSWORD --all-databases > /backup/mysql-$(date +%Y%m%d).sql
docker exec carbon-pi tar czf /backup/data-$(date +%Y%m%d).tar.gz /data
```

### Updates
```bash
# Pull latest image
docker pull wisejnrs/carbon-base:latest-minimal

# Restart with new image
docker stop carbon-pi && docker rm carbon-pi
./start-carbon-pi.sh
```

### Logs
```bash
# Container logs
docker logs -f carbon-pi

# Specific service
docker exec carbon-pi tail -f /var/log/mysql.out.log
docker exec carbon-pi tail -f /var/log/mosquitto.out.log
```

---

## 🌐 Example: Home Automation Server

### Complete Setup

```bash
# 1. Deploy Carbon on Pi
./start-carbon-pi.sh

# 2. SSH into container
ssh -p 2222 carbon@<pi-ip>

# 3. Create database
mysql -u root -p
CREATE DATABASE home_automation;
USE home_automation;
CREATE TABLE sensor_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sensor_name VARCHAR(50),
  value FLOAT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

# 4. Setup MQTT subscriber
pip install paho-mqtt mysql-connector-python
nano /work/mqtt-to-mysql.py
# (paste Python code from earlier example)

# 5. Run as background service
nohup python /work/mqtt-to-mysql.py &

# 6. Deploy Next.js dashboard
cd /work
npx create-next-app@latest dashboard
cd dashboard
npm run build
npm start &

# 7. Access dashboard
# http://<pi-ip>:3000
```

---

## 🔍 Troubleshooting

### Pi Running Out of Memory
```bash
# Check usage
docker stats carbon-pi

# Reduce memory limit
MEMORY_LIMIT=4g ./start-carbon-pi.sh

# Disable Ollama
ENABLE_OLLAMA=false ./start-carbon-pi.sh
```

### MySQL Won't Start
```bash
# Check logs
docker exec carbon-pi tail -f /var/log/mysql.err.log

# Initialize database
docker exec carbon-pi bash -c "rm -rf /data/mysql && mkdir -p /data/mysql && mysqld --initialize-insecure --user=mysql --datadir=/data/mysql"
docker exec carbon-pi supervisorctl restart mysql
```

### Can't SSH In
```bash
# Check SSH service
docker exec carbon-pi supervisorctl status sshd

# Check port mapping
docker port carbon-pi

# Test from Pi host
ssh -p 2222 carbon@localhost
```

### Ollama Out of Memory
```bash
# Use smallest models only
docker exec carbon-pi ollama pull tinyllama

# Or disable Ollama
ENABLE_OLLAMA=false ./start-carbon-pi.sh
```

---

## 📊 Pi Model Recommendations

### Raspberry Pi 5 (8GB) - Best Choice
**Can run:**
- ✅ MySQL, Redis, Mosquitto
- ✅ Next.js apps
- ✅ Ollama with tiny models (1B parameters)
- ✅ Multiple services

**Config:**
```bash
MEMORY_LIMIT=6g
CPU_LIMIT=4
ENABLE_OLLAMA=true
```

### Raspberry Pi 4 (8GB) - Good
**Can run:**
- ✅ MySQL, Redis, Mosquitto
- ✅ Next.js apps
- ⚠️ Ollama (slow, but works with tiny models)

**Config:**
```bash
MEMORY_LIMIT=6g
CPU_LIMIT=4
ENABLE_OLLAMA=true  # Use tinyllama only
```

### Raspberry Pi 4 (4GB) - Minimal
**Can run:**
- ✅ MySQL, Redis, Mosquitto
- ✅ Lightweight Node apps
- ❌ Ollama (insufficient memory)

**Config:**
```bash
MEMORY_LIMIT=3g
CPU_LIMIT=4
ENABLE_OLLAMA=false
```

---

## 🎯 Use Case Examples

### 1. Weather Station
- Sensors publish to MQTT
- Store in MySQL
- Display with Next.js
- AI forecasting with Ollama

### 2. Smart Home Hub
- Control lights/devices via MQTT
- Schedule automations in MySQL
- Web UI with Next.js
- Voice commands via Ollama

### 3. Garden Monitor
- Soil moisture sensors
- Temperature/humidity
- Automated watering
- Plant health AI analysis

### 4. Security Camera Server
- Motion detection
- Store metadata in MySQL
- Live view with Next.js
- AI object detection

---

## 🔧 Advanced Configuration

### Custom Next.js Port
```bash
# In .env
NEXTJS_PORT=8080
```

### External Access (Internet)
```bash
# Use reverse proxy (Cloudflare Tunnel recommended)
# Or port forwarding on router
# Port forward: 2222 (SSH), 3000 (Next.js), 1883 (MQTT)
```

### Multiple Apps
```bash
# Run multiple Node apps on different ports
# App 1 on 3000
# App 2 on 3001
# etc.
```

### Custom MySQL Configuration
```bash
# Mount custom my.cnf
-v ./my-custom.cnf:/etc/mysql/conf.d/custom.cnf
```

---

## 💡 Pro Tips

### 1. Use tmpfs for Logs
```bash
# Reduce SD card writes
--tmpfs /var/log
```

### 2. Read-Only Root
```bash
# Protect SD card
--read-only
--tmpfs /tmp
--tmpfs /var/tmp
-v data:/data
```

### 3. Health Monitoring
```python
# Create health check script
import requests
import subprocess

# Check services
subprocess.run(["supervisorctl", "status"])

# Check MySQL
mysql_ok = # query test

# Check MQTT
mqtt_ok = # connection test

# Alert if issues
if not all([mysql_ok, mqtt_ok]):
    # Send notification
    pass
```

### 4. Auto-Pull Ollama Model on Start
```bash
# In startup script
docker exec carbon-pi ollama pull llama3.2:1b
```

---

## 📚 References

- **Raspberry Pi**: https://www.raspberrypi.com/documentation/
- **Docker on Pi**: https://docs.docker.com/engine/install/ubuntu/
- **MQTT**: https://mqtt.org/
- **Next.js**: https://nextjs.org/docs
- **Ollama**: https://ollama.ai/
- **MySQL**: https://dev.mysql.com/doc/

---

## 🔄 ARM64 Build Notes

**Current images are x86_64**. For native ARM64:

```bash
# Option 1: Build on Pi (slow)
docker build --build-arg BUILD_GPU=false \
  -t carbon-base:arm64 carbon-base/

# Option 2: Use docker buildx (from x86 machine)
docker buildx create --use
docker buildx build --platform linux/arm64 \
  --build-arg BUILD_GPU=false \
  -t wisejnrs/carbon-base:arm64-minimal \
  carbon-base/

# Option 3: Use x86 emulation (slower)
# Install qemu-user-static on Pi
# Run x86 images (works but slower)
```

---

## ✅ Pi Server Checklist

**Before Deployment:**
- [ ] Pi has static IP or DDNS
- [ ] Docker installed and tested
- [ ] Sufficient storage (64GB+ SD or SSD)
- [ ] Changed all default passwords
- [ ] Configured firewall
- [ ] Tested SSH access
- [ ] Backup strategy in place

**After Deployment:**
- [ ] SSH accessible from network
- [ ] MySQL accepting connections
- [ ] MQTT broker working
- [ ] Next.js app running
- [ ] Monitoring setup
- [ ] Auto-start configured

---

**Carbon makes Raspberry Pi a powerful IoT and edge server!** 🍓🚀
