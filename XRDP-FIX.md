# xRDP Login Fix Applied

## What Was Wrong

The xRDP authentication was failing because:
1. PAM configuration for xRDP-sesman was missing
2. User authentication setup wasn't verified at container startup
3. SSL certificates for xRDP weren't being generated

## What's Fixed

### 1. PAM Configuration (carbon-base/rootfs/usr/local/bin/configure-xrdp.sh)
Added proper PAM authentication config:
```bash
cat > /etc/pam.d/xrdp-sesman << 'EOF'
#%PAM-1.0
@include common-auth
@include common-account
@include common-session
@include common-password
session required pam_loginuid.so
session optional pam_systemd.so
EOF
```

### 2. SSL Certificate Generation
xRDP now generates self-signed certificates if they don't exist

### 3. User Authentication Verification (NEW)
Created `ensure-user-auth.sh` that runs at container startup to:
- Re-set the carbon user password
- Add carbon to xrdp and ssl-cert groups
- Unlock the account if locked
- Fix home directory permissions
- Create .Xauthority if missing

### 4. Startup Integration
The authentication check now runs automatically via entrypoint.sh before supervisord starts

## How to Test

### Option 1: Rebuild and Test
```bash
# Rebuild the base image
docker build --build-arg BUILD_GPU=true -t wisejnrs/carbon-base:latest-gpu carbon-base/

# Start container
./start-carbon-gpu.sh

# Wait 30-40 seconds for services to start

# Test RDP connection
# Use your RDP client to connect to:
# Host: localhost:3389
# Username: carbon
# Password: Carbon123#
```

### Option 2: Fix Running Container (Temporary)
If you have a running container and want to test without rebuilding:

```bash
# Enter the container
docker exec -it carbon-gpu bash

# Run the fixes manually
cat > /etc/pam.d/xrdp-sesman << 'EOF'
#%PAM-1.0
@include common-auth
@include common-account
@include common-session
@include common-password
session required pam_loginuid.so
session optional pam_systemd.so
EOF

# Reset password
echo "carbon:Carbon123#" | chpasswd

# Add to groups
usermod -aG xrdp carbon
usermod -aG ssl-cert carbon

# Unlock account
passwd -u carbon

# Restart xRDP services
supervisorctl restart xrdp-sesman
supervisorctl restart xrdp

# Exit container
exit

# Now try RDP connection again
```

## Verify Everything Works

### 1. Check Services are Running
```bash
docker exec carbon-gpu supervisorctl status | grep -E "(xrdp|vnc)"
```

Expected output:
```
vnc                              RUNNING   pid 123, uptime 0:01:00
xrdp                             RUNNING   pid 456, uptime 0:01:00
xrdp-sesman                      RUNNING   pid 789, uptime 0:01:00
```

### 2. Check User Can Authenticate
```bash
docker exec carbon-gpu su - carbon -c "whoami"
```

Expected output: `carbon`

### 3. Check PAM Configuration
```bash
docker exec carbon-gpu cat /etc/pam.d/xrdp-sesman
```

Should show the PAM config from above.

### 4. Check xRDP Logs
```bash
# Check sesman log
docker exec carbon-gpu tail -f /var/log/xrdp-sesman.log

# Check xrdp log
docker exec carbon-gpu tail -f /var/log/xrdp.out.log
```

## Alternative Access Methods

If xRDP still gives you trouble, you have two other options:

### Option 1: noVNC (Web Browser)
```bash
# Open in browser:
http://localhost:6900

# No login needed, connects directly to VNC
```

### Option 2: VNC Client
```bash
# Use any VNC client (TigerVNC, RealVNC, etc.)
# Host: localhost:5900
# Password: Carbon123#
```

## Common Issues

### Issue: "login failed for user carbon"
**Solution**: Password not set correctly. Run:
```bash
docker exec carbon-gpu bash -c "echo 'carbon:Carbon123#' | chpasswd"
docker exec carbon-gpu supervisorctl restart xrdp-sesman xrdp
```

### Issue: "connecting to sesman failed"
**Solution**: xrdp-sesman not running. Run:
```bash
docker exec carbon-gpu supervisorctl status xrdp-sesman
docker exec carbon-gpu supervisorctl start xrdp-sesman
```

### Issue: "SSL certificate error"
**Solution**: Regenerate certificates:
```bash
docker exec carbon-gpu bash -c "cd /etc/xrdp && openssl req -x509 -newkey rsa:2048 -nodes -keyout key.pem -out cert.pem -days 365 -subj '/C=US/ST=State/L=City/O=Organization/CN=localhost'"
docker exec carbon-gpu supervisorctl restart xrdp
```

### Issue: Black screen after login
**Solution**: VNC not running. Check:
```bash
docker exec carbon-gpu supervisorctl status vnc
# If not running:
docker exec carbon-gpu supervisorctl start vnc
```

## Testing Different RDP Clients

### Windows
Use built-in "Remote Desktop Connection" (mstsc.exe)
- Computer: localhost:3389
- Username: carbon
- Password: Carbon123#

### macOS
Download "Microsoft Remote Desktop" from App Store
- Add PC: localhost:3389
- User account: carbon / Carbon123#

### Linux
Use Remmina:
```bash
sudo apt install remmina remmina-plugin-rdp
remmina
```
- Protocol: RDP
- Server: localhost:3389
- Username: carbon
- Password: Carbon123#

Or use xfreerdp:
```bash
xfreerdp /v:localhost:3389 /u:carbon /p:Carbon123# /cert:ignore
```

## Success Indicators

You'll know it's working when:
1. RDP client connects without errors
2. You see a login screen (or go straight to desktop)
3. Cinnamon desktop appears
4. You can move mouse and interact with desktop

## Next Steps

After confirming xRDP works:
1. Rebuild all images: `./build-all.sh --all`
2. Test each image's RDP access
3. Report back any remaining issues

---

**The fixes are in place - you just need to rebuild the image!**
