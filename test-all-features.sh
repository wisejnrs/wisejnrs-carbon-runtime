#!/bin/bash
# Comprehensive test suite for Carbon images
set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

CONTAINER_NAME="${1:-carbon-test}"
TEST_RESULTS=()
FAILED_TESTS=()

log() { echo -e "${BLUE}[TEST]${NC} $*"; }
pass() { echo -e "${GREEN}✓${NC} $*"; TEST_RESULTS+=("PASS: $*"); }
fail() { echo -e "${RED}✗${NC} $*"; FAILED_TESTS+=("FAIL: $*"); }
section() { echo ""; echo -e "${YELLOW}═══${NC} $*"; }

# Check container exists
if ! docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container '$CONTAINER_NAME' not found"
    echo "Usage: $0 <container-name>"
    echo "Example: $0 carbon-base"
    exit 1
fi

# Check container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Container '$CONTAINER_NAME' is not running"
    exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║     🧪 CARBON COMPREHENSIVE TEST SUITE                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "Testing container: $CONTAINER_NAME"
echo ""

# ============================================
section "CLI Tools Tests"
# ============================================

log "Testing AWS CLI..."
if docker exec $CONTAINER_NAME bash -c 'aws --version' &>/dev/null; then
    VERSION=$(docker exec $CONTAINER_NAME aws --version 2>&1 | head -1)
    pass "AWS CLI installed: $VERSION"
else
    fail "AWS CLI not found"
fi

log "Testing Azure CLI..."
if docker exec $CONTAINER_NAME bash -c 'az --version' &>/dev/null; then
    VERSION=$(docker exec $CONTAINER_NAME az version -o tsv 2>&1 | head -1)
    pass "Azure CLI installed: $VERSION"
else
    fail "Azure CLI not found"
fi

log "Testing Claude Code..."
if docker exec $CONTAINER_NAME bash -c 'test -f /usr/local/bin/claude || test -x /usr/local/lib/node_modules/@anthropic-ai/claude-code/bin/claude-code.js' &>/dev/null; then
    pass "Claude Code installed"
else
    fail "Claude Code not found"
fi

log "Testing mybash components..."
if docker exec $CONTAINER_NAME bash -c 'starship --version' &>/dev/null; then
    VERSION=$(docker exec $CONTAINER_NAME starship --version 2>&1 | head -1)
    pass "Starship prompt: $VERSION"
else
    fail "Starship not installed"
fi

if docker exec $CONTAINER_NAME bash -c 'zoxide --version' &>/dev/null; then
    VERSION=$(docker exec $CONTAINER_NAME zoxide --version 2>&1)
    pass "Zoxide: $VERSION"
else
    fail "Zoxide not installed"
fi

if docker exec $CONTAINER_NAME bash -c 'fastfetch --version' &>/dev/null; then
    VERSION=$(docker exec $CONTAINER_NAME fastfetch --version 2>&1 | head -1)
    pass "Fastfetch: $VERSION"
else
    fail "Fastfetch not installed"
fi

# ============================================
section "Supervisor Services Tests"
# ============================================

log "Checking supervisor status..."
if docker exec $CONTAINER_NAME supervisorctl status &>/dev/null; then
    pass "Supervisor is running"

    log "Checking VNC service..."
    if docker exec $CONTAINER_NAME supervisorctl status vnc | grep -q RUNNING; then
        pass "VNC service running"
    else
        fail "VNC service not running"
    fi

    log "Checking xRDP services..."
    if docker exec $CONTAINER_NAME supervisorctl status xrdp-sesman | grep -q RUNNING; then
        pass "xRDP-sesman running"
    else
        fail "xRDP-sesman not running"
    fi

    if docker exec $CONTAINER_NAME supervisorctl status xrdp | grep -q RUNNING; then
        pass "xRDP running"
    else
        fail "xRDP not running"
    fi
else
    fail "Supervisor not accessible"
fi

# ============================================
section "Database Tests (if enabled)"
# ============================================

log "Checking PostgreSQL..."
if docker exec $CONTAINER_NAME supervisorctl status postgres 2>&1 | grep -q RUNNING; then
    pass "PostgreSQL service running"

    log "Testing PostgreSQL connection..."
    if docker exec $CONTAINER_NAME psql -U postgres -c "SELECT version();" &>/dev/null; then
        pass "PostgreSQL connection successful"

        log "Testing pgvector extension..."
        if docker exec $CONTAINER_NAME psql -U postgres -c "SELECT extversion FROM pg_extension WHERE extname='vector';" 2>&1 | grep -q "0.5"; then
            pass "pgvector v0.5.0 available"
        else
            # Try to create extension
            if docker exec $CONTAINER_NAME psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS vector;" &>/dev/null; then
                pass "pgvector extension created"
            else
                fail "pgvector extension not available"
            fi
        fi

        log "Testing PostGIS extension..."
        docker exec $CONTAINER_NAME psql -U postgres -c "CREATE EXTENSION IF NOT EXISTS postgis;" &>/dev/null
        if docker exec $CONTAINER_NAME psql -U postgres -c "SELECT PostGIS_Version();" &>/dev/null; then
            VERSION=$(docker exec $CONTAINER_NAME psql -U postgres -t -c "SELECT PostGIS_Version();" 2>&1 | tr -d ' ')
            pass "PostGIS available: $VERSION"
        else
            fail "PostGIS extension not available"
        fi
    else
        fail "PostgreSQL connection failed"
    fi
