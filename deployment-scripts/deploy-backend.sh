#!/bin/bash

# Backend Deployment Script — run this ON THE SERVER (as the deploy user, not root)
# Pulls the latest code, installs deps and restarts the PM2 process.
# Execute:  bash deploy-backend.sh

echo "=========================================="
echo "   Backend Deployment — Learning Platform"
echo "=========================================="
echo ""

# Configuration
APP_NAME="learning-platform-backend"
APP_DIR="/var/www/learning-platform-backend"
BRANCH="main"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Do not run as root
if [ "$EUID" -eq 0 ]; then
  echo -e "${RED}Error: Do not run this script as root${NC}"
  exit 1
fi

# Go to app directory
echo -e "${YELLOW}Navigating to $APP_DIR ...${NC}"
cd "$APP_DIR" || { echo -e "${RED}Directory not found${NC}"; exit 1; }

# Pull latest code
echo -e "${YELLOW}Pulling latest changes ($BRANCH)...${NC}"
git fetch origin
git pull origin "$BRANCH" || { echo -e "${RED}Git pull failed${NC}"; exit 1; }

# Install production dependencies
echo -e "${YELLOW}Installing dependencies...${NC}"
npm install --production || { echo -e "${RED}npm install failed${NC}"; exit 1; }

# Start (first time) or reload the PM2 process using the ecosystem file
echo -e "${YELLOW}(Re)starting application with PM2...${NC}"
if pm2 describe "$APP_NAME" > /dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
else
  pm2 start ecosystem.config.js --env production
fi
pm2 save

sleep 3
echo -e "${YELLOW}Status:${NC}"
pm2 status "$APP_NAME"
echo -e "${YELLOW}Recent logs:${NC}"
pm2 logs "$APP_NAME" --lines 20 --nostream

echo ""
echo -e "${GREEN}=========================================="
echo -e "   Backend deployed successfully!"
echo -e "==========================================${NC}"
echo "  pm2 logs $APP_NAME     # view logs"
echo "  pm2 monit              # live monitor"
echo ""
