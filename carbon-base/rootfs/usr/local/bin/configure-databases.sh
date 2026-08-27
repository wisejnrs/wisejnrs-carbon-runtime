#!/bin/bash
set -euo pipefail

# Configure databases to use /data volume for persistent storage
# Note: This runs during Docker build, so systemctl won't work

echo "Configuring databases to use /data volume..."

# Create data directories in /data volume for persistence
install -d -m 0755 /data/postgres /data/mongodb /data/redis

# Configure PostgreSQL to use /data/postgres
echo "Configuring PostgreSQL..."
# Find actual PostgreSQL version installed
PG_VERSION=$(ls -1 /etc/postgresql/ 2>/dev/null | head -1 || echo "")
if [ -n "$PG_VERSION" ] && [ -d "/etc/postgresql/$PG_VERSION/main" ]; then
    echo "Found PostgreSQL version: $PG_VERSION"
    chown -R postgres:postgres /data/postgres || true
    chmod 700 /data/postgres || true
    sed -i "s|#data_directory = 'ConfigDir'|data_directory = '/data/postgres'|g" /etc/postgresql/$PG_VERSION/main/postgresql.conf || true
    sed -i "s|data_directory = '/var/lib/postgresql/$PG_VERSION/main'|data_directory = '/data/postgres'|g" /etc/postgresql/$PG_VERSION/main/postgresql.conf || true
    echo "PostgreSQL configured to use /data/postgres"
else
    echo "PostgreSQL config not found, skipping..."
fi

# Configure MongoDB to use /data/mongodb
echo "Configuring MongoDB..."
if [ -f /etc/mongod.conf ]; then
    chown -R mongodb:mongodb /data/mongodb || true
    sed -i 's|dbPath: /var/lib/mongodb|dbPath: /data/mongodb|g' /etc/mongod.conf || true
    echo "MongoDB configured to use /data/mongodb"
else
    echo "MongoDB config not found, skipping..."
fi

# Configure Redis to use /data/redis
echo "Configuring Redis..."
if [ -f /etc/redis/redis.conf ]; then
    chown -R redis:redis /data/redis || true
    sed -i 's|dir /var/lib/redis|dir /data/redis|g' /etc/redis/redis.conf || true
    echo "Redis configured to use /data/redis"
else
    echo "Redis config not found, skipping..."
fi

echo "Database configuration complete. All databases will store data in /data volume."