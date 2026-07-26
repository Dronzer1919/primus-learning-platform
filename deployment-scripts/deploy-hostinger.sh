#!/usr/bin/env bash
# One-shot VPS deploy for the Learning Platform (PM2 + Nginx static files).
# Run automatically by the GitHub Actions workflow (.github/workflows/deploy-dev.yml)
# on every push to `dev`, or manually on the server:
#     APP_ROOT=/var/www/learning-platform-backend BRANCH=dev bash deployment-scripts/deploy-hostinger.sh
#
# It pulls the latest code, reloads the backend under PM2, rebuilds the Angular app,
# publishes it to the Nginx web root, and health-checks both.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/learning-platform-backend}"   # full monorepo git clone
BRANCH="${BRANCH:-dev}"
BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/learning-platform"
WEB_ROOT="${WEB_ROOT:-/var/www/learning-platform-frontend}"   # Nginx serves this
APP_NAME="learning-platform-backend"
API_HEALTH_URL="${API_HEALTH_URL:-https://api.primuscodex.com/api/health}"
FRONTEND_HEALTH_URL="${FRONTEND_HEALTH_URL:-https://primuscodex.com}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Required command not found: $1" >&2; exit 1; }; }
health_check() {
  if curl -fsS --max-time 20 "$1" >/dev/null; then
    log "$2 health check passed: $1"
  else
    echo "$2 health check FAILED: $1" >&2
    exit 1
  fi
}

main() {
  require_cmd git; require_cmd node; require_cmd npm; require_cmd pm2; require_cmd curl

  log "Updating code at $APP_ROOT ($BRANCH)"
  cd "$APP_ROOT"
  git fetch --all --prune
  git checkout "$BRANCH"
  git pull origin "$BRANCH"

  # ---------- Backend (PM2) ----------
  [[ -f "$BACKEND_DIR/.env" ]] || { echo "Missing backend env: $BACKEND_DIR/.env" >&2; exit 1; }
  log "Installing backend dependencies"
  cd "$BACKEND_DIR"
  mkdir -p logs
  npm install --production
  log "(Re)starting backend under PM2"
  if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    pm2 reload "$APP_NAME" --update-env
  else
    pm2 start ecosystem.config.js --env production
  fi
  pm2 save

  # ---------- Frontend (build + publish) ----------
  log "Building Angular production bundle"
  cd "$FRONTEND_DIR"
  npm ci
  npm run build   # outputs to learning-platform/www (environment.prod.ts)
  log "Publishing frontend to $WEB_ROOT"
  mkdir -p "$WEB_ROOT"
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$FRONTEND_DIR/www/" "$WEB_ROOT/"
  else
    rm -rf "${WEB_ROOT:?}/"* && cp -r "$FRONTEND_DIR/www/"* "$WEB_ROOT/"
  fi

  # ---------- Nginx reload (best-effort; static files don't strictly need it) ----------
  if sudo -n true 2>/dev/null; then
    if sudo nginx -t; then sudo systemctl reload nginx; else log "WARNING: nginx config test failed; skipping reload"; fi
  else
    log "Skipping nginx reload (no non-interactive sudo)"
  fi

  # ---------- Health checks ----------
  sleep 3
  health_check "$API_HEALTH_URL" "API"
  health_check "$FRONTEND_HEALTH_URL" "Frontend"

  log "Deployment completed successfully"
}

main
