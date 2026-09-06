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
    echo "오류: 초기화가 완료되지 않아 백엔드를 중지 상태로 유지합니다." >&2
    if [[ -f "$SAFETY_BACKUP" ]]; then
      echo "초기화 직전 긴급 백업: $SAFETY_BACKUP" >&2
    fi
  fi
  exit "$exit_code"
}
trap cleanup EXIT

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "오류: 운영 Compose 파일을 찾을 수 없습니다: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "오류: 운영 환경 파일을 찾을 수 없습니다: $ENV_FILE" >&2
  exit 1
fi

if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
  echo "오류: Docker Engine과 Docker Compose 플러그인이 필요합니다." >&2
  exit 1
fi

if ! command_exists gzip; then
  echo "오류: gzip이 설치되어 있지 않습니다." >&2
  exit 1
fi

PRODUCTION_DB="$(
  "${COMPOSE[@]}" exec -T db sh -c 'printf %s "$POSTGRES_DB"'
)"
if [[ -z "$PRODUCTION_DB" ]]; then
  echo "오류: 운영 DB 이름을 확인하지 못했습니다." >&2
  exit 1
fi

echo
echo "경고: 운영 DB '$PRODUCTION_DB'의 모든 데이터가 삭제됩니다."
echo "현재 데이터는 초기화 직전에 긴급 백업으로 보관됩니다."
read -r -p "계속하려면 RESET $PRODUCTION_DB 를 입력하세요: " CONFIRMATION
if [[ "$CONFIRMATION" != "RESET $PRODUCTION_DB" ]]; then
  echo "입력값이 일치하지 않아 운영 DB 초기화를 취소했습니다."
  exit 0
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
SAFETY_TEMP="$(mktemp "$BACKUP_DIR/.pre-reset-$TIMESTAMP.XXXXXX.sql.gz")"

echo "현재 운영 DB의 긴급 백업을 생성합니다."
"${COMPOSE[@]}" exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -c > "$SAFETY_TEMP"
mv -- "$SAFETY_TEMP" "$SAFETY_BACKUP"
SAFETY_TEMP=""
chmod 600 "$SAFETY_BACKUP"
echo "초기화 직전 긴급 백업: $SAFETY_BACKUP"

echo "백엔드 서비스를 중지합니다."
"${COMPOSE[@]}" stop backend
BACKEND_STOPPED=1

echo "운영 DB를 빈 상태로 재생성합니다: $PRODUCTION_DB"
"${COMPOSE[@]}" exec -T db \
  sh -c 'dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T db \
  sh -c 'createdb -T template0 -O "$POSTGRES_USER" -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "백엔드를 시작하고 스키마 및 관리자 계정을 생성합니다."
"${COMPOSE[@]}" up -d --wait backend
BACKEND_STOPPED=0
RESET_SUCCEEDED=1

echo "운영 DB 초기화가 완료됐습니다."
echo "초기화 직전 긴급 백업: $SAFETY_BACKUP"
