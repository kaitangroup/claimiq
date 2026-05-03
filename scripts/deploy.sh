#!/usr/bin/env bash
# =============================================================================
# ClaimIQ — Deploy Script (rsync to DigitalOcean Droplet)
# Usage: ./scripts/deploy.sh [user@host] [domain]
# Example: ./scripts/deploy.sh root@192.168.1.1 claimiq.yourdomain.com
# =============================================================================

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
REMOTE_USER_HOST="${1:-}"
DOMAIN="${2:-}"
APP_DIR="/var/www/claimiq"
SERVICE_NAME="claimiq"
LOCAL_PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
success() { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ─── Validate args ────────────────────────────────────────────────────────────
if [[ -z "$REMOTE_USER_HOST" ]]; then
  error "Missing argument: user@host"
  echo ""
  echo "Usage: $0 <user@host> [domain]"
  echo "  user@host  — SSH target (e.g. root@192.168.1.1 or deploy@claimiq.com)"
  echo "  domain     — (optional) used only for informational output"
  exit 1
fi

# ─── Pre-flight checks ────────────────────────────────────────────────────────
info "Running pre-flight checks..."

if ! command -v rsync &>/dev/null; then
  error "rsync is not installed. Install it and try again."
  exit 1
fi

if ! command -v ssh &>/dev/null; then
  error "ssh is not installed."
  exit 1
fi

# Verify we can reach the server
info "Testing SSH connection to $REMOTE_USER_HOST..."
if ! ssh -o ConnectTimeout=10 -o BatchMode=yes "$REMOTE_USER_HOST" "echo ok" &>/dev/null; then
  error "Cannot connect to $REMOTE_USER_HOST via SSH."
  echo "  Make sure your SSH key is added and the server is reachable."
  exit 1
fi
success "SSH connection OK"

# ─── Build ────────────────────────────────────────────────────────────────────
info "Building project locally..."
cd "$LOCAL_PROJECT_DIR"

# Install deps
npm ci --silent

# TypeScript check
info "Running TypeScript check..."
npm run check

# Production build
info "Building production bundle..."
npm run build

success "Build complete"

# ─── Rsync ────────────────────────────────────────────────────────────────────
info "Syncing files to $REMOTE_USER_HOST:$APP_DIR ..."

# Files to sync — everything except dev artifacts and secrets
rsync -avz --delete \
  --exclude='.git' \
  --exclude='.env' \
  --exclude='node_modules' \
  --exclude='uploads' \
  --exclude='claimiq.db' \
  --exclude='*.db-shm' \
  --exclude='*.db-wal' \
  --exclude='.DS_Store' \
  --exclude='*.log' \
  "$LOCAL_PROJECT_DIR/" \
  "$REMOTE_USER_HOST:$APP_DIR/"

success "Files synced"

# ─── Remote: install prod deps + restart ─────────────────────────────────────
info "Installing production dependencies on server..."

ssh "$REMOTE_USER_HOST" bash <<REMOTE_SCRIPT
  set -euo pipefail

  cd "$APP_DIR"

  # Install only production dependencies
  npm ci --omit=dev --silent

  # Ensure uploads directory exists with correct permissions
  mkdir -p uploads
  chown -R claimiq:claimiq uploads 2>/dev/null || true

  # Reload systemd and restart service
  systemctl daemon-reload
  systemctl restart "$SERVICE_NAME"

  # Wait for service to come up
  sleep 3
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    echo "Service '$SERVICE_NAME' is running."
  else
    echo "ERROR: Service '$SERVICE_NAME' failed to start!"
    journalctl -u "$SERVICE_NAME" --no-pager -n 30
    exit 1
  fi
REMOTE_SCRIPT

success "Deployment complete!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [[ -n "$DOMAIN" ]]; then
  echo "  Site:     https://$DOMAIN"
fi
echo "  Server:   $REMOTE_USER_HOST"
echo "  App dir:  $APP_DIR"
echo "  Service:  $SERVICE_NAME"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
info "To watch logs:  ssh $REMOTE_USER_HOST 'journalctl -u $SERVICE_NAME -f'"
info "To check status: ssh $REMOTE_USER_HOST 'systemctl status $SERVICE_NAME'"
