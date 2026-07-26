#!/usr/bin/env bash
# One-command setup + deploy for the Learning Platform (Docker Compose) on a VPS that
# ALREADY hosts another project. Clones the repo (no manual git clone needed), then
# builds and starts the stack. Coexists with the ecom project:
#   - containers lp-mongo / lp-api / lp-web on host ports 127.0.0.1:3100 and :8081
#   - its own volume + network + isolated MongoDB
#   - its own HOST Nginx sites (primuscodex.com / api.primuscodex.com)
#
# Docker + Nginx are assumed installed (from the existing project).
#
#   sudo bash deployment-scripts/vps-setup.sh
#
# Re-run any time to redeploy the latest dev.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Dronzer1919/primus-learning-platform.git}"
BRANCH="${BRANCH:-dev}"
APP_ROOT="${APP_ROOT:-/var/www/learning-platform-backend}"
BACKEND_DIR="$APP_ROOT/backend"

log(){ echo -e "\n[\033[0;32m$(date '+%H:%M:%S')\033[0m] $*"; }
have(){ command -v "$1" >/dev/null 2>&1; }

[[ "$EUID" -eq 0 ]] || { echo "Run with sudo:  sudo bash $0"; exit 1; }
for c in git docker nginx; do
  have "$c" || { echo "Missing '$c'. Install it first (the existing project usually already has Docker + Nginx)."; exit 1; }
done

# 1) Clone or update
if [[ -d "$APP_ROOT/.git" ]]; then
  log "Updating existing repo ($BRANCH)"
  git -C "$APP_ROOT" fetch origin
  git -C "$APP_ROOT" checkout "$BRANCH"
  git -C "$APP_ROOT" pull origin "$BRANCH"
else
  log "Cloning $REPO_URL -> $APP_ROOT ($BRANCH)"
  mkdir -p "$(dirname "$APP_ROOT")"
  git clone -b "$BRANCH" "$REPO_URL" "$APP_ROOT"
fi
cd "$APP_ROOT"

# 2) Backend .env — required once (secrets only you know)
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.production.example" "$BACKEND_DIR/.env"
  cat <<EOF

>>> Created $BACKEND_DIR/.env from the template.
>>> Fill in JWT_SECRET, CORS_ORIGIN and Google (MONGODB_URI already points at the
>>> lp-mongo container), then re-run this script:
>>>     nano $BACKEND_DIR/.env
EOF
  exit 0
fi

# 3) Build + start the stack
log "docker compose up -d --build"
docker compose down || true
docker compose up -d --build
docker compose ps

# 4) HOST Nginx sites — install/refresh (idempotent)
install_site(){ cp "$APP_ROOT/deployment-scripts/$1" "/etc/nginx/sites-available/$2"; ln -sf "/etc/nginx/sites-available/$2" "/etc/nginx/sites-enabled/$2"; }
log "Nginx: installing host sites"
install_site nginx-api.conf      learning-platform-api
install_site nginx-frontend.conf learning-platform-frontend
nginx -t && systemctl reload nginx

log "Deploy complete. api -> 127.0.0.1:3100, web -> 127.0.0.1:8081."
cat <<EOF

Remaining one-time steps (need your input / DNS):
  1. SSL certificates (after DNS points at this VPS):
       sudo certbot --nginx -d api.primuscodex.com
       sudo certbot --nginx -d primuscodex.com -d www.primuscodex.com
  2. Seed the database (runs inside the api container):
       docker compose exec -T lp-api node seed.js
       docker compose exec -T lp-api node seed-interview-content.js
       docker compose exec -T lp-api npm run seed:html-interview
       docker compose exec -T lp-api npm run seed:css-interview
       docker compose exec -T lp-api npm run seed:js-interview
EOF
