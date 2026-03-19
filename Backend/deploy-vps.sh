#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# RAJAC Finance Backend — VPS Deploy Script  (updated 2026-03-19)
# Run this ON the VPS: ssh Dessouky@128.140.65.42, then bash deploy-vps.sh
#
#   chmod +x deploy-vps.sh
#   ./deploy-vps.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

echo "==> Pulling latest code..."
git pull origin main

echo "==> Rebuilding Docker image..."
docker compose build --no-cache

echo "==> Stopping old container (if running)..."
docker compose down --remove-orphans || true

echo "==> Starting container..."
docker compose up -d

echo "==> Waiting for health check..."
sleep 5
docker compose ps

echo ""
echo "✓ Deploy complete."
echo "  Backend is running on http://127.0.0.1:3000"
echo "  Check logs: docker compose logs -f rajac-backend"
