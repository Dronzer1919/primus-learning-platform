# Dev Branch Auto Deployment

Every push to `dev` auto-deploys to the Hostinger VPS via GitHub Actions:

- `.github/workflows/deploy-dev.yml` — triggers on push to `dev` (merges count too), SSHes
  into the VPS and runs `deployment-scripts/deploy-hostinger.sh`.
- `deployment-scripts/deploy-hostinger.sh` — on the VPS: `git pull dev` → backend
  `npm install` + PM2 reload → Angular `npm run build` → publish to the Nginx web root →
  health-check `https://api.primuscodex.com/api/health` and `https://primuscodex.com`.

Same pattern as the ionic-ecom project, but PM2 + Nginx static files instead of Docker.

## Required GitHub Secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|--------|-------|
| `VPS_HOST` | VPS public IP or domain |
| `VPS_USERNAME` | SSH user (the deploy user, e.g. `deploy` or `root`) |
| `VPS_SSH_KEY` | **private** SSH key (full PEM text) whose public key is in the VPS user's `~/.ssh/authorized_keys` |
| `VPS_APP_DIR` | absolute path of the repo clone on the VPS, e.g. `/var/www/learning-platform-backend` |

## One-time VPS setup (before the first auto-deploy)

```bash
ssh root@YOUR_VPS_IP
git clone https://YOUR_REPO.git /var/www/learning-platform-backend
cd /var/www/learning-platform-backend && git checkout dev
sudo bash deployment-scripts/initial-setup.sh          # Node, PM2, Nginx, Certbot, swap

# Backend env + first start
cd backend
cp .env.production.example .env && nano .env           # MONGODB_URI, JWT_SECRET, CORS_ORIGIN, Google
mkdir -p logs && npm install --production
pm2 start ecosystem.config.js --env production && pm2 save && pm2 startup

# Nginx sites + SSL (see HOSTINGER_DEPLOYMENT_GUIDE.md sections 4–5)
```

### SSH key for the deploy user (so Actions can log in)

```bash
# On your machine (or the VPS), generate a keypair:
ssh-keygen -t ed25519 -C "gh-actions-deploy" -f deploy_key
# Add the PUBLIC key to the VPS user:
cat deploy_key.pub >> ~/.ssh/authorized_keys      # on the VPS, as the deploy user
# Put the PRIVATE key (deploy_key) into the GitHub secret VPS_SSH_KEY.
```

### Passwordless sudo (optional, for the nginx reload step)

The deploy script reloads Nginx best-effort; static file changes don't require it. To
enable it, give the deploy user passwordless sudo for nginx only:

```bash
echo '<deploy_user> ALL=(root) NOPASSWD: /usr/sbin/nginx, /bin/systemctl reload nginx' \
  | sudo tee /etc/sudoers.d/deploy-nginx
```

## Notes
- First push after setup: watch **GitHub → Actions** for the run and its logs.
- `workflow_dispatch` lets you trigger a deploy manually from the Actions tab.
- Building Angular on a small VPS uses the 2 GB swap that `initial-setup.sh` creates.
