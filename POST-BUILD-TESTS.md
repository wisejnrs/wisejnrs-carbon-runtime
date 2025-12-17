# Post-Build Test Plan

After clean rebuild completes, run these tests to verify everything works.

---

## ✅ Test Checklist

### 1. Start Container with Custom Password
```bash
ENABLE_POSTGRESQL=true \
ENABLE_MYSQL=true \
ENABLE_REDIS=true \
ENABLE_QDRANT=true \
./start-carbon-configurable.sh --password MySecurePass123
```

**Expected**: Container starts with custom password

---

### 2. Test Desktop Access (Orchidea Theme)

**Via noVNC (Browser):**
```
http://localhost:6900
```

**What to verify:**
- [ ] Orchidea dark theme with transparency
- [ ] Top panel visible (32px height)
- [ ] Chrome icon in panel (left side)
- [ ] VS Code icon in panel (left side)
- [ ] Firefox icon in panel
- [ ] Terminal icon in panel
- [ ] System tray icons (right side)
- [ ] macOS Big Sur wallpaper
- [ ] Window controls on RIGHT (minimize, maximize, close)
- [ ] Click Chrome - should launch
- [ ] Click VS Code - should launch
- [ ] Window decorations look professional

---

### 3. Test RDP Access

**Connect:**
```
Host: localhost:3390
User: carbon
Pass: MySecurePass123
```

**What to verify:**
- [ ] Login screen shows "carbon-base - [container-id]"
- [ ] Password MySecurePass123 works (not default)
- [ ] Orchidea theme matches screenshot
- [ ] Same desktop as noVNC
- [ ] VS Code launches from panel
- [ ] Chrome launches from panel

---

### 4. Test SSH Access (mybash)

**Connect:**
```bash
ssh -p 2222 carbon@localhost
# Password: MySecurePass123
```

**What to verify:**
- [ ] Fastfetch system info displays
- [ ] Starship prompt appears (colorful)
- [ ] `z` command works (zoxide)
- [ ] Custom password works
- [ ] SSH host keys generated

**Test mybash:**
```bash
# Test zoxide
cd /tmp
cd /var/log
z tmp  # Should jump back to /tmp

# Test starship
pwd  # See colorful prompt

# Test fastfetch
fastfetch
```

---

### 5. Test Cloud CLIs

```bash
docker exec carbon-base aws --version
docker exec carbon-base az --version
docker exec carbon-base gh --version
docker exec carbon-base node -e "console.log('Claude Code:', require('@anthropic-ai/claude-code/package.json').version)"
```

**Expected:**
- [ ] AWS CLI v2.32+
- [ ] Azure CLI v2.81+
- [ ] GitHub CLI v2.83+
- [ ] Claude Code package exists

---

### 6. Test Databases

**PostgreSQL + pgvector + PostGIS:**
```bash
docker exec carbon-base psql -U postgres -c "
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS postgis;
SELECT extname, extversion FROM pg_extension WHERE extname IN ('vector', 'postgis');
"
```

**Expected:**
- [ ] pgvector v0.5.0
- [ ] PostGIS v3.2.0

**MySQL:**
```bash
docker exec carbon-base mysql -u root -e "SELECT VERSION();"
```

**Expected:**
- [ ] MySQL 8.0+

**Redis:**
```bash
docker exec carbon-base redis-cli PING
```

**Expected:**
- [ ] PONG

**Qdrant:**
```bash
curl http://localhost:6333/health
curl http://localhost:6333/collections
```

**Expected:**
- [ ] {"status":"ok"}
- [ ] Collections list (empty initially)

**Open Qdrant Dashboard:**
```
http://localhost:6333/dashboard
```

---

### 7. Test Service Toggles

**Restart with minimal services:**
```bash
docker stop carbon-base && docker rm carbon-base

# Start with NO databases
./start-carbon-configurable.sh --password TestPass
```

**Verify:**
```bash
docker exec carbon-base supervisorctl status | grep -E "postgres|mysql|redis|qdrant"
```

**Expected:**
- [ ] No database services running (all disabled)

---

### 8. Test VS Code Launch

**From Desktop (noVNC/RDP):**
1. Click VS Code icon in panel
2. VS Code should open
3. File > Open Folder
4. Navigate to /work
5. Create test file

**From Terminal:**
```bash
docker exec -u carbon carbon-base bash -c 'DISPLAY=:1 /usr/local/bin/code-container --version'
```

**Expected:**
- [ ] VS Code v1.107.0+
- [ ] No sandbox errors
- [ ] Launches successfully

---

### 9. Test Chrome Launch

**From Desktop:**
1. Click Chrome icon in panel
2. Chrome should open
3. Navigate to http://localhost:6333/dashboard (Qdrant)
4. Should load successfully

---

### 10. Automated Test Suite

```bash
./test-all-features.sh carbon-base
```

**Expected:**
- [ ] 25+ tests passed
- [ ] All CLIs verified
- [ ] All services verified
- [ ] All databases verified
- [ ] < 5 failures (minor issues only)

---

## 🎯 Success Criteria

### Must Pass (Critical)
- ✅ Orchidea theme visible and matches screenshot
- ✅ Custom password works (MySecurePass123)
- ✅ VS Code launches from panel
- ✅ Chrome launches from panel
- ✅ Window controls on RIGHT
- ✅ PostgreSQL + pgvector + PostGIS working
- ✅ SSH access working
- ✅ mybash (Starship prompt) working

### Should Pass (Important)
- ✅ All 4 access methods working (SSH, noVNC, xRDP, VNC)
- ✅ Qdrant vector database working
- ✅ MySQL and Redis working
- ✅ AWS, Azure, GitHub CLIs working
- ✅ Service toggles working
- ✅ Top panel has all favorite apps

### Nice to Have
- ✅ No errors in test suite
- ✅ Fast startup (< 45 seconds)
- ✅ Low memory usage (< 3GB with all services)
- ✅ Clean theme (no warnings)

---

## 📋 After Testing

If all tests pass:

```bash
# Tag as tested
docker tag wisejnrs/carbon-base:latest-minimal wisejnrs/carbon-base:tested

# Build other images
./build-all.sh --all

# Deploy
./start-carbon-configurable.sh
```

---

## 🐛 If Issues Found

### VS Code Won't Launch
```bash
# Check wrapper
docker exec carbon-base cat /usr/local/bin/code-container

# Test manually
docker exec -u carbon carbon-base /usr/local/bin/code-container --version
```

### Theme Not Applied
```bash
# Check theme files
docker exec carbon-base ls -la /usr/share/themes/Orchidea/

# Reapply
docker exec -u carbon carbon-base bash -c '
  export DISPLAY=:1
  dbus-launch gsettings set org.cinnamon.theme name "Orchidea"
  cinnamon --replace &
'
```

### Password Not Working
```bash
# Check env var
docker exec carbon-base env | grep CARBON_PASSWORD

# Reset
docker exec carbon-base bash -c 'echo "carbon:NewPassword" | chpasswd'
```

---

**Run these tests after build completes!** ✓
