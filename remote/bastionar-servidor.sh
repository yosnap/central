#!/bin/bash
# infobar: protección básica de un servidor de una sola vez. Se ejecuta COMO ROOT. Idempotente. Leelo antes.
#
#   Desde el Mac (pide la contraseña de root una vez; CLAVES son las públicas que podrán entrar como root):
#   COPYFILE_DISABLE=1 tar c -C remote bastionar-servidor.sh cerrar-puerto-docker.sh | ssh root@IP \
#     "CLAVES='$(cat ~/.ssh/id_ed25519.pub ~/.ssh/central_admin_ed25519.pub)' sh -c 'd=\$(mktemp -d) && tar x -C \$d && bash \$d/bastionar-servidor.sh 6001 6002 8000; rm -rf \$d'"
#
# Hace, por este orden (lo primero, que no te quedes fuera):
#   1. añade CLAVES a /root/.ssh/authorized_keys; si root no tiene ninguna clave, se para aquí
#   2. sshd: sin contraseñas ni login interactivo, root solo con clave, sin X11
#   3. fail2ban con el jail sshd
#   4. ufw: entra 22/80/443 y todo lo que viene de las redes de docker; lo demás, fuera
#   5. sudo sin contraseña de cloud-init: el fichero se aparta a /root/sudoers-retirados/ (no se borra)
#   6. cierra a Internet los puertos que publica docker que se pasen como argumentos (cerrar-puerto-docker.sh)
# Deshacer el paso 2: rm /etc/ssh/sshd_config.d/00-infobar-bastionado.conf && systemctl reload ssh
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "hay que ejecutarlo como root"; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)"
for p in "$@"; do [[ "$p" =~ ^[0-9]{1,5}$ ]] || { echo "puerto no válido: $p"; exit 1; }; done
export DEBIAN_FRONTEND=noninteractive

echo "-> 1. claves de root"
install -d -m 700 /root/.ssh
touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
while IFS= read -r k; do
  [[ "$k" =~ ^(ssh-ed25519|ssh-rsa|ecdsa-sha2-[a-z0-9-]+)\ [A-Za-z0-9+/=]+ ]] || continue
  grep -qF "$(echo "$k" | awk '{print $2}')" /root/.ssh/authorized_keys || { echo "$k" >> /root/.ssh/authorized_keys; echo "   añadida: $(echo "$k" | awk '{print $3}')"; }
done <<< "${CLAVES:-}"
N=$(grep -cE '^(ssh-|ecdsa-)' /root/.ssh/authorized_keys || true)
[ "$N" -gt 0 ] || { echo "root no tiene ninguna clave: no quito las contraseñas (pasa CLAVES)"; exit 1; }
echo "   root tiene $N claves"

echo "-> 2. sshd"
cat > /etc/ssh/sshd_config.d/00-infobar-bastionado.conf <<'EOF'
# infobar: en sshd gana el primer valor, y 00 va antes que 50-cloud-init
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
PermitEmptyPasswords no
X11Forwarding no
EOF
grep -qE '^\s*Include\s+/etc/ssh/sshd_config.d/' /etc/ssh/sshd_config || echo "   ojo: sshd_config no incluye sshd_config.d; revisa a mano"
sshd -t
systemctl reload ssh 2>/dev/null || systemctl reload sshd
sshd -T 2>/dev/null | grep -E '^(passwordauthentication|permitrootlogin|kbdinteractiveauthentication) ' | sed 's/^/   /'

echo "-> 3. fail2ban"
command -v fail2ban-client >/dev/null || { apt-get update -qq; apt-get install -y -qq fail2ban >/dev/null; }
systemctl enable --now fail2ban >/dev/null 2>&1
sleep 2; fail2ban-client status sshd 2>/dev/null | grep -E 'Currently banned|Total banned' | sed 's/^/   /' || echo "   fail2ban activo (jail sshd aún arrancando)"

echo "-> 4. ufw"
command -v ufw >/dev/null || { apt-get update -qq; apt-get install -y -qq ufw >/dev/null; }
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
for p in 22 80 443; do ufw allow "$p/tcp" >/dev/null; done
# los contenedores que hablan con el propio servidor (bases de datos publicadas, el panel por SSH…)
ufw allow from 10.0.0.0/8 >/dev/null
ufw allow from 172.16.0.0/12 >/dev/null
ufw --force enable >/dev/null
ufw status | head -3 | sed 's/^/   /'

echo "-> 5. sudo sin contraseña"
for f in $(grep -lE 'NOPASSWD' /etc/sudoers.d/* 2>/dev/null || true); do
  case "$(basename "$f")" in infobar) continue ;; esac
  install -d -m 700 /root/sudoers-retirados
  echo "   $f:"; grep -vE '^\s*(#|$)' "$f" | sed 's/^/     /'
  mv "$f" /root/sudoers-retirados/
  echo "   apartado en /root/sudoers-retirados/ (para volver: mv de vuelta a /etc/sudoers.d/)"
done
visudo -cq && echo "   sudoers correcto"

echo "-> 6. puertos de docker"
for p in "$@"; do bash "$DIR/cerrar-puerto-docker.sh" "$p" | tail -n +2; done

echo ""
echo "Listo. Prueba desde OTRA terminal, sin cerrar esta: ssh root@<ip> true"
