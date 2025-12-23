#!/usr/bin/env bash
set -Eeuo pipefail

# ---------- Config ----------
VNC_USER="${VNC_USER:-carbon}"
VNC_DISPLAY="${VNC_DISPLAY:-:1}"
VNC_GEOMETRY="${VNC_GEOMETRY:-1920x1080}"
VNC_DEPTH="${VNC_DEPTH:-24}"
VNC_PASS="${VNC_PASS:-Carbon123\#}"
VNC_LOCALHOST="${VNC_LOCALHOST:-no}"                # yes = bind 127.0.0.1
VNC_SECURITY_TYPES="${VNC_SECURITY_TYPES:-VncAuth}" # no TLS (noVNC friendly)
VNC_PORT="${VNC_PORT:-5901}"
NOVNC_PORT="${NOVNC_PORT:-6080}"
VNC_DESKTOP="${VNC_DESKTOP:-cinnamon}"              # cinnamon | xfce

# Logs: prefer /var/log if writable, else ~/.vnc
if [ -w /var/log ]; then LOG_DIR="/var/log"; else LOG_DIR="/home/${VNC_USER}/.vnc"; fi
mkdir -p "$LOG_DIR"
VNC_LOG="${VNC_LOG:-$LOG_DIR/vncserver.log}"
NOVNC_LOG="${NOVNC_LOG:-$LOG_DIR/novnc.log}"

log(){ printf '[startup] %s\n' "$*"; }
ensure_dir(){ local d="$1" m="${2:-755}" o="${3:-root:root}"; [ -d "$d" ] || sudo mkdir -p "$d"; sudo chmod "$m" "$d"; sudo chown "$o" "$d"; }
need(){ command -v "$1" >/dev/null 2>&1; }

# ---------- Runtime dirs ----------
log "Preparing runtime directories…"
ensure_dir /tmp/.X11-unix 1777
ensure_dir /tmp/.ICE-unix 1777
ensure_dir /run 755
ensure_dir /run/user 755

UIDN="$(id -u "$VNC_USER")"
GIDN="$(id -g "$VNC_USER")"
ensure_dir "/run/user/$UIDN" 700 "$UIDN:$GIDN"

export XDG_RUNTIME_DIR="/run/user/$UIDN"
export DISPLAY="${VNC_DISPLAY}"

# ensure home is owned by the user (covers rootfs overrides)
if ! sudo -u "$VNC_USER" test -w "/home/$VNC_USER"; then
  log "Fixing ownership of /home/$VNC_USER"
  sudo chown -R "$UIDN:$GIDN" "/home/$VNC_USER"
  sudo chmod 755 "/home/$VNC_USER"
fi
sudo install -d -o "$UIDN" -g "$GIDN" -m 700 "/home/$VNC_USER/.vnc"

# ---------- Tools ----------
if ! need vncserver || ! need vncpasswd; then
  log "Installing TigerVNC…"
  sudo apt-get update && sudo apt-get install -y tigervnc-standalone-server tigervnc-tools
fi
if ! need websockify && [ ! -x /usr/share/novnc/utils/launch.sh ]; then
  log "Installing noVNC/websockify…"
  sudo apt-get update && sudo apt-get install -y novnc websockify
fi

# ---------- VNC config ----------
log "Configuring VNC for user '$VNC_USER'…"
if [ ! -f "/home/$VNC_USER/.vnc/passwd" ] || [ "${FORCE_VNC_PASS:-0}" = "1" ]; then
  log "Setting VNC password"
  sudo -u "$VNC_USER" bash -lc "printf '%s' '$VNC_PASS' | vncpasswd -f > ~/.vnc/passwd"
  sudo chmod 600 "/home/$VNC_USER/.vnc/passwd"
fi

