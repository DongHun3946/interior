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
  echo "오류: Docker Engine과 Docker Compose 플러그인이 필요합니다." >&2
  exit 1
fi

if ! command_exists gzip; then
  echo "오류: gzip이 설치되어 있지 않습니다." >&2
  exit 1
fi

if [[ ! "$RETENTION_DAYS" =~ ^[1-9][0-9]*$ ]]; then
  echo "오류: DB_BACKUP_RETENTION_DAYS는 1 이상의 정수여야 합니다." >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "오류: 운영 Compose 파일을 찾을 수 없습니다: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "오류: 운영 환경 파일을 찾을 수 없습니다: $ENV_FILE" >&2
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

echo "DB 백업 완료: $BACKUP_FILE"
