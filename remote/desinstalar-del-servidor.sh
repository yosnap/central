#!/bin/bash
# infobar: deshace el alta en este servidor. Se ejecuta COMO ROOT (sudo) en el servidor; puedes leerlo antes.
# Quita lo que instalo instalar-en-servidor.sh y nada mas:
#   · /etc/sudoers.d/infobar                (la regla de sudo para recoger-root)
#   · /usr/local/bin/infobar-recoger y /usr/local/lib/infobar   (los dos scripts de lectura)
#   · el usuario "infobar" y su carpeta /home/infobar (con su authorized_keys: la clave deja de valer)
# No toca la configuracion de sshd ni a ningun otro usuario. Idempotente: repetirlo deja lo mismo.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "hay que ejecutarlo como root (sudo)"; exit 1; }

rm -f /etc/sudoers.d/infobar
rm -f /usr/local/bin/infobar-recoger
rm -rf /usr/local/lib/infobar
if id infobar >/dev/null 2>&1; then
  casa="$(getent passwd infobar | cut -d: -f6)"
  userdel infobar 2>/dev/null || true   # si falla, se comprueba al final y se avisa
  # solo se borra la carpeta si es la que creo el alta (nunca una ruta distinta que alguien haya puesto al usuario)
  [ "$casa" = "/home/infobar" ] && rm -rf /home/infobar
fi
if id infobar >/dev/null 2>&1; then
  echo "ATENCION: no se pudo borrar el usuario infobar (userdel fallo). Lo demas si se quito; borra el usuario a mano: sudo userdel infobar"
  exit 1
fi
echo "Listo: el usuario infobar, su clave, sus scripts y su regla de sudo ya no estan en este servidor."
echo "En tu Mac, quita el servidor de Ajustes y, si ya no lo usas, borra la clave con: rm ~/.ssh/infobar_ed25519*"
