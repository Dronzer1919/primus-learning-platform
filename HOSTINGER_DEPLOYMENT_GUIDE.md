# Hostinger VPS Deployment Guide — Learning Platform

Deploy the **Angular frontend** and **Node.js/Express backend** on a Hostinger VPS
(Ubuntu) with Nginx, PM2 and free Let's Encrypt SSL.

> The domain is **`primuscodex.com`** and is already baked into every config file below.
> The frontend is served from the root domain, the API from an `api.` subdomain:
>
> | Piece    | URL                          | Served by                       |
> |----------|------------------------------|---------------------------------|
> | Frontend | `https://primuscodex.com`     | Nginx static files              |
> | Backend  | `https://api.primuscodex.com` | Nginx → PM2 (Node) on port 3000 |

---

## 0. Project layout

```
learning platform/
├── backend/                     # Node.js/Express API
│   ├── src/server.js            # entry point
│   ├── ecosystem.config.js      # PM2 config          (added)
│   └── .env.production.example  # env template         (added)
├── learning-platform/           # Angular app (build output → www/)
│   └── src/environments/environment.prod.ts
├── deployment-scripts/          # (added)
│   ├── initial-setup.sh         # one-time server bootstrap
│   ├── deploy-backend.sh        # run ON the server to update backend
│   ├── deploy-frontend.sh       # run LOCALLY to build + upload frontend
│   ├── nginx-frontend.conf      # Nginx site for the SPA
│   └── nginx-api.conf           # Nginx reverse proxy for the API
└── HOSTINGER_DEPLOYMENT_GUIDE.md
```

---

## 1. Prerequisites

- A Hostinger **VPS** with root/SSH access and its public IP.
- Your domain's DNS managed in Hostinger (or pointed at Hostinger nameservers).
- A MongoDB database — **MongoDB Atlas** free tier recommended.
- Git repository for this project (so the server can `git clone` / `git pull`).

---

## 2. DNS records

In Hostinger **hPanel → DNS Zone**, create two A records pointing at your VPS IP:

| Type | Name  | Value (points to) |
|------|-------|-------------------|
| A    | `@`   | `YOUR_VPS_IP`     |
| A    | `api` | `YOUR_VPS_IP`     |
| CNAME| `www` | `primuscodex.com`  |

DNS can take up to a few hours to propagate.

---

## 3. One-time server setup

SSH in and run the bootstrap script (installs Node 18, PM2, Nginx, Certbot,
firewall, swap, and creates the app directories):

```bash
ssh root@YOUR_VPS_IP

# copy the repo up first, or clone it, then:
sudo bash deployment-scripts/initial-setup.sh
```

It creates:
- `/var/www/learning-platform-backend`  (+ `logs/`)
- `/var/www/learning-platform-frontend`

---

## 4. Deploy the backend

```bash
# On the server
cd /var/www/learning-platform-backend

# Clone your repo's backend into this folder (or copy the backend/ contents here)
git clone https://YOUR_GIT_REPO_URL.git .
# If your repo root contains more than the backend, clone elsewhere and copy backend/ in.

# Create the real .env from the template and fill in secrets
cp .env.production.example .env
nano .env
```

Fill `.env` with production values — **`CORS_ORIGIN` must be your frontend URL**:

```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb+srv://USER:PASS@cluster.mongodb.net/learning_platform
JWT_SECRET=a_long_random_secret
JWT_EXPIRE=7d
CORS_ORIGIN=https://primuscodex.com,https://www.primuscodex.com
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

Install deps and start with PM2:

```bash
npm install --production
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup      # follow the printed command if you haven't run it yet
pm2 status
```

> The backend reads `CORS_ORIGIN` (comma-separated) and only allows those origins in
> production. Leave it unset locally to allow all origins during development.

### Nginx reverse proxy for the API

```bash
sudo cp deployment-scripts/nginx-api.conf /etc/nginx/sites-available/learning-platform-api
sudo ln -s /etc/nginx/sites-available/learning-platform-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d api.primuscodex.com
```

Test: `curl https://api.primuscodex.com/api/health` → should return the health JSON.

