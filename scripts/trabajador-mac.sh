#!/bin/bash
# Trabajador del Mac en launchd: arranca al iniciar sesión y se reinicia si se cae.
# Su configuración (URL, token y carpetas) está en ~/Library/Application Support/Central/trabajador.env,
# que crea «bun run produccion:variables». Uso: trabajador-mac.sh instalar | quitar | estado
set -euo pipefail
ID="com.iservisat.central.trabajador"
DIR="$(cd "$(dirname "$0")/.." && pwd)"
CONF="$HOME/Library/Application Support/Central/trabajador.env"
PLIST="$HOME/Library/LaunchAgents/$ID.plist"
LOGS="$HOME/Library/Logs/Central"
BUN="$(command -v bun)"

case "${1:-}" in
  instalar)
    [ -f "$CONF" ] || { echo "Falta $CONF: ejecuta antes «bun run produccion:variables»"; exit 1; }
    mkdir -p "$LOGS" "$HOME/Library/LaunchAgents"
    cat >"$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$ID</string>
  <key>ProgramArguments</key>
  <array><string>$BUN</string><string>--env-file=$CONF</string><string>$DIR/scripts/trabajador.ts</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>15</integer>
  <key>StandardOutPath</key><string>$LOGS/trabajador.log</string>
  <key>StandardErrorPath</key><string>$LOGS/trabajador.log</string>
</dict>
</plist>
EOF
    launchctl bootout "gui/$(id -u)/$ID" 2>/dev/null || true
    launchctl bootstrap "gui/$(id -u)" "$PLIST"
    echo "Trabajador instalado. Registro: $LOGS/trabajador.log"
    ;;
  quitar)
    launchctl bootout "gui/$(id -u)/$ID" 2>/dev/null || true
    rm -f "$PLIST"
    echo "Trabajador quitado"
    ;;
  estado)
    if launchctl print "gui/$(id -u)/$ID" >/dev/null 2>&1; then echo "Instalado · últimas líneas:"; tail -5 "$LOGS/trabajador.log" 2>/dev/null; else echo "Sin instalar"; fi
    ;;
  *) echo "Uso: $0 instalar | quitar | estado"; exit 1 ;;
esac
