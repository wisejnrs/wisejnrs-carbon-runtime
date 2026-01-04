#!/usr/bin/env bash
set -euo pipefail

DATA_DIR="/data/mongodb"

# Ensure data directory exists with correct permissions
if [ ! -d "${DATA_DIR}" ]; then
  echo "Creating MongoDB data directory at ${DATA_DIR}..."
  sudo mkdir -p "${DATA_DIR}"
  sudo chown mongodb:mongodb "${DATA_DIR}"
  sudo chmod 755 "${DATA_DIR}"
fi

# Ensure runtime dir
mkdir -p /var/run/mongodb
chown mongodb:mongodb /var/run/mongodb
chmod 755 /var/run/mongodb

# Start MongoDB
exec /usr/bin/mongod --config /etc/mongod.conf
