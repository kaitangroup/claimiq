#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# ClaimIQ — DigitalOcean Droplet Setup Script
# Run ONCE on a fresh Ubuntu 22.04 / 24.04 droplet as root.
#
# Usage:
#   chmod +x scripts/setup-droplet.sh
#   sudo bash scripts/setup-droplet.sh yourdomain.com your@email.com
#
# What it does:
#   1. Installs Node 20, nginx, certbot
#   2. Creates the /var/www/claimiq app directory + systemd service
#   3. Configures nginx reverse proxy with HTTPS (Let's Encrypt)
#   4. Opens firewall ports 22, 80, 443
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

DOMAIN="${1:-}"
EMAIL="${2:-}"

if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
  echo "Usage: sudo bash setup-droplet.sh <domain> <ssl-email>"
  echo "Example: sudo bash setup-droplet.sh claimiq.com admin@example.com"
  exit 1
fi

APP_DIR="/var/www/claimiq"
APP_USER="claimiq"
NODE_VERSION="20"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ClaimIQ Droplet Setup"
echo "  Domain : $DOMAIN"
echo "  Email  : $EMAIL"
echo "  App dir: $APP_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# ── 1. System update ──────────────────────────────────────────────────────────
apt-get update -qq && apt-get upgrade -y -qq

# ── 2. Install Node.js 20 via NodeSource ──────────────────────────────────────
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
  apt-get install -y nodejs
fi
node -v && npm -v

# ── 3. Install nginx, certbot, ufw ───────────────────────────────────────────
apt-get install -y nginx certbot python3-certbot-nginx ufw

# ── 4. Firewall ───────────────────────────────────────────────────────────────
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# ── 5. Create app user + directories ─────────────────────────────────────────
id -u "$APP_USER" &>/dev/null || useradd -m -s /bin/bash "$APP_USER"
mkdir -p "$APP_DIR"/{uploads,logs}
chown -R "$APP_USER":"$APP_USER" "$APP_DIR"

# ── 6. nginx site config ──────────────────────────────────────────────────────
cat > /etc/nginx/sites-available/claimiq << NGINX
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;
    root $APP_DIR/dist/public;
    index index.html;

    # Larger body size for file uploads (20 MB)
    client_max_body_size 25M;

    # Serve API through the Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 120s;
    }

    # SPA fallback — all non-API, non-asset routes serve index.html
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Static assets — long-term cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
NGINX

ln -sf /etc/nginx/sites-available/claimiq /etc/nginx/sites-enabled/claimiq
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# ── 7. SSL via Let's Encrypt ──────────────────────────────────────────────────
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
  --email "$EMAIL" --redirect || echo "⚠️  Certbot failed — run manually after DNS propagates"

# ── 8. systemd service ────────────────────────────────────────────────────────
cat > /etc/systemd/system/claimiq.service << SYSTEMD
[Unit]
Description=ClaimIQ Avoidance Action Finance
After=network.target

[Service]
Type=simple
User=$APP_USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=on-failure
RestartSec=10
StandardOutput=append:$APP_DIR/logs/app.log
StandardError=append:$APP_DIR/logs/error.log

# Hardening
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=full

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable claimiq

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅ Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Copy your built app to $APP_DIR:"
echo "     rsync -avz --exclude node_modules . $APP_USER@$DOMAIN:$APP_DIR/"
echo ""
echo "  2. Create .env from .env.example:"
echo "     cp $APP_DIR/.env.example $APP_DIR/.env"
echo "     nano $APP_DIR/.env   # fill in real values"
echo ""
echo "  3. Install deps and start:"
echo "     cd $APP_DIR && npm ci --omit=dev"
echo "     systemctl start claimiq"
echo "     systemctl status claimiq"
echo ""
echo "  4. Seed the first admin account:"
echo "     node $APP_DIR/scripts/seed-admin.js"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
