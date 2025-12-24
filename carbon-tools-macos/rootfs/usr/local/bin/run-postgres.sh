#!/usr/bin/env bash
set -euo pipefail

# Detect PG major (e.g. 14, 15) from Debian/Ubuntu packaging layout
PGVER="$(ls /etc/postgresql | head -n1)"
CONF_DIR="/etc/postgresql/${PGVER}/main"
DATA_DIR="/data/postgres"
RUN_DIR="/var/run/postgresql"

# Ensure runtime dir
mkdir -p "${RUN_DIR}"
chown -R postgres:postgres "${RUN_DIR}"
chmod 2775 "${RUN_DIR}"

# Ensure data directory exists with correct permissions
# NOTE: /data is mounted volume, may need sudo to create subdirs
if [ ! -d "${DATA_DIR}" ]; then
  echo "Creating PostgreSQL data directory at ${DATA_DIR}..."
  sudo mkdir -p "${DATA_DIR}"
  sudo chown postgres:postgres "${DATA_DIR}"
  sudo chmod 700 "${DATA_DIR}"
fi

# Initialize data directory if empty
if [ ! -f "${DATA_DIR}/PG_VERSION" ]; then
  echo "Initializing PostgreSQL data directory at ${DATA_DIR}..."
  su - postgres -c "/usr/lib/postgresql/${PGVER}/bin/initdb -D '${DATA_DIR}' --auth-local=peer --auth-host=scram-sha-256"
  # Copy config files from default location to data dir
  cp "${CONF_DIR}/postgresql.conf" "${DATA_DIR}/" || true
  cp "${CONF_DIR}/pg_hba.conf" "${DATA_DIR}/" || true
  cp "${CONF_DIR}/pg_ident.conf" "${DATA_DIR}/" || true
  # Create conf.d directory (referenced in postgresql.conf include_dir)
  mkdir -p "${DATA_DIR}/conf.d"
  chown postgres:postgres "${DATA_DIR}/conf.d"
  chmod 700 "${DATA_DIR}/conf.d"
fi

# Harden/enable network access
# Listen on all interfaces
if grep -qE '^[#]*\s*listen_addresses' "${DATA_DIR}/postgresql.conf"; then
  sed -i "s/^[#]*\s*listen_addresses.*/listen_addresses = '*'/" "${DATA_DIR}/postgresql.conf"
else
  echo "listen_addresses = '*'" >> "${DATA_DIR}/postgresql.conf"
fi

# Use SCRAM for password auth where possible
if ! grep -q 'password_encryption' "${DATA_DIR}/postgresql.conf"; then
  echo "password_encryption = scram-sha-256" >> "${DATA_DIR}/postgresql.conf"
fi

# pg_hba: allow password auth from anywhere (adjust CIDRs in production)
add_hba() {
  local line="$1"
  grep -qxF "$line" "${DATA_DIR}/pg_hba.conf" || echo "$line" >> "${DATA_DIR}/pg_hba.conf"
}
add_hba "host    all             all             0.0.0.0/0               scram-sha-256"
add_hba "host    all             all             ::0/0                    scram-sha-256"

# Foreground postgres directly
exec su - postgres -c "/usr/lib/postgresql/${PGVER}/bin/postgres -D '${DATA_DIR}' -c config_file='${DATA_DIR}/postgresql.conf'"