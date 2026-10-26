#!/bin/bash
# infobar: cierra a Internet un puerto que publica docker (docker se salta ufw).
# Se ejecuta COMO ROOT en el servidor. Idempotente. Leelo antes.
#
#   sudo bash cerrar-puerto-docker.sh 3000
#
# Pone una regla en la cadena DOCKER-USER (la que docker reserva para esto y no toca) que descarta
# las conexiones NUEVAS que llegan desde la interfaz publica a ese puerto. Lo que va por dentro
# (p. ej. el proxy de Easypanel/Dokploy hacia su panel por la red de docker) no pasa por ahi y sigue
# funcionando. Se deja fija con un servicio systemd para que sobreviva a los reinicios.
# Deshacer:  sudo systemctl disable --now infobar-cerrar-puerto-3000
set -euo pipefail
P="${1:-}"
[[ "$P" =~ ^[0-9]{1,5}$ ]] || { echo "uso: $0 <puerto>"; exit 1; }
P=$((10#$P))                               # 080 -> 80: que no se cuele por la lista de abajo
[ "$P" -gt 0 ] && [ "$P" -lt 65536 ] || { echo "puerto fuera de rango"; exit 1; }
[ "$(id -u)" = 0 ] || { echo "hay que ejecutarlo como root (sudo)"; exit 1; }
for p in 22 80 443; do [ "$P" != "$p" ] || { echo "el $P no se cierra con esto (lo necesitas)"; exit 1; }; done
IF="$(ip -o -4 route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="dev") print $(i+1)}' || true)"
[ -n "$IF" ] || { echo "no encuentro la interfaz publica"; exit 1; }
iptables -L DOCKER-USER -n >/dev/null 2>&1 || { echo "no hay cadena DOCKER-USER (¿docker no esta en marcha?)"; exit 1; }

REGLA="DOCKER-USER -i $IF -p tcp -m conntrack --ctorigdstport $P --ctdir ORIGINAL -j DROP"
SERVICIO="infobar-cerrar-puerto-$P"
cat > "/etc/systemd/system/$SERVICIO.service" <<EOF
[Unit]
Description=infobar: cierra el puerto $P a Internet (regla en DOCKER-USER)
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/bin/sh -c 'iptables -w 10 -C $REGLA 2>/dev/null || iptables -w 10 -I $REGLA; if ip6tables -w 10 -L DOCKER-USER -n >/dev/null 2>&1; then ip6tables -w 10 -C $REGLA 2>/dev/null || ip6tables -w 10 -I $REGLA; fi'
ExecStop=/bin/sh -c 'iptables -w 10 -D $REGLA 2>/dev/null; ip6tables -w 10 -D $REGLA 2>/dev/null; true'

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable "$SERVICIO.service"
systemctl start "$SERVICIO.service"         # oneshot idempotente: si ya estaba, no quita la regla
echo ""
echo "Listo: el $P ya no se alcanza desde Internet por $IF. Reglas activas:"
iptables -S DOCKER-USER | grep -- "--ctorigdstport $P" || true
echo "Deshacer: sudo systemctl disable --now $SERVICIO"
