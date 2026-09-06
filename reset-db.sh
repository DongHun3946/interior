#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="${INTERIOR_PROJECT_DIR:-/home/ubuntu/interior}"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"
BACKUP_DIR="${DB_BACKUP_DIR:-/home/ubuntu/backups/interior-db}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SAFETY_BACKUP="$BACKUP_DIR/pre-reset-$TIMESTAMP.sql.gz"
SAFETY_TEMP=""
BACKEND_STOPPED=0
RESET_SUCCEEDED=0

COMPOSE=(
  docker compose
  --env-file "$ENV_FILE"
  -f "$COMPOSE_FILE"
)

cleanup() {
  local exit_code=$?
  if [[ -n "$SAFETY_TEMP" && -f "$SAFETY_TEMP" ]]; then
    rm -f -- "$SAFETY_TEMP"
  fi
  if [[ "$BACKEND_STOPPED" == "1" && "$RESET_SUCCEEDED" != "1" ]]; then
    "${COMPOSE[@]}" stop backend >/dev/null 2>&1 || true
    echo "Error: Reset did not complete. The backend remains stopped." >&2
    if [[ -f "$SAFETY_BACKUP" ]]; then
      echo "Pre-reset safety backup: $SAFETY_BACKUP" >&2
    fi
  fi
  exit "$exit_code"
}
trap cleanup EXIT

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "Error: Production Compose file not found: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Error: Production environment file not found: $ENV_FILE" >&2
  exit 1
fi

if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
  echo "Error: Docker Engine and the Docker Compose plugin are required." >&2
  exit 1
fi

if ! command_exists gzip; then
  echo "Error: gzip is not installed." >&2
  exit 1
fi

PRODUCTION_DB="$(
  "${COMPOSE[@]}" exec -T db sh -c 'printf %s "$POSTGRES_DB"'
)"
if [[ -z "$PRODUCTION_DB" ]]; then
  echo "Error: Could not determine the production database name." >&2
  exit 1
fi

echo
echo "WARNING: This will delete all data in production database '$PRODUCTION_DB'."
echo "A safety backup will be created immediately before the reset."
read -r -p "Type RESET $PRODUCTION_DB to continue: " CONFIRMATION
if [[ "$CONFIRMATION" != "RESET $PRODUCTION_DB" ]]; then
  echo "Confirmation did not match. Production database reset canceled."
  exit 0
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
SAFETY_TEMP="$(mktemp "$BACKUP_DIR/.pre-reset-$TIMESTAMP.XXXXXX.sql.gz")"

echo "Creating a safety backup of the current production database."
"${COMPOSE[@]}" exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -c > "$SAFETY_TEMP"
mv -- "$SAFETY_TEMP" "$SAFETY_BACKUP"
SAFETY_TEMP=""
chmod 600 "$SAFETY_BACKUP"
echo "Pre-reset safety backup: $SAFETY_BACKUP"

echo "Stopping the backend service."
"${COMPOSE[@]}" stop backend
BACKEND_STOPPED=1

echo "Recreating the production database as an empty database: $PRODUCTION_DB"
"${COMPOSE[@]}" exec -T db \
  sh -c 'dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T db \
  sh -c 'createdb -T template0 -O "$POSTGRES_USER" -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "Starting the backend to initialize the schema and administrator account."
"${COMPOSE[@]}" up -d --wait backend
BACKEND_STOPPED=0
RESET_SUCCEEDED=1

echo "Production database reset completed."
echo "Pre-reset safety backup: $SAFETY_BACKUP"
