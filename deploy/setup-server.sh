#!/usr/bin/env bash
# One-time server setup for portals.onyxmueller.net (Ubuntu + Apache).
# Safe to run again: every step checks before it changes anything.
#
#   sudo bash setup-server.sh "<deploy public key>" [deploy-user]
#
# What it does:
#   1. Makes /var/www/portals.onyxmueller.net/ and lets the GitHub deploy key
#      rsync into that one folder only (rrsync), like the other sites.
#   2. Runs the relay (node server.js) as a service on 127.0.0.1:3070.
#   3. Restarts the relay whenever a deploy rewrites the REVISION file.
#   4. Adds an Apache site that passes web + WebSocket traffic to the relay.
#   5. Gets an HTTPS certificate with certbot (only if DNS already points here).
set -euo pipefail

DOMAIN=portals.onyxmueller.net
APP_DIR=/var/www/$DOMAIN
PORT=3070
PUBKEY=${1:-}
DEPLOY_USER=${2:-${SUDO_USER:-}}

[ "$(id -u)" = 0 ] || { echo "Run with sudo."; exit 1; }
[ -n "$PUBKEY" ] || { echo "Usage: sudo bash $0 \"<deploy public key>\" [deploy-user]"; exit 1; }
[ -n "$DEPLOY_USER" ] && id "$DEPLOY_USER" >/dev/null || { echo "Unknown deploy user '$DEPLOY_USER'."; exit 1; }
if ss -ltn "sport = :$PORT" | grep -q LISTEN && ! systemctl is-active -q portals.service; then
  echo "Port $PORT is already used by something else. Change PORT at the top of this script."; exit 1
fi

echo "== Node"
if ! command -v node >/dev/null; then
  echo "Node not found, installing Ubuntu's nodejs package"
  apt-get update -qq && apt-get install -y nodejs
fi
NODE=$(command -v node)
echo "$NODE $($NODE --version)"

echo "== App folder + deploy key"
mkdir -p "$APP_DIR"
chown "$DEPLOY_USER": "$APP_DIR"
RRSYNC=$(command -v rrsync || true)
[ -n "$RRSYNC" ] || RRSYNC=/usr/share/doc/rsync/scripts/rrsync
[ -e "$RRSYNC" ] || { echo "rrsync not found (apt-get install rsync)."; exit 1; }
HOME_DIR=$(getent passwd "$DEPLOY_USER" | cut -d: -f6)
AUTH=$HOME_DIR/.ssh/authorized_keys
install -d -m 700 -o "$DEPLOY_USER" -g "$(id -gn "$DEPLOY_USER")" "$HOME_DIR/.ssh"
KEY_BODY=$(echo "$PUBKEY" | awk '{print $2}')
if grep -qF "$KEY_BODY" "$AUTH" 2>/dev/null; then
  echo "Deploy key already in $AUTH"
else
  echo "command=\"$RRSYNC $APP_DIR/\",restrict $PUBKEY" >> "$AUTH"
  chown "$DEPLOY_USER": "$AUTH"; chmod 600 "$AUTH"
  echo "Added deploy key to $AUTH (locked to $APP_DIR/)"
fi

echo "== Relay service"
cat > /etc/systemd/system/portals.service <<EOF
[Unit]
Description=Portals game relay ($DOMAIN)
After=network.target
# Nothing to run until the first deploy has copied the files in.
ConditionPathExists=$APP_DIR/server.js

[Service]
WorkingDirectory=$APP_DIR
ExecStart=$NODE server.js
Environment=PORT=$PORT HOST=127.0.0.1 NODE_ENV=production
# Runs as a throwaway user that can read the app folder and write nothing.
DynamicUser=yes
Restart=always
RestartSec=2

[Install]
WantedBy=multi-user.target
EOF

# The deploy key can only rsync, so a deploy can't restart the relay directly.
# This watches the REVISION file the deploy writes last and restarts on change.
cat > /etc/systemd/system/portals-deploy.path <<EOF
[Unit]
Description=Restart Portals relay after a deploy

[Path]
PathChanged=$APP_DIR/REVISION
Unit=portals-deploy.service

[Install]
WantedBy=multi-user.target
EOF
cat > /etc/systemd/system/portals-deploy.service <<EOF
[Unit]
Description=Restart Portals relay

[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl restart portals.service
EOF
systemctl daemon-reload
systemctl enable -q portals.service
systemctl enable -q --now portals-deploy.path
systemctl restart portals.service || true

echo "== Apache site"
a2enmod -q proxy proxy_http >/dev/null
SITE=/etc/apache2/sites-available/$DOMAIN.conf
if [ -e "$SITE" ]; then
  echo "$SITE already exists, leaving it alone"
else
  cat > "$SITE" <<EOF
<VirtualHost *:80>
    ServerName $DOMAIN

    # Everything, including the game's WebSocket, goes to the relay.
    ProxyPreserveHost On
    ProxyPass /.well-known/acme-challenge/ !
    ProxyPass / http://127.0.0.1:$PORT/ upgrade=websocket
    ProxyPassReverse / http://127.0.0.1:$PORT/

    ErrorLog \${APACHE_LOG_DIR}/$DOMAIN-error.log
    CustomLog \${APACHE_LOG_DIR}/$DOMAIN-access.log combined
</VirtualHost>
EOF
fi
a2ensite -q "$DOMAIN" >/dev/null
apache2ctl configtest
systemctl reload apache2

echo "== HTTPS"
if [ -e "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "Certificate already exists"
elif ! command -v certbot >/dev/null; then
  echo "certbot not found. Get a certificate for $DOMAIN the way you did for the other sites."
elif [ -z "$(getent ahosts "$DOMAIN" || true)" ]; then
  echo "DNS for $DOMAIN doesn't resolve yet. Once it does, run:"
  echo "  sudo certbot --apache -d $DOMAIN --redirect"
else
  certbot --apache -d "$DOMAIN" --redirect -n || {
    echo "certbot failed. Once DNS points here, run: sudo certbot --apache -d $DOMAIN --redirect"; }
fi

echo
echo "Done. Next: run the 'deploy' workflow on GitHub, then open https://$DOMAIN"
echo "Relay status: systemctl status portals   Logs: journalctl -u portals -f"
