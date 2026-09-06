#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="${INTERIOR_PROJECT_DIR:-/home/ubuntu/interior}"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"
BACKUP_DIR="${DB_BACKUP_DIR:-/home/ubuntu/backups/interior-db}"
RETENTION_DAYS="${DB_BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BACKUP_FILE="$BACKUP_DIR/interior-$TIMESTAMP.sql.gz"
TEMP_FILE=""

cleanup() {
  if [[ -n "$TEMP_FILE" && -f "$TEMP_FILE" ]]; then
    rm -f -- "$TEMP_FILE"
  fi
}
trap cleanup EXIT

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Engine and the Docker Compose plugin are required." >&2
  exit 1
fi

if ! command_exists gzip; then
  echo "Error: gzip is not installed." >&2
  exit 1
fi

if [[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "Error: DB_BACKUP_RETENTION_DAYS must be a positive integer." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: Production Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
TEMP_FILE="$(mktemp "$BACKUP_DIR/.interior-$TIMESTAMP.XXXXXX.sql.gz")"

cd "$PROJECT_DIR"

docker compose \
  --env-file "$ENV_FILE" \
  -f "$COMPOSE_FILE" \
  exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -c > "$TEMP_FILE"

mv -- "$TEMP_FILE" "$BACKUP_FILE"
TEMP_FILE=""
chmod 600 "$BACKUP_FILE"

find "$BACKUP_DIR" \
  -type f \
  -name 'interior-*.sql.gz' \
  -mtime "+$((RETENTION_DAYS - 1))" \
  -delete

echo "Database backup completed: $BACKUP_FILE"
