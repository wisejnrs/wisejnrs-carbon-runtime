#!/usr/bin/env bash
set -Eeuo pipefail

# Force X11 (better with VNC/Xvnc than Wayland)
export MOZ_DISABLE_WAYLAND=1

FIREFOX_BIN="${FIREFOX_BIN:-/usr/bin/firefox}"
if [[ ! -x "$FIREFOX_BIN" ]]; then
  echo "firefox-vnc: firefox not found at $FIREFOX_BIN" >&2
  exit 127
fi

exec "$FIREFOX_BIN" --no-remote --new-instance "$@"