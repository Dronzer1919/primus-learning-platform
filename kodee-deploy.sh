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
docker exec lp-api node seed.js
echo "Database seeded."

echo ""
echo "=============================="
echo " Step 6: Status check"
echo "=============================="
docker compose ps

echo ""
echo "======================================================"
echo " DONE! Visit https://primuscodex.com to test login."
echo "======================================================"
