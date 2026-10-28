#!/bin/bash
# Tareas programadas de Central en este Mac (launchd):
#   cada hora, escaneo (con git fetch de los activos) y consulta a los proveedores de repositorios;
#   cada 10 minutos, comprobación de webs;
#   cada minuto, lectura de los servidores a los que les toca (5 min, o 1 min en incidencia);
#   cada día, auditoría de dependencias de los proyectos en producción (osv-scanner).
# Uso: scripts/tareas-mac.sh instalar | quitar | estado
set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
BUN="$(command -v bun || echo "$HOME/.bun/bin/bun")"
AGENTS="$HOME/Library/LaunchAgents"
LOGS="$HOME/Library/Logs/Central"
TAREAS=("com.iservisat.central.scan|tarea:horaria|3600" "com.iservisat.central.uptime|uptime|600" "com.iservisat.central.servidores|servidores|60" "com.iservisat.central.auditoria|auditoria|86400")

plist() { # id script intervalo
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$1</string>
  <key>ProgramArguments</key>
  <array><string>$BUN</string><string>run</string><string>$2</string></array>
  <key>WorkingDirectory</key><string>$DIR</string>
  <key>StartInterval</key><integer>$3</integer>
  <key>RunAtLoad</key><false/>
  <key>ProcessType</key><string>Standard</string>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$(dirname "$BUN"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
  <key>StandardOutPath</key><string>$LOGS/${1##*.}.log</string>
  <key>StandardErrorPath</key><string>$LOGS/${1##*.}.log</string>
</dict>
</plist>
EOF
}

case "${1:-estado}" in
  instalar)
    mkdir -p "$AGENTS" "$LOGS"
    for t in "${TAREAS[@]}"; do
      IFS='|' read -r id script cada <<<"$t"
      launchctl bootout "gui/$(id -u)/$id" 2>/dev/null || true
      plist "$id" "$script" "$cada" >"$AGENTS/$id.plist"
      launchctl bootstrap "gui/$(id -u)" "$AGENTS/$id.plist"
      echo "Instalada $id (bun run $script cada $cada s)"
    done
    ;;
  quitar)
    for t in "${TAREAS[@]}"; do
      IFS='|' read -r id _ _ <<<"$t"
      launchctl bootout "gui/$(id -u)/$id" 2>/dev/null || true
      rm -f "$AGENTS/$id.plist"
      echo "Quitada $id"
    done
    ;;
  estado)
    for t in "${TAREAS[@]}"; do
      IFS='|' read -r id script _ <<<"$t"
      if launchctl print "gui/$(id -u)/$id" >/dev/null 2>&1; then echo "$id: instalada · registro $LOGS/${id##*.}.log"; else echo "$id: sin instalar"; fi
    done
    ;;
  *) echo "Uso: $0 instalar | quitar | estado"; exit 1 ;;
esac
