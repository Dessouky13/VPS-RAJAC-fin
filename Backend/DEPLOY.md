# Backend Deployment — VPS + Docker Compose

This guide replaces the old Cloud Run deployment. The backend now runs on your own VPS behind Nginx.

---

## Prerequisites

- VPS with Ubuntu 22.04+ (or Debian)
- Domain name pointing to your VPS IP (for HTTPS)
- Ports 80 and 443 open in firewall

---

## 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# log out and back in
```

---

## 2. Clone & Configure

```bash
git clone <your-repo-url> /opt/rajac-finance
cd /opt/rajac-finance/Backend

cp .env.example .env
nano .env
```

**Required values to set in `.env`:**

```env
POSTGRES_PASSWORD=your_strong_database_password
JWT_SECRET=your_64_char_random_secret_here
FRONTEND_URL=https://your-app.vercel.app
ADMIN_PASSWORD=your_admin_password
HR_PASSWORD=your_hr_password
```

Generate a strong JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## 3. Start Services

```bash
cd /opt/rajac-finance/Backend
docker compose up -d

# Check status
docker compose ps
```

Both `postgres` and `backend` should show `Up (healthy)`.

The backend auto-creates all database tables on first startup.

---

## 4. Nginx Reverse Proxy

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

Create `/etc/nginx/sites-available/rajac`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass         http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/rajac /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d api.yourdomain.com
```

---

## 5. Verify

```bash
# Health check
curl https://api.yourdomain.com/health

# Should return:
# {"ok":true,"db":"connected","uptime":...}
```

---

## 6. Frontend — Vercel Environment Variable

In your Vercel project settings → Environment Variables:

```
VITE_API_BASE_URL = https://api.yourdomain.com
```

Redeploy the frontend after setting this.

---

## 7. Updating the Backend

```bash
cd /opt/rajac-finance
git pull
cd Backend
docker compose up -d --build backend
```

PostgreSQL data lives in a named Docker volume (`postgres_data`) and is **not affected** by rebuilds.

---

## 8. Database Backup (Manual)

```bash
# Dump
docker exec rajac-postgres pg_dump -U rajac rajac > backup_$(date +%Y%m%d).sql

# Restore
docker exec -i rajac-postgres psql -U rajac rajac < backup_20260319.sql
```

The app also provides in-app backups (up to 5 slots) via the Admin → Create Backup menu. These are stored in the `backup_index` / `backup_data` tables and survive server restarts.

---

## 9. Logs

```bash
# Backend logs
docker compose logs -f backend

# PostgreSQL logs
docker compose logs -f postgres
```

---

## 10. Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Backend container exits immediately | `JWT_SECRET` not set | Check `.env`, `docker compose up -d` |
| `CORS error` in browser | `FRONTEND_URL` mismatch | Set correct Vercel URL in `.env`, restart backend |
| `503 Bad Gateway` from Nginx | Backend not running on port 3000 | `docker compose ps`, check logs |
| Login always fails | Wrong admin password | Check `ADMIN_PASSWORD` in `.env`; if DB already seeded with old password, change via `POST /api/auth/change-password` |
| Tables missing | First-run schema not applied | `docker compose restart backend` — schema runs on startup |
