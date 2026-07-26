#!/usr/bin/env bash
# Docker deploy for the Learning Platform — run by the GitHub Actions workflow on
# every push to `dev`, or manually on the server:
#     APP_ROOT=/var/www/learning-platform-backend BRANCH=dev bash deployment-scripts/deploy-hostinger.sh
#
# Pulls the latest code and rebuilds/restarts the docker-compose stack (lp-mongo,
# lp-api, lp-web), then health-checks the live URLs. Mirrors the ionic-ecom flow.
set -euo pipefail

APP_ROOT="${APP_ROOT:-/var/www/learning-platform-backend}"
BRANCH="${BRANCH:-dev}"
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
  require_cmd git
  require_cmd docker
  require_cmd curl

  log "Updating code at $APP_ROOT ($BRANCH)"
  cd "$APP_ROOT"
  git fetch --all --prune
  git checkout "$BRANCH"
  git pull origin "$BRANCH"

  [[ -f backend/.env ]] || { echo "Missing backend/.env at $APP_ROOT/backend/.env" >&2; exit 1; }

  log "Building and starting containers (lp-mongo, lp-api, lp-web)"
  docker compose down
  docker compose up -d --build
  docker compose ps

  # Host nginx is static across deploys; reload best-effort (fine to skip).
  if sudo -n true 2>/dev/null; then
    sudo nginx -t && sudo systemctl reload nginx || log "WARNING: nginx reload skipped"
  fi

  log "Running endpoint checks"
  sleep 5
  health_check "$API_HEALTH_URL" "API"
  health_check "$FRONTEND_HEALTH_URL" "Frontend"

  log "Deployment completed successfully"
}

main
