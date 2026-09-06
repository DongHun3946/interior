#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="${INTERIOR_PROJECT_DIR:-/home/ubuntu/interior}"
COMPOSE_FILE="$PROJECT_DIR/docker-compose.prod.yml"
ENV_FILE="$PROJECT_DIR/.env.production"
BACKUP_DIR="${DB_BACKUP_DIR:-/home/ubuntu/backups/interior-db}"
BACKUP_FILE="${1:-}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
SAFETY_BACKUP="$BACKUP_DIR/pre-restore-$TIMESTAMP.sql.gz"
SAFETY_TEMP=""
BACKEND_STOPPED=0
RESTORE_SUCCEEDED=0

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
  if [[ "$BACKEND_STOPPED" == "1" && "$RESTORE_SUCCEEDED" != "1" ]]; then
    "${COMPOSE[@]}" stop backend >/dev/null 2>&1 || true
    echo "Error: Restore did not complete. The backend remains stopped." >&2
    if [[ -f "$SAFETY_BACKUP" ]]; then
      echo "Pre-restore safety backup: $SAFETY_BACKUP" >&2
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

if [[ -z "$BACKUP_FILE" ]]; then
  shopt -s nullglob
  BACKUP_FILES=("$BACKUP_DIR"/interior-*.sql.gz)
  shopt -u nullglob
  if (( ${#BACKUP_FILES[@]} == 0 )); then
    echo "Error: No restore backup files found in: $BACKUP_DIR" >&2
    exit 1
  fi
  mapfile -t BACKUP_FILES < <(
    printf '%s\n' "${BACKUP_FILES[@]}" | sort -r
  )

  echo "Select a backup file to restore to the production database:"
  for index in "${!BACKUP_FILES[@]}"; do
    printf '  %d) %s\n' \
      "$((index + 1))" \
      "$(basename -- "${BACKUP_FILES[$index]}")"
  done
  printf '  q) Cancel\n'

  if ! read -r -p "Enter a number: " SELECTION; then
    echo "Error: Could not read the backup selection." >&2
    exit 1
  fi
  if [[ "$SELECTION" == "q" || "$SELECTION" == "Q" ]]; then
    echo "Production database restore canceled."
    exit 0
  fi
  if [[ ! "$SELECTION" =~ ^[1-9][0-9]*$ ]] \
    || (( 10#$SELECTION > ${#BACKUP_FILES[@]} )); then
    echo "Error: Enter a valid backup number." >&2
    exit 1
  fi
  BACKUP_FILE="${BACKUP_FILES[$((10#$SELECTION - 1))]}"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "Error: Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi

echo "Checking backup integrity: $BACKUP_FILE"
gzip -t "$BACKUP_FILE"

PRODUCTION_DB="$(
  "${COMPOSE[@]}" exec -T db sh -c 'printf %s "$POSTGRES_DB"'
)"
if [[ -z "$PRODUCTION_DB" ]]; then
  echo "Error: Could not determine the production database name." >&2
  exit 1
fi

echo
echo "WARNING: This will replace all current data in production database '$PRODUCTION_DB'."
echo "Selected backup: $BACKUP_FILE"
read -r -p "Type RESTORE $PRODUCTION_DB to continue: " CONFIRMATION
if [[ "$CONFIRMATION" != "RESTORE $PRODUCTION_DB" ]]; then
  echo "Confirmation did not match. Production database restore canceled."
  exit 0
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
SAFETY_TEMP="$(mktemp "$BACKUP_DIR/.pre-restore-$TIMESTAMP.XXXXXX.sql.gz")"

echo "Creating a safety backup of the current production database."
"${COMPOSE[@]}" exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -c > "$SAFETY_TEMP"
mv -- "$SAFETY_TEMP" "$SAFETY_BACKUP"
SAFETY_TEMP=""
chmod 600 "$SAFETY_BACKUP"
echo "Pre-restore safety backup: $SAFETY_BACKUP"

echo "Stopping the backend service."
"${COMPOSE[@]}" stop backend
BACKEND_STOPPED=1

echo "Recreating the production database: $PRODUCTION_DB"
"${COMPOSE[@]}" exec -T db \
  sh -c 'dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T db \
  sh -c 'createdb -T template0 -O "$POSTGRES_USER" -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "Restoring the selected backup to the production database."
gzip -dc "$BACKUP_FILE" \
  | "${COMPOSE[@]}" exec -T db \
    sh -c \
    'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "Updating database statistics."
"${COMPOSE[@]}" exec -T db \
  sh -c \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ANALYZE;"'

echo "Starting the backend service."
"${COMPOSE[@]}" up -d --wait backend
BACKEND_STOPPED=0
RESTORE_SUCCEEDED=1

echo "Production database restore completed."
echo "Restored backup: $BACKUP_FILE"
echo "Pre-restore safety backup: $SAFETY_BACKUP"
