#!/usr/bin/env bash
set -Eeuo pipefail

# ---- Env/Path ----
export PATH="$PATH:$HOME/.dotnet/tools"
export LANG="en_US.UTF-8"
export LC_ALL="en_US.UTF-8"
export DISPLAY="${DISPLAY:-:1}"          # vncserver display
export FONTCONFIG_PATH="/etc/fonts"

# ---- One-time user hook (non-blocking, optional) ----
if [ -f "${HOME}/work/.entrypoint.sh" ]; then
  echo "[entrypoint] Running ${HOME}/work/.entrypoint.sh ..."
  bash "${HOME}/work/.entrypoint.sh" || true
fi

# ---- Supervisor logs dir ----
mkdir -p /var/log/supervisor

# ---- Configure services based on environment variables ----
if [ -x /usr/local/bin/configure-services.sh ]; then
  /usr/local/bin/configure-services.sh || true
fi

# ---- Ensure user authentication is configured ----
if [ -x /usr/local/bin/ensure-user-auth.sh ]; then
  /usr/local/bin/ensure-user-auth.sh || true
fi

# ---- Hand over PID 1 to tini → supervisord ----
exec /bin/tini -- supervisord -n -c /etc/supervisor/supervisord.conf