#!/bin/bash
set -euo pipefail

REPO_DIR="/opt/purpleiris"
COMPOSE_FILE="$REPO_DIR/docker/docker-compose.prod.yml"
ENV_FILE="$REPO_DIR/.env.local"

echo "→ Starting database..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d postgres redis

echo "→ Waiting for postgres to be healthy..."
until docker compose -f "$COMPOSE_FILE" ps postgres | grep -q "healthy"; do
  sleep 3
done

echo "→ Building containers..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" build --no-cache web indexer

echo "→ Installing dependencies for migrations..."
cd "$REPO_DIR"
npm install --ignore-scripts --prefer-offline 2>/dev/null || npm install --ignore-scripts

echo "→ Running database migrations..."
set -a; source "$ENV_FILE"; set +a
MIGRATION_URL="${DATABASE_URL//@postgres:/@localhost:}"
DATABASE_URL="$MIGRATION_URL" npx prisma migrate deploy

echo "→ Rolling restart..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --remove-orphans

echo "→ Cleaning old images..."
docker image prune -f

echo "✓ Deploy complete."
