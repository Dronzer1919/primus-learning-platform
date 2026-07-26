#!/usr/bin/env bash
# One-command setup + deploy for the Learning Platform on a VPS that ALREADY hosts
# another project. It clones the repo (you don't need to git clone first), then
# deploys BOTH backend and frontend. Coexists with the other project:
#   - backend PM2 process on port 3001 (the other one uses 3000)
#   - its own Nginx sites (api.primuscodex.com / primuscodex.com)
#   - its own /var/www paths and its own isolated MongoDB
#
# Node/npm/PM2/Nginx are assumed already installed (from the existing project).
#
#   sudo bash deployment-scripts/vps-setup.sh
#
# Re-run any time to redeploy: it pulls the latest dev, rebuilds and reloads.
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Dronzer1919/primus-learning-platform.git}"
BRANCH="${BRANCH:-dev}"
APP_ROOT="${APP_ROOT:-/var/www/learning-platform-backend}"   # full monorepo clone
WEB_ROOT="${WEB_ROOT:-/var/www/learning-platform-frontend}"  # Nginx serves this
BACKEND_DIR="$APP_ROOT/backend"
FRONTEND_DIR="$APP_ROOT/learning-platform"
APP_NAME="learning-platform-backend"

log(){ echo -e "\n[\033[0;32m$(date '+%H:%M:%S')\033[0m] $*"; }
have(){ command -v "$1" >/dev/null 2>&1; }

[[ "$EUID" -eq 0 ]] || { echo "Run with sudo:  sudo bash $0"; exit 1; }
for c in git node npm pm2 nginx; do
  have "$c" || { echo "Missing '$c'. Install it first (the existing project's setup usually already has it)."; exit 1; }
done

# 1) Clone or update the repo
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
mkdir -p "$WEB_ROOT"

# 2) Backend .env — required once (secrets only you know)
if [[ ! -f "$BACKEND_DIR/.env" ]]; then
  cp "$BACKEND_DIR/.env.production.example" "$BACKEND_DIR/.env"
  cat <<EOF

>>> Created $BACKEND_DIR/.env from the template.
>>> Fill in MONGODB_URI, JWT_SECRET, CORS_ORIGIN and Google, then re-run this script:
>>>     nano $BACKEND_DIR/.env
>>> For the isolated database first run:
>>>     sudo bash $APP_ROOT/deployment-scripts/install-mongodb.sh
EOF
  exit 0
fi

# 3) Backend — install deps + (re)start under PM2
log "Backend: installing production dependencies"
cd "$BACKEND_DIR"; mkdir -p logs
npm install --production
log "Backend: (re)starting PM2 process on :3001"
if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

# 4) Frontend — build + publish to the Nginx web root
log "Frontend: building production bundle"
cd "$FRONTEND_DIR"; npm ci; npm run build
log "Frontend: publishing -> $WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"* && cp -r "$FRONTEND_DIR/www/"* "$WEB_ROOT/"

# 5) Nginx sites — install/refresh (idempotent)
install_site(){ cp "$APP_ROOT/deployment-scripts/$1" "/etc/nginx/sites-available/$2"; ln -sf "/etc/nginx/sites-available/$2" "/etc/nginx/sites-enabled/$2"; }
log "Nginx: installing sites"
install_site nginx-api.conf      learning-platform-api
install_site nginx-frontend.conf learning-platform-frontend
nginx -t && systemctl reload nginx

log "Deploy complete. Backend :3001, frontend served from $WEB_ROOT."
cat <<EOF

Remaining one-time steps (need your input / DNS):
  1. Isolated MongoDB (if not done):
       sudo bash $APP_ROOT/deployment-scripts/install-mongodb.sh
  2. SSL certificates (after DNS points at this VPS):
       sudo certbot --nginx -d api.primuscodex.com
       sudo certbot --nginx -d primuscodex.com -d www.primuscodex.com
  3. Seed the database:
       cd $BACKEND_DIR && node seed.js && node seed-interview-content.js \\
         && npm run seed:html-interview && npm run seed:css-interview && npm run seed:js-interview
EOF
