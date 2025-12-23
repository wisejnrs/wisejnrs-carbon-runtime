#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="/data/redis"
LOG_DIR="/var/log/redis"

# Ensure data directory exists with correct permissions
if [ ! -d "${DATA_DIR}" ]; then
  echo "Creating Redis data directory at ${DATA_DIR}..."
  sudo mkdir -p "${DATA_DIR}"
  sudo chown redis:redis "${DATA_DIR}"
  sudo chmod 755 "${DATA_DIR}"
fi

# Ensure log directory exists
if [ ! -d "${LOG_DIR}" ]; then
  echo "Creating Redis log directory at ${LOG_DIR}..."
  sudo mkdir -p "${LOG_DIR}"
  sudo chown redis:redis "${LOG_DIR}"
  sudo chmod 755 "${LOG_DIR}"
fi

# Start Redis as redis user (--daemonize no keeps it in foreground for supervisor)
exec sudo -u redis /usr/bin/redis-server /etc/redis/redis.conf --protected-mode no --daemonize no
