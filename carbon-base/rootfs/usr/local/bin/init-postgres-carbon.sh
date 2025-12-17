#!/usr/bin/env bash
set -euo pipefail

# ------------------------------------------------------------------------------
# Init Postgres with:
#   - database: carbon   (override: CARBON_DB_NAME)
#   - user:     carbon   (override: CARBON_DB_USER)
#   - schema:   carbon   (same as user)
# Password precedence: CARBON_DB_PASSWORD > POSTGRES_PASSWORD > DEFAULT_PASSWORD > Carbon123#
# ------------------------------------------------------------------------------

CARBON_DB_NAME="${CARBON_DB_NAME:-carbon}"
CARBON_DB_USER="${CARBON_DB_USER:-carbon}"
PW="${CARBON_DB_PASSWORD:-${POSTGRES_PASSWORD:-${DEFAULT_PASSWORD:-Carbon123#}}}"

PGHOST_WAIT="${PGHOST_WAIT:-127.0.0.1}"
PGPORT_WAIT="${PGPORT_WAIT:-5432}"
WAIT_SECS="${WAIT_SECS:-60}"

echo "[init-postgres-carbon] waiting for Postgres on ${PGHOST_WAIT}:${PGPORT_WAIT} (up to ${WAIT_SECS}s)..."
for i in $(seq 1 "${WAIT_SECS}"); do
  if pg_isready -h "${PGHOST_WAIT}" -p "${PGPORT_WAIT}" >/dev/null 2>&1; then
    echo "[init-postgres-carbon] Postgres is ready."
    break
  fi
  sleep 1
  if [ "$i" = "${WAIT_SECS}" ]; then
    echo "[init-postgres-carbon] ERROR: Postgres did not become ready in ${WAIT_SECS}s" >&2
    exit 1
  fi
done

# --- Global setup (connect to default 'postgres' DB) ---------------------------
cat >/tmp/carbon_global.sql <<'PSQL'
\set ON_ERROR_STOP on

-- Create role if missing; then always ensure password
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'u', :'pw')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'u');
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'u', :'pw');
\gexec

-- Create database if missing, owned by user; then ensure ownership
SELECT format('CREATE DATABASE %I OWNER %I', :'db', :'u')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db');
\gexec

SELECT format('ALTER DATABASE %I OWNER TO %I', :'db', :'u');
\gexec
PSQL

echo "[init-postgres-carbon] ensuring role '${CARBON_DB_USER}' and database '${CARBON_DB_NAME}'..."
su - postgres -c "psql -v ON_ERROR_STOP=1 -v db='${CARBON_DB_NAME}' -v u='${CARBON_DB_USER}' -v pw='${PW}' -d postgres -f /tmp/carbon_global.sql"
rm -f /tmp/carbon_global.sql

# --- DB-scoped setup (connect to the carbon DB) --------------------------------
cat >/tmp/carbon_db.sql <<'PSQL'
\set ON_ERROR_STOP on

-- Ensure schema (same name as role) exists and is owned by role
SELECT format('CREATE SCHEMA IF NOT EXISTS %I AUTHORIZATION %I', :'u', :'u');
\gexec

-- Default search_path for role and database
SELECT format('ALTER ROLE %I SET search_path TO %I, public', :'u', :'u');
\gexec

SELECT format('ALTER DATABASE %I SET search_path TO %I, public', :'db', :'u');
\gexec

-- Make privileges explicit (redundant if owner, but harmless)
SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'db', :'u');
\gexec
PSQL

echo "[init-postgres-carbon] ensuring schema/search_path/privileges in '${CARBON_DB_NAME}'..."
su - postgres -c "psql -v ON_ERROR_STOP=1 -v db='${CARBON_DB_NAME}' -v u='${CARBON_DB_USER}' -d '${CARBON_DB_NAME}' -f /tmp/carbon_db.sql"
rm -f /tmp/carbon_db.sql

echo "[init-postgres-carbon] done"