#!/bin/bash
# infobar: alta de este servidor. Se ejecuta COMO ROOT en el servidor (lo lanza alta-servidor.sh
# desde el Mac con sudo; puedes leerlo antes). Idempotente: repetirlo deja lo mismo.
#
# Crea el usuario de solo lectura "infobar" y le permite UNA cosa:
#   · su clave SSH solo puede ejecutar /usr/local/bin/infobar-recoger (restrict + command=: sin
#     shell, sin tuneles, sin reenvio de agente, sin terminal);
#   · sudo solo para /usr/local/lib/infobar/recoger-root, sin argumentos (docker y fail2ban).
# No toca la configuracion de sshd ni la de nadie mas.
#
# Uso: instalar-en-servidor.sh "<clave publica ssh-ed25519 ...>"   (desde la carpeta con los scripts)
set -euo pipefail
umask 022
AQUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAVE="${1:-}"

[ "$(id -u)" = 0 ] || { echo "hay que ejecutarlo como root (sudo)"; exit 1; }
[[ "$CLAVE" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]{60,80}(\ [A-Za-z0-9@._-]{1,60})?$ ]] || {
  echo "clave publica no valida (se espera una ssh-ed25519)"; exit 1; }
for f in recoger.sh recoger-root.sh; do [ -f "$AQUI/$f" ] || { echo "falta $f junto a este script"; exit 1; }; done

echo "-> usuario infobar (sin contrasena)"
if ! id infobar >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /home/infobar --shell /bin/sh infobar
fi
usermod -p '*' infobar               # sin contrasena (no "bloqueado": con UsePAM no, eso impediria la clave)
# su hogar es de root: infobar no puede cambiar su .ssh ni su restriccion
chown root:root /home/infobar && chmod 0755 /home/infobar
# leer el journal de sshd (intentos de acceso) sin ser root
getent group systemd-journal >/dev/null && usermod -a -G systemd-journal infobar
getent group adm >/dev/null && usermod -a -G adm infobar

echo "-> scripts de lectura"
install -o root -g root -m 0755 "$AQUI/recoger.sh" /usr/local/bin/infobar-recoger
install -d -o root -g root -m 0755 /usr/local/lib/infobar
install -o root -g root -m 0755 "$AQUI/recoger-root.sh" /usr/local/lib/infobar/recoger-root

echo "-> sudo solo para recoger-root"
TMP_SUDO="$(mktemp)"
echo "infobar ALL=(root) NOPASSWD: /usr/local/lib/infobar/recoger-root \"\"" > "$TMP_SUDO"
visudo -cqf "$TMP_SUDO"
install -o root -g root -m 0440 "$TMP_SUDO" /etc/sudoers.d/infobar
rm -f "$TMP_SUDO"

echo "-> clave SSH limitada al script"
# .ssh y authorized_keys son de root: el usuario infobar no puede cambiar su propia restriccion
install -d -o root -g root -m 0755 /home/infobar/.ssh
# se ANADE la clave (otro Mac puede tener la suya); repetir con la misma no la duplica
LINEA="restrict,command=\"/usr/local/bin/infobar-recoger\" $CLAVE"
touch /home/infobar/.ssh/authorized_keys
grep -qxF "$LINEA" /home/infobar/.ssh/authorized_keys || echo "$LINEA" >> /home/infobar/.ssh/authorized_keys
chown root:root /home/infobar/.ssh/authorized_keys
chmod 0644 /home/infobar/.ssh/authorized_keys

# Avisos (no se cambian solos): reglas de sshd que impedirian entrar a infobar
if sshd -T 2>/dev/null | grep -qiE '^(allowusers|allowgroups) '; then
  echo ""
  echo "AVISO: sshd tiene AllowUsers/AllowGroups. Anade 'infobar' ahi o la conexion se rechazara:"
  sshd -T 2>/dev/null | grep -iE '^(allowusers|allowgroups) '
fi
echo ""
echo "Listo. Prueba desde el Mac: ssh -i ~/.ssh/infobar_ed25519 -o IdentitiesOnly=yes infobar@<este servidor>"