# xstartup for Cinnamon or XFCE
log "Writing ~/.vnc/xstartup for ${VNC_DESKTOP}"
sudo -u "$VNC_USER" tee "/home/$VNC_USER/.vnc/xstartup" >/dev/null <<'EOS'
#!/bin/sh
unset SESSION_MANAGER
unset DBUS_SESSION_BUS_ADDRESS
export XDG_RUNTIME_DIR="/run/user/$(id -u)"
export XDG_SESSION_TYPE=x11
# Xresources if present
xrdb -merge "$HOME/.Xresources" 2>/dev/null || true
# __DESKTOP_LAUNCHER__
EOS
sudo chmod +x "/home/$VNC_USER/.vnc/xstartup"

# patch launcher line
case "$VNC_DESKTOP" in
  cinnamon|Cinnamon)
    sudo sed -i 's#__DESKTOP_LAUNCHER__#export XDG_CURRENT_DESKTOP=Cinnamon\nexport DESKTOP_SESSION=cinnamon\nexec dbus-launch --exit-with-session cinnamon-session#' "/home/$VNC_USER/.vnc/xstartup"
    ;;
  xfce|XFCE|xfce4)
    sudo sed -i 's#__DESKTOP_LAUNCHER__#exec dbus-launch --exit-with-session startxfce4#' "/home/$VNC_USER/.vnc/xstartup"
    ;;
  *)
    sudo sed -i 's#__DESKTOP_LAUNCHER__#exec xterm#' "/home/$VNC_USER/.vnc/xstartup"
    ;;
esac

# ---------- Start VNC ----------
log "Starting TigerVNC on ${VNC_DISPLAY} (${VNC_GEOMETRY}, depth ${VNC_DEPTH})…"
sudo -u "$VNC_USER" vncserver -kill "${VNC_DISPLAY}" >/dev/null 2>&1 || true
sudo rm -f "/tmp/.X${VNC_DISPLAY#:}-lock" "/tmp/.X11-unix/X${VNC_DISPLAY#:}" 2>/dev/null || true
sudo -u "$VNC_USER" vncserver "${VNC_DISPLAY}" \
  -geometry "${VNC_GEOMETRY}" \
  -depth "${VNC_DEPTH}" \
  -localhost "${VNC_LOCALHOST}" \
  -SecurityTypes "${VNC_SECURITY_TYPES}" \
  -fg >/dev/null 2>>"${VNC_LOG}" &

# ---------- Start noVNC ----------
log "Starting noVNC on :${NOVNC_PORT} → VNC localhost:${VNC_PORT}…"
if [ -x /usr/share/novnc/utils/launch.sh ]; then
  /usr/share/novnc/utils/launch.sh --vnc "localhost:${VNC_PORT}" --listen "0.0.0.0:${NOVNC_PORT}" \
    >> "${NOVNC_LOG}" 2>&1 &
else
  websockify --web=/usr/share/novnc/ "0.0.0.0:${NOVNC_PORT}" "127.0.0.1:${VNC_PORT}" \
    >> "${NOVNC_LOG}" 2>&1 &
fi

sleep 1
log "-----------------------------------------------------------"
log " Browser:  http://<host>:${NOVNC_PORT}/"
log " Direct VNC: <host>:${VNC_PORT}  (set -e VNC_LOCALHOST=no)"
log " Desktop:   ${VNC_DESKTOP}"
log " Logs:      VNC=${VNC_LOG}  noVNC=${NOVNC_LOG}"
log "-----------------------------------------------------------"

pids=$(jobs -p | tr '\n' ' ')
trap 'log "Shutting down…"; kill $pids 2>/dev/null || true; exit 0' TERM INT
wait -n || true
log "A service exited; tails:"
{ echo "--- ${VNC_LOG} ---"; tail -n 100 "${VNC_LOG}" 2>/dev/null || true; } >&2
{ echo "--- ${NOVNC_LOG} ---"; tail -n 100 "${NOVNC_LOG}" 2>/dev/null || true; } >&2
exit 1