#!/usr/bin/env bash
set -euo pipefail

# ---------- Config (override via env if you like) ----------
THEME_NAME="${THEME_NAME:-Mint-Relaxed}"
ICON_NAME="${ICON_NAME:-Mint-Relaxed-Icons}"

THEME_REPO="${THEME_REPO:-https://github.com/DrMcC0y/Mint-Relaxed}"
ICON_REPO="${ICON_REPO:-https://github.com/DrMcC0y/Mint-Relaxed-Icons}"

THEME_DIR="${THEME_DIR:-/usr/share/themes/${THEME_NAME}}"
ICON_DIR="${ICON_DIR:-/usr/share/icons/${ICON_NAME}}"
SCHEMA_DIR="${SCHEMA_DIR:-/usr/share/glib-2.0/schemas}"

# If set, apply the theme immediately for this user via gsettings (DBus session).
# Example: APPLY_TO_USER=carbon ./install-mint-relaxed.sh
APPLY_TO_USER="${APPLY_TO_USER:-}"

# ---------- Helpers ----------
need_cmd() { command -v "$1" >/dev/null 2>&1; }
die() { echo "ERROR: $*" >&2; exit 1; }

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    die "This script must run as root (to write into /usr/share and compile schemas)."
  fi
}

git_update_or_clone() {
  local repo="$1" dest="$2"
  if [[ -d "$dest/.git" ]]; then
    echo "[git] Updating $(basename "$dest") in $dest"
    git -C "$dest" fetch --depth=1 origin || true
    git -C "$dest" reset --hard FETCH_HEAD || true
  elif [[ -d "$dest" ]]; then
    echo "[git] Directory exists without .git ($dest). Leaving as-is."
  else
    echo "[git] Cloning $repo -> $dest"
    git clone --depth 1 "$repo" "$dest"
  fi
}

# ---------- Pre-flight ----------
require_root

if ! need_cmd git; then
  die "git not found. Install it first (apt-get install -y git)."
fi
if ! need_cmd glib-compile-schemas; then
  die "glib-compile-schemas not found. Install glib2.0-bin (apt-get install -y glib2.0-bin)."
fi
if ! need_cmd gtk-update-icon-cache; then
  echo "WARN: gtk-update-icon-cache not found. Install libgtk-3-bin to refresh icon cache." >&2
fi

# ---------- Install / Update themes ----------
git_update_or_clone "$THEME_REPO" "$THEME_DIR"
git_update_or_clone "$ICON_REPO"  "$ICON_DIR"

# Ensure readable perms
chmod -R a+rX "$THEME_DIR" "$ICON_DIR" || true

# Refresh icon cache (non-fatal if utility is unavailable)
if need_cmd gtk-update-icon-cache; then
  echo "[icons] Updating icon cache for $ICON_DIR"
  gtk-update-icon-cache -f "$ICON_DIR" || true
fi

# ---------- System-wide defaults via schema override ----------
echo "[schemas] Writing override to ${SCHEMA_DIR}/99-mint-relaxed.gschema.override"
cat >"${SCHEMA_DIR}/99-mint-relaxed.gschema.override" <<EOF
[org.cinnamon.desktop.interface]
gtk-theme='${THEME_NAME}'
icon-theme='${ICON_NAME}'
cursor-theme='Adwaita'

[org.cinnamon.theme]
name='${THEME_NAME}'

[org.cinnamon.desktop.wm.preferences]
theme='${THEME_NAME}'

# Also set GNOME interface defaults for good measure
[org.gnome.desktop.interface]
gtk-theme='${THEME_NAME}'
icon-theme='${ICON_NAME}'
cursor-theme='Adwaita'
EOF

echo "[schemas] Compiling GSettings schemas in ${SCHEMA_DIR}"
glib-compile-schemas "$SCHEMA_DIR"

# ---------- Optional: apply immediately for a user ----------
if [[ -n "$APPLY_TO_USER" ]]; then
  if ! id "$APPLY_TO_USER" >/dev/null 2>&1; then
    echo "WARN: User '$APPLY_TO_USER' does not exist; skipping per-user apply." >&2
  elif ! need_cmd dbus-run-session; then
    echo "WARN: dbus-run-session not found; install dbus-x11 to apply without a live session." >&2
  else
    echo "[apply] Applying theme for user '$APPLY_TO_USER'"
    su - "$APPLY_TO_USER" -c "dbus-run-session gsettings set org.cinnamon.desktop.interface gtk-theme '${THEME_NAME}'" || true
    su - "$APPLY_TO_USER" -c "dbus-run-session gsettings set org.cinnamon.desktop.interface icon-theme '${ICON_NAME}'" || true
    su - "$APPLY_TO_USER" -c "dbus-run-session gsettings set org.cinnamon.theme name '${THEME_NAME}'" || true
    su - "$APPLY_TO_USER" -c "dbus-run-session gsettings set org.cinnamon.desktop.wm.preferences theme '${THEME_NAME}'" || true
  fi
fi

echo "[install-mint-relaxed] Theme installed, schemas compiled."