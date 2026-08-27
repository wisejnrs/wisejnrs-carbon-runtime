#!/usr/bin/env bash
set -Eeuo pipefail

# Pick a Chromium binary (override with CHROMIUM_BIN=/path/to/chromium)
CHROMIUM_BIN="${CHROMIUM_BIN:-}"
if [[ -z "${CHROMIUM_BIN}" ]]; then
  for c in /usr/bin/chromium-browser /usr/bin/chromium /usr/bin/google-chrome /usr/bin/google-chrome-stable; do
    [[ -x "$c" ]] && CHROMIUM_BIN="$c" && break
  done
fi
if [[ -z "${CHROMIUM_BIN}" ]]; then
  echo "chromium-vnc: Chromium/Chrome not found." >&2
  exit 127
fi

# Default flags tuned for VNC/Xvnc
ARGS=(
  --disable-dev-shm-usage
  --ozone-platform=x11
  --password-store=basic
  --user-data-dir="${XDG_CONFIG_HOME:-$HOME/.config}/chromium-vnc"
)

# Sandbox: default OFF inside containers; set CHROMIUM_USE_SANDBOX=1 to keep it
if [[ "${CHROMIUM_USE_SANDBOX:-0}" != "1" ]]; then
  ARGS+=(--no-sandbox)
fi

exec "$CHROMIUM_BIN" "${ARGS[@]}" "$@"