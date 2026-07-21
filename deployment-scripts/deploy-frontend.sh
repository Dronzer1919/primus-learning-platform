#!/bin/bash

# Frontend Deployment Script — run this on your LOCAL machine (Git Bash / WSL / Linux).
# Builds the Angular app and rsyncs it to the VPS.
# Execute from the project root:  bash deployment-scripts/deploy-frontend.sh

echo "=========================================="
echo "   Frontend Deployment — Learning Platform"
echo "=========================================="
echo ""

# ---- Configuration: UPDATE THESE ----
SERVER_USER="your_username"          # e.g. root or a deploy user
SERVER_HOST="your-server-ip"         # your VPS IP or hostname
SERVER_PATH="/var/www/learning-platform-frontend"
FRONTEND_DIR="./learning-platform"   # Angular app folder
BUILD_DIR="$FRONTEND_DIR/www"        # ng build output (angular.json outputPath.base = "www")

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ ! -d "$FRONTEND_DIR" ]; then
  echo -e "${RED}Error: Frontend directory not found: $FRONTEND_DIR${NC}"
  echo "Run this script from the project root (the folder containing 'learning-platform/')."
  exit 1
fi

# Build
echo -e "${YELLOW}Installing dependencies...${NC}"
( cd "$FRONTEND_DIR" && npm install ) || { echo -e "${RED}npm install failed${NC}"; exit 1; }

echo -e "${YELLOW}Building production bundle...${NC}"
( cd "$FRONTEND_DIR" && npm run build ) || { echo -e "${RED}Build failed${NC}"; exit 1; }

if [ ! -d "$BUILD_DIR" ] || [ ! -f "$BUILD_DIR/index.html" ]; then
  echo -e "${RED}Error: Build output not found at $BUILD_DIR${NC}"
  exit 1
fi

# Backup current release on the server
echo -e "${YELLOW}Creating backup on server...${NC}"
ssh "$SERVER_USER@$SERVER_HOST" "cd $SERVER_PATH && tar -czf ../frontend-backup-\$(date +%Y%m%d-%H%M%S).tar.gz . 2>/dev/null || true"

# Upload (deletes removed files so the release is clean)
echo -e "${YELLOW}Uploading files to $SERVER_USER@$SERVER_HOST:$SERVER_PATH ...${NC}"
rsync -avz --delete "$BUILD_DIR"/ "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/" \
  || { echo -e "${RED}Upload failed${NC}"; exit 1; }

echo ""
echo -e "${GREEN}=========================================="
echo -e "   Frontend deployed successfully!"
echo -e "==========================================${NC}"
echo "  Visit: https://primuscodex.com  (clear cache if needed)"
echo ""