else
    log "PostgreSQL not enabled (set ENABLE_POSTGRESQL=true)"
fi

log "Checking MongoDB..."
if docker exec $CONTAINER_NAME supervisorctl status mongodb 2>&1 | grep -q RUNNING; then
    pass "MongoDB service running"

    if docker exec $CONTAINER_NAME mongosh --eval "db.version()" &>/dev/null; then
        VERSION=$(docker exec $CONTAINER_NAME mongosh --quiet --eval "db.version()" 2>&1)
        pass "MongoDB connection successful: $VERSION"
    else
        fail "MongoDB connection failed"
    fi
else
    log "MongoDB not enabled (set ENABLE_MONGODB=true)"
fi

log "Checking Redis..."
if docker exec $CONTAINER_NAME supervisorctl status redis 2>&1 | grep -q RUNNING; then
    pass "Redis service running"

    if docker exec $CONTAINER_NAME redis-cli PING 2>&1 | grep -q PONG; then
        pass "Redis connection successful"
    else
        fail "Redis connection failed"
    fi
else
    log "Redis not enabled (set ENABLE_REDIS=true)"
fi

log "Checking Qdrant..."
if docker exec $CONTAINER_NAME supervisorctl status qdrant 2>&1 | grep -q RUNNING; then
    pass "Qdrant service running"

    if docker exec $CONTAINER_NAME curl -s http://localhost:6333/health 2>&1 | grep -q "ok"; then
        pass "Qdrant API accessible"
    else
        fail "Qdrant API not accessible"
    fi
else
    log "Qdrant not enabled (set ENABLE_QDRANT=true)"
fi

# ============================================
section "Network & Port Tests"
# ============================================

log "Checking port accessibility..."

# VNC
if docker exec $CONTAINER_NAME bash -c 'netstat -tlnp 2>/dev/null | grep :5901' &>/dev/null; then
    pass "VNC listening on port 5901"
else
    fail "VNC not listening on port 5901"
fi

# xRDP
if docker exec $CONTAINER_NAME bash -c 'netstat -tlnp 2>/dev/null | grep :3389' &>/dev/null; then
    pass "xRDP listening on port 3389"
else
    fail "xRDP not listening on port 3389"
fi

# noVNC
if docker exec $CONTAINER_NAME bash -c 'ps aux | grep websockify | grep -v grep' &>/dev/null; then
    pass "noVNC websockify running"
else
    fail "noVNC websockify not running"
fi

# ============================================
section "File System Tests"
# ============================================

log "Checking critical directories..."
for dir in /work /data /home/carbon; do
    if docker exec $CONTAINER_NAME test -d "$dir"; then
        pass "Directory exists: $dir"
    else
        fail "Directory missing: $dir"
    fi
done

log "Checking file permissions..."
if docker exec $CONTAINER_NAME test -w /work; then
    pass "/work is writable"
else
    fail "/work is not writable"
fi

# ============================================
section "User & Authentication Tests"
# ============================================

log "Testing user authentication..."
if docker exec $CONTAINER_NAME su - carbon -c "whoami" 2>&1 | grep -q carbon; then
    pass "User 'carbon' exists and can authenticate"
else
    fail "User authentication failed"
fi

log "Checking PAM configuration for xRDP..."
if docker exec $CONTAINER_NAME test -f /etc/pam.d/xrdp-sesman; then
    pass "xRDP PAM configuration exists"
else
    fail "xRDP PAM configuration missing"
fi

# ============================================
section "Desktop Environment Tests"
# ============================================

log "Checking desktop components..."
if docker exec $CONTAINER_NAME which cinnamon-session &>/dev/null; then
    pass "Cinnamon desktop installed"
else
    fail "Cinnamon desktop not found"
fi

log "Checking themes..."
if docker exec $CONTAINER_NAME test -d /usr/share/themes/Arc-Dark; then
    pass "Arc-Dark theme installed"
else
    fail "Arc-Dark theme not found"
fi

if docker exec $CONTAINER_NAME test -d /usr/share/themes/Nordic; then
    pass "Nordic theme installed"
else
    log "Nordic theme not installed (optional)"
fi

# ============================================
section "Summary"
# ============================================

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  TEST RESULTS"
echo "═══════════════════════════════════════════════════════════"
echo ""

TOTAL_TESTS=$((${#TEST_RESULTS[@]} + ${#FAILED_TESTS[@]}))
PASSED=${#TEST_RESULTS[@]}
FAILED=${#FAILED_TESTS[@]}

echo "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "Failed tests:"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "  ${RED}✗${NC} $test"
    done
    echo ""
fi

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║     ✅ ALL TESTS PASSED!                                 ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
    exit 0
else
    echo -e "${RED}╔══════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║     ❌ SOME TESTS FAILED                                 ║${NC}"
    echo -e "${RED}╚══════════════════════════════════════════════════════════╝${NC}"
    exit 1
fi
