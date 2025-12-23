#!/usr/bin/env bash
set -euo pipefail

# Service Configuration Script
# Controls which services are enabled/disabled based on environment variables

echo "Configuring services based on environment variables..."

# ============================================
# HELPER FUNCTIONS
# ============================================

disable_service() {
    local service=$1
    local conf_file="/etc/supervisor/conf.d/${service}.conf"

    if [ -f "$conf_file" ]; then
        mv "$conf_file" "${conf_file}.disabled" 2>/dev/null || true
        echo "  ✗ Disabled: $service"
    fi
}

enable_service() {
    local service=$1
    local conf_file="/etc/supervisor/conf.d/${service}.conf"
    local disabled_file="${conf_file}.disabled"

    if [ -f "$disabled_file" ]; then
        mv "$disabled_file" "$conf_file" 2>/dev/null || true
        echo "  ✓ Enabled: $service"
    elif [ -f "$conf_file" ]; then
        echo "  ✓ Already enabled: $service"
    fi
}

# ============================================
# DATABASES - DEFAULT: OFF (save resources)
# ============================================

# PostgreSQL - default OFF
if [ "${ENABLE_POSTGRESQL:-false}" = "true" ]; then
    enable_service "postgres"
else
    disable_service "postgres"
fi

# MySQL - default OFF
if [ "${ENABLE_MYSQL:-false}" = "true" ]; then
    enable_service "mysql"
else
    disable_service "mysql"
fi

# MongoDB - default OFF
if [ "${ENABLE_MONGODB:-false}" = "true" ]; then
    enable_service "mongodb"
else
    disable_service "mongodb"
fi

# Redis - default OFF
if [ "${ENABLE_REDIS:-false}" = "true" ]; then
    enable_service "redis"
else
    disable_service "redis"
fi

# Mosquitto MQTT - default OFF
if [ "${ENABLE_MOSQUITTO:-false}" = "true" ]; then
    enable_service "mosquitto"
else
    disable_service "mosquitto"
fi

# ============================================
# AI/ML SERVICES - DEFAULT: OFF
# ============================================

# Ollama (GPU only) - default OFF
if [ "${ENABLE_OLLAMA:-false}" = "true" ]; then
    enable_service "ollama"
else
    disable_service "ollama"
fi

# ============================================
# VECTOR DATABASES - DEFAULT: OFF
# ============================================

# Qdrant Vector Database - default OFF
if [ "${ENABLE_QDRANT:-false}" = "true" ]; then
    enable_service "qdrant"
else
    disable_service "qdrant"
fi

# ============================================
# SSH SERVER - DEFAULT: ON
# ============================================

# SSH server - default ON
if [ "${ENABLE_SSH:-true}" = "false" ]; then
    disable_service "sshd"
else
    enable_service "sshd"
fi

# ============================================
# VLLM (GPU only)
# ============================================

if [ "${ENABLE_VLLM:-false}" = "true" ]; then
    enable_service "vllm"
else
    disable_service "vllm"
fi

# ============================================
# JUPYTER (compute image only)
# ============================================

if [ "${ENABLE_JUPYTER:-true}" = "false" ]; then
    disable_service "jupyter"
else
    enable_service "jupyter"
fi

# ============================================
# CODE-SERVER (compute image only)
# ============================================

if [ "${ENABLE_CODE_SERVER:-true}" = "false" ]; then
    disable_service "code-server"
else
    enable_service "code-server"
fi

# ============================================
# SPARK (compute image only)
# ============================================

if [ "${ENABLE_SPARK:-true}" = "false" ]; then
    disable_service "spark-master"
    disable_service "spark-worker"
else
    enable_service "spark-master"
    enable_service "spark-worker"
fi

# ============================================
# VNC
# ============================================

if [ "${ENABLE_VNC:-true}" = "false" ]; then
    disable_service "vnc"
else
    enable_service "vnc"
fi

# ============================================
# XRDP
# ============================================

if [ "${ENABLE_XRDP:-true}" = "false" ]; then
    disable_service "xrdp"
    disable_service "xrdp-sesman"
else
    enable_service "xrdp"
    enable_service "xrdp-sesman"
fi

echo "Service configuration complete"
