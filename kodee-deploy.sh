#!/bin/bash
# ============================================================
#  KODEE DEPLOY SCRIPT — primuscodex.com
#  Run this on the Hostinger VPS as root:
#    bash kodee-deploy.sh
# ============================================================

set -e

REPO_URL="https://github.com/Dronzer1919/primus-learning-platform.git"
APP_DIR="/root/learning-platform"

echo "=============================="
echo " Step 1: Clone or update repo"
echo "=============================="
if [ -d "$APP_DIR/.git" ]; then
  echo "Repo already exists — pulling latest..."
  cd "$APP_DIR"
  git pull origin main
else
  echo "Cloning repo..."
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo ""
echo "=============================="
echo " Step 2: Create backend/.env"
echo "=============================="
cat > backend/.env << 'EOF'
PORT=3001
MONGODB_URI=mongodb://lp-mongo:27017/learning-platform
JWT_SECRET=PrimusCodex_SuperSecret_2024!
NODE_ENV=production
CORS_ORIGIN=https://primuscodex.com
EOF
echo "backend/.env created."

echo ""
echo "=============================="
echo " Step 3: Build & start Docker"
echo "=============================="
docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d --build
echo "Containers started."

echo ""
echo "=============================="
echo " Step 4: Wait for MongoDB..."
echo "=============================="
sleep 8

echo ""
echo "=============================="
echo " Step 5: Seed the database"
echo "=============================="
# seed.js refuses to run when NODE_ENV=production unless ALLOW_PRODUCTION_SEED=yes,
# and refuses to mint accounts without passwords. Those guards are deliberate — it
# wipes User, LanguageTab and Topic before inserting. Supply the passwords from the
# environment rather than this file, which lives in version control:
#
#   SEED_ADMIN_PASSWORD='...' SEED_USER_PASSWORD='...' bash kodee-deploy.sh
if [ -z "$SEED_ADMIN_PASSWORD" ] || [ -z "$SEED_USER_PASSWORD" ]; then
  echo "SKIPPED: set SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD (8+ chars) to seed."
  echo "The deploy itself succeeded — only the seed step was skipped."
else
  docker exec \
    -e ALLOW_PRODUCTION_SEED=yes \
    -e SEED_ADMIN_PASSWORD="$SEED_ADMIN_PASSWORD" \
    -e SEED_USER_PASSWORD="$SEED_USER_PASSWORD" \
    lp-api node seed.js

  # Content seeds must follow seed.js, which deletes every topic.
  docker exec lp-api node seed-html-interview.js
  docker exec lp-api node seed-css-interview.js
  docker exec lp-api node seed-js-interview.js
  docker exec lp-api node seed-interview-content.js
  echo "Database seeded."
fi

echo ""
echo "=============================="
echo " Step 6: Status check"
echo "=============================="
docker compose ps

echo ""
echo "======================================================"
echo " DONE! Visit https://primuscodex.com to test login."
echo "======================================================"
