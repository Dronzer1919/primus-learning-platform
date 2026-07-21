#!/bin/bash

# Initial Server Setup Script for Hostinger VPS (Learning Platform)
# Run this ONCE when setting up a brand-new server.
# Execute:  sudo bash initial-setup.sh

echo "=========================================="
echo "   Initial Server Setup — Learning Platform"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Must run as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: This script must be run as root${NC}"
  echo "Run: sudo bash initial-setup.sh"
  exit 1
fi

# Update system
echo -e "${YELLOW}Updating system packages...${NC}"
apt update && apt upgrade -y

# Node.js 18.x LTS
echo -e "${YELLOW}Installing Node.js 18.x LTS...${NC}"
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
echo -e "${GREEN}Node.js: $(node --version)  npm: $(npm --version)${NC}"

# PM2
echo -e "${YELLOW}Installing PM2 process manager...${NC}"
npm install -g pm2

# Git, Nginx, utilities
echo -e "${YELLOW}Installing Git, Nginx and utilities...${NC}"
apt install -y git nginx curl wget vim htop net-tools build-essential

# Start & enable Nginx
systemctl start nginx
systemctl enable nginx

# Certbot for SSL
echo -e "${YELLOW}Installing Certbot for SSL certificates...${NC}"
apt install -y certbot python3-certbot-nginx

# Firewall
echo -e "${YELLOW}Configuring firewall...${NC}"
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw status

# Application directories
echo -e "${YELLOW}Creating application directories...${NC}"
mkdir -p /var/www/learning-platform-backend/logs
mkdir -p /var/www/learning-platform-frontend
chown -R $SUDO_USER:$SUDO_USER /var/www/learning-platform-backend
chown -R $SUDO_USER:$SUDO_USER /var/www/learning-platform-frontend

# Nginx upload limits
echo -e "${YELLOW}Configuring Nginx upload limits...${NC}"
cat > /etc/nginx/conf.d/upload-limits.conf << 'EOF'
client_max_body_size 50M;
client_body_timeout 300s;
EOF

# PM2 startup on boot (for the deploy user)
echo -e "${YELLOW}Configuring PM2 startup...${NC}"
sudo -u $SUDO_USER pm2 startup systemd -u $SUDO_USER --hp /home/$SUDO_USER

# System tuning
echo -e "${YELLOW}Optimizing system for Node.js...${NC}"
sysctl -w fs.file-max=65536
grep -q "fs.file-max" /etc/sysctl.conf || echo "fs.file-max = 65536" >> /etc/sysctl.conf

# Swap file (helps small VPS plans)
if [ ! -f /swapfile ]; then
  echo -e "${YELLOW}Creating 2G swap file...${NC}"
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

systemctl restart nginx
apt autoremove -y && apt autoclean

echo ""
echo -e "${GREEN}=========================================="
echo -e "   Initial Setup Completed!"
echo -e "==========================================${NC}"
echo ""
echo "Next steps:"
echo "  1. Clone backend into  /var/www/learning-platform-backend"
echo "  2. Copy frontend build into  /var/www/learning-platform-frontend"
echo "  3. Copy the two Nginx config files from deployment-scripts/ into"
echo "     /etc/nginx/sites-available/ and enable them"
echo "  4. Run certbot for SSL on both domains"
echo ""
