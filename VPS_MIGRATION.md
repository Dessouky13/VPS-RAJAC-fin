# VPS Migration Guide — GCP → Your VPS
**Frontend stays on Vercel. Only the backend moves.**

---

## What Changes, What Doesn't

| Layer | Before | After |
|---|---|---|
| Frontend | Vercel ✅ | Vercel ✅ (no change) |
| Backend | Google Cloud Run | Your VPS (Docker + Nginx) |
| Database | Google Sheets ✅ | Google Sheets ✅ (no change) |
| Credentials | GCP Secret Manager file | `.env` file on VPS |
| SSL | Managed by GCP | Let's Encrypt / Certbot (free) |
| Domain | `…run.app` URL | Your own subdomain |

**No application code changes needed.** The credential loading already falls back to environment variables when the GCP secret file is absent.

---

## Prerequisites on the VPS

```bash
# Ubuntu/Debian — install Docker, Nginx, Certbot
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git
sudo systemctl enable --now docker nginx
sudo usermod -aG docker $USER   # then log out & back in
```

---

## Step 1 — Point a Subdomain at Your VPS

In your DNS provider, add an **A record**:

```
api.yourdomain.com  →  YOUR_VPS_IP
```

Wait for propagation (usually < 5 minutes on most providers).

---

## Step 2 — Clone the Repo on the VPS

```bash
git clone https://github.com/YOUR_USERNAME/Rajac-fin-main.git /opt/rajac
cd /opt/rajac/Backend
```

---

## Step 3 — Create the `.env` File

```bash
cp .env.vps .env
nano .env          # fill in all values
```

The critical values you need from your Google service account JSON:

```
GOOGLE_CLIENT_EMAIL   ← "client_email" field
GOOGLE_PRIVATE_KEY    ← "private_key" field (replace real \n with \\n)
GOOGLE_MASTER_SHEET_ID ← from your spreadsheet URL
```

**Tip — format the private key for .env:**
```bash
python3 -c "
import json
with open('service-account.json') as f:
    key = json.load(f)['private_key']
print(key.replace('\n', '\\\\n'))
"
```
Paste that single line as the value of `GOOGLE_PRIVATE_KEY` in `.env`.

---

## Step 4 — Set Up Nginx

```bash
# Copy the config (edit the domain first)
sudo nano /etc/nginx/sites-available/rajac-api
# paste the contents of Backend/nginx.conf, replace api.yourdomain.com

sudo ln -s /etc/nginx/sites-available/rajac-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## Step 5 — Obtain SSL Certificate

```bash
sudo certbot --nginx -d api.yourdomain.com
# Follow the prompts — choose to redirect HTTP → HTTPS
```

Certbot automatically renews every 90 days. Verify auto-renewal:
```bash
sudo systemctl status certbot.timer
```

---

## Step 6 — Build & Start the Container

```bash
cd /opt/rajac/Backend
docker compose up -d --build
docker compose ps          # should show "healthy" after ~15 s
docker compose logs -f     # watch startup logs
```

---

## Step 7 — Initialize the Spreadsheet (One Time)

```bash
curl -X POST https://api.yourdomain.com/api/init
# Should return: {"success": true, ...}
```

---

## Step 8 — Update Vercel Frontend

In your Vercel project dashboard:

1. Go to **Settings → Environment Variables**
2. Change `VITE_API_BASE_URL` from the old Cloud Run URL to:
   ```
   https://api.yourdomain.com
   ```
3. **Redeploy** the frontend (Vercel → Deployments → Redeploy)

---

## Step 9 — Test Everything

```bash
# Health check
curl https://api.yourdomain.com/api/health

# Analytics (should return JSON with financial data)
curl https://api.yourdomain.com/api/analytics

# Open the frontend and verify all sections load
```

---

## Step 10 — Decommission GCP (After Verification)

Only do this after confirming the VPS is working for at least 24 hours.

```bash
# On your local machine with gcloud CLI
gcloud run services delete rajac-finance-backend --region us-central1
# Optionally delete the container image
gcloud container images delete gcr.io/YOUR_PROJECT_ID/rajac-finance-backend
```

---

## Ongoing Maintenance

### Deploy updates
```bash
cd /opt/rajac
git pull origin main
cd Backend
./deploy-vps.sh
```

### View logs
```bash
docker compose logs -f rajac-backend
```

### Restart the service
```bash
docker compose restart rajac-backend
```

### Renew SSL manually (if needed)
```bash
sudo certbot renew
sudo systemctl reload nginx
```

---

## Cost Comparison

| Item | GCP Cloud Run | VPS |
|---|---|---|
| Compute | ~$5–15/mo (depending on cold starts & requests) | $4–6/mo (e.g. Hetzner CX11 or DigitalOcean Basic) |
| Secret Manager | ~$0.06/mo | $0 (env vars in .env) |
| Container Registry | ~$0.10/GB | $0 |
| SSL | $0 (managed) | $0 (Let's Encrypt) |
| **Total** | **~$5–20/mo** | **~$4–6/mo** |

---

## Recommended VPS Providers (Budget)

| Provider | Spec | Price |
|---|---|---|
| Hetzner CX22 | 2 vCPU / 4 GB RAM / 40 GB SSD | ~€3.79/mo |
| DigitalOcean Droplet | 1 vCPU / 1 GB RAM | $6/mo |
| Contabo VPS S | 4 vCPU / 8 GB RAM | ~€4.50/mo |
| Vultr Cloud Compute | 1 vCPU / 1 GB RAM | $6/mo |

**Minimum requirements:** 1 vCPU, 512 MB RAM, Ubuntu 22.04 LTS.
This app is very lightweight (pure Node.js + Google Sheets API) so even the smallest tier works.

---

## Troubleshooting

### Container won't start
```bash
docker compose logs rajac-backend
# Look for: "Authentication failed" → check GOOGLE_CLIENT_EMAIL / GOOGLE_PRIVATE_KEY in .env
# Look for: "EADDRINUSE" → another process on port 3000; change PORT in .env
```

### 502 Bad Gateway from Nginx
```bash
# Is the container running?
docker compose ps
# Is it listening on port 3000?
ss -tlnp | grep 3000
```

### CORS errors in browser console
- Make sure `https://rajac-fin.vercel.app` is in the `corsOptions.origin` array in `Backend/server.js`
- The current code already includes it; if your Vercel URL is different, add it

### Google Sheets API 403
- The service account email must have **Editor** access on the Google Sheet
- Open the sheet → Share → paste `GOOGLE_CLIENT_EMAIL` → Editor role

### Private key format error
- The `GOOGLE_PRIVATE_KEY` in `.env` must have `\n` (backslash-n) for every newline
- Run the Python3 formatting command in Step 3 to get the correct format
