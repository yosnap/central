#!/bin/sh
# Prepara la clave de solo lectura de infobar y los known_hosts a partir de variables de entorno (Dokploy),
# sin dejarlas en la imagen. Luego arranca el proceso del servicio.
set -e
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
if [ -n "$CENTRAL_SSH_KEY_B64" ]; then
  printf '%s' "$CENTRAL_SSH_KEY_B64" | base64 -d > "$HOME/.ssh/infobar_ed25519"
  chmod 600 "$HOME/.ssh/infobar_ed25519"
fi
if [ -n "$CENTRAL_SSH_KNOWN_HOSTS_B64" ]; then
  printf '%s' "$CENTRAL_SSH_KNOWN_HOSTS_B64" | base64 -d > "$HOME/.ssh/known_hosts"
  chmod 644 "$HOME/.ssh/known_hosts"
fi
mkdir -p /app/storage
exec "$@"