---

## 5. Deploy the frontend

### 5.1 Point the app at your API

Edit `learning-platform/src/environments/environment.prod.ts`:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://api.primuscodex.com/api',
  googleClientId: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'
};
```

### 5.2 Build + upload (from your LOCAL machine)

Edit the top of `deployment-scripts/deploy-frontend.sh` (`SERVER_USER`, `SERVER_HOST`),
then from the **project root**:

```bash
bash deployment-scripts/deploy-frontend.sh
```

This runs `npm run build` (output → `learning-platform/www/`) and `rsync`s it to
`/var/www/learning-platform-frontend`.

> Prefer to build on the server? Run `cd learning-platform && npm ci && npm run build`
> there and copy `www/` into `/var/www/learning-platform-frontend`.

### 5.3 Nginx site for the SPA

```bash
sudo cp deployment-scripts/nginx-frontend.conf /etc/nginx/sites-available/learning-platform-frontend
sudo ln -s /etc/nginx/sites-available/learning-platform-frontend /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# SSL (also enables the www redirect)
sudo certbot --nginx -d primuscodex.com -d www.primuscodex.com
```

The `try_files $uri $uri/ /index.html;` rule makes Angular's client-side routing work
(e.g. deep links like `/user/playground-sessions` won't 404 on refresh).

---

## 6. Google OAuth (if using Google Sign-In)

In Google Cloud Console → your OAuth 2.0 Client ID, add to **Authorized JavaScript origins**:
- `https://primuscodex.com`

And set the same `GOOGLE_CLIENT_ID` in both the backend `.env` and `environment.prod.ts`.

---

## 7. Updating later

**Backend** (on the server):
```bash
cd /var/www/learning-platform-backend
bash /path/to/deployment-scripts/deploy-backend.sh   # git pull + npm install + pm2 reload
```

**Frontend** (locally):
```bash
bash deployment-scripts/deploy-frontend.sh           # rebuild + rsync
```

---

## 8. Handy commands

```bash
# PM2
pm2 status
pm2 logs learning-platform-backend
pm2 monit
pm2 reload learning-platform-backend

# Nginx
sudo nginx -t
sudo systemctl reload nginx
sudo tail -f /var/log/nginx/error.log

# SSL renewal (auto, but test it)
sudo certbot renew --dry-run
```

---

## 9. Troubleshooting

| Symptom | Check |
|---|---|
| API 502 Bad Gateway | Is PM2 running? `pm2 status`, `pm2 logs learning-platform-backend`. Is it on port 3000? |
| CORS error in browser | `CORS_ORIGIN` in backend `.env` must exactly equal `https://primuscodex.com` (no trailing slash). Then `pm2 reload`. |
| Frontend white page | Wrong `apiUrl` in `environment.prod.ts`, or files not in `/var/www/learning-platform-frontend`. Check browser console. |
| Refresh gives 404 | The SPA `try_files … /index.html` rule is missing — use `nginx-frontend.conf`. |
| DB connection fails | Verify `MONGODB_URI` and whitelist the VPS IP (or `0.0.0.0/0`) in Atlas. |

---

## ✅ Checklist

- [ ] DNS A records for `@` and `api` point to the VPS
- [ ] `initial-setup.sh` run successfully
- [ ] Backend `.env` filled (incl. `CORS_ORIGIN=https://primuscodex.com`)
- [ ] `pm2 start ecosystem.config.js --env production` + `pm2 save`
- [ ] `nginx-api.conf` enabled + SSL on `api.primuscodex.com`
- [ ] `environment.prod.ts` has correct `apiUrl` + `googleClientId`
- [ ] Frontend built and uploaded to `/var/www/learning-platform-frontend`
- [ ] `nginx-frontend.conf` enabled + SSL on `primuscodex.com`
- [ ] `https://api.primuscodex.com/api/health` returns OK
- [ ] `https://primuscodex.com` loads, login + API calls work
```
