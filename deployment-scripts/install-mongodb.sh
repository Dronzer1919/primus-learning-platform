#!/usr/bin/env bash
# Installs MongoDB natively on the VPS for the Learning Platform — a dedicated,
# isolated instance (auth enabled, bound to localhost). Mirrors the ionic-ecom
# install-mongodb-local.sh approach.
#
# Run ONCE as root:  sudo bash deployment-scripts/install-mongodb.sh
# Then create the isolated DB + user (see the mongosh block printed at the end).
set -euo pipefail

if [[ "$EUID" -ne 0 ]]; then
  echo "Run as root: sudo bash deployment-scripts/install-mongodb.sh" >&2
  exit 1
fi

MONGO_VERSION="${MONGO_VERSION:-8.0}"
# Ubuntu codename (noble=24.04, jammy=22.04). Auto-detected, override with CODENAME=...
CODENAME="${CODENAME:-$(. /etc/os-release && echo "${UBUNTU_CODENAME:-${VERSION_CODENAME:-noble}}")}"

echo "Installing MongoDB ${MONGO_VERSION} for Ubuntu '${CODENAME}' ..."

curl -fsSL "https://pgp.mongodb.com/server-${MONGO_VERSION}.asc" | \
  gpg -o "/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg" --dearmor

echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-${MONGO_VERSION}.gpg ] https://repo.mongodb.org/apt/ubuntu ${CODENAME}/mongodb-org/${MONGO_VERSION} multiverse" \
  > "/etc/apt/sources.list.d/mongodb-org-${MONGO_VERSION}.list"

apt update
apt install -y mongodb-org

# Enable auth + keep it private to the host (only the backend on the same VPS connects).
MONGOD_CONF="/etc/mongod.conf"
if ! grep -q "^security:" "$MONGOD_CONF"; then
  cat >> "$MONGOD_CONF" <<'EOF'

security:
  authorization: enabled
EOF
fi
sed -i 's/^  bindIp:.*/  bindIp: 127.0.0.1/' "$MONGOD_CONF"

systemctl enable mongod
systemctl restart mongod
sleep 2
systemctl status mongod --no-pager || true

cat <<'NEXT'

============================================================
 MongoDB installed (auth on, bound to 127.0.0.1).
 Now create the ISOLATED learning_platform DB + user.
 The "localhost exception" lets you create the first user
 without logging in. Replace the passwords first!
============================================================

mongosh <<'JS'
// 1) admin user (to manage the server later)
use admin
db.createUser({
  user: "lp_admin",
  pwd:  "CHANGE_ADMIN_PASSWORD",
  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
})
JS

# 2) app user scoped to ONLY the learning_platform DB (the isolation)
mongosh -u lp_admin -p 'CHANGE_ADMIN_PASSWORD' --authenticationDatabase admin <<'JS'
use learning_platform
db.createUser({
  user: "lp_user",
  pwd:  "CHANGE_APP_PASSWORD",
  roles: [ { role: "readWrite", db: "learning_platform" } ]
})
JS

# 3) put this in /var/www/learning-platform-backend/backend/.env :
# MONGODB_URI=mongodb://lp_user:CHANGE_APP_PASSWORD@127.0.0.1:27017/learning_platform?authSource=learning_platform
NEXT
