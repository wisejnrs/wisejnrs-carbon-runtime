#!/usr/bin/env bash
set -euo pipefail

echo "Starting MySQL server..."

# MySQL data directory
MYSQL_DATA_DIR="${MYSQL_DATA_DIR:-/data/mysql}"
MYSQL_ROOT_PASSWORD="${MYSQL_ROOT_PASSWORD:-Carbon123#}"

# Create data directory if it doesn't exist
if [ ! -d "$MYSQL_DATA_DIR" ]; then
    echo "Initializing MySQL data directory: $MYSQL_DATA_DIR"
    mkdir -p "$MYSQL_DATA_DIR"
    chown -R mysql:mysql "$MYSQL_DATA_DIR"

    # Initialize MySQL
    mysqld --initialize-insecure --user=mysql --datadir="$MYSQL_DATA_DIR"
fi

# Ensure permissions
chown -R mysql:mysql "$MYSQL_DATA_DIR"

# Configure MySQL to use our data directory
cat > /etc/mysql/mysql.conf.d/carbon.cnf << EOF
[mysqld]
datadir = $MYSQL_DATA_DIR
bind-address = 0.0.0.0
port = 3306

# Performance tuning for Pi/embedded
max_connections = 50
innodb_buffer_pool_size = 256M
innodb_log_file_size = 64M
EOF

# Start MySQL (will be supervised)
echo "MySQL starting with data in: $MYSQL_DATA_DIR"
exec mysqld --user=mysql --datadir="$MYSQL_DATA_DIR"
