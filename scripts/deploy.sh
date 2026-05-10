#!/bin/bash
set -euo pipefail

REPO_DIR="/opt/purpleiris"
COMPOSE_FILE="$REPO_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.local"

echo "→ Pulling latest code..."
cd "$REPO_DIR"
git pull origin main

echo "→ Building containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache web indexer

echo "→ Running database migrations..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" run --rm web npx prisma migrate deploy

echo "→ Rolling restart (zero-downtime)..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

echo "→ Cleaning old images..."
docker image prune -f

echo "✓ Deploy complete."
