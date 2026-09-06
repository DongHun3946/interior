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
    echo "오류: 복원이 완료되지 않아 백엔드를 중지 상태로 유지합니다." >&2
    if [[ -f "$SAFETY_BACKUP" ]]; then
      echo "복원 직전 긴급 백업: $SAFETY_BACKUP" >&2
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

if [[ -z "$BACKUP_FILE" ]]; then
  shopt -s nullglob
  BACKUP_FILES=("$BACKUP_DIR"/interior-*.sql.gz)
  shopt -u nullglob
  if (( ${#BACKUP_FILES[@]} == 0 )); then
    echo "오류: 복원할 백업 파일이 없습니다: $BACKUP_DIR" >&2
    exit 1
  fi
  mapfile -t BACKUP_FILES < <(
    printf '%s\n' "${BACKUP_FILES[@]}" | sort -r
  )

  echo "운영 DB에 복원할 백업 파일을 선택하세요."
  for index in "${!BACKUP_FILES[@]}"; do
    printf '  %d) %s\n' \
      "$((index + 1))" \
      "$(basename -- "${BACKUP_FILES[$index]}")"
  done
  printf '  q) 취소\n'

  if ! read -r -p "번호를 입력하세요: " SELECTION; then
    echo "오류: 백업 파일 선택값을 읽지 못했습니다." >&2
    exit 1
  fi
  if [[ "$SELECTION" == "q" || "$SELECTION" == "Q" ]]; then
    echo "운영 DB 복원을 취소했습니다."
    exit 0
  fi
  if [[ ! "$SELECTION" =~ ^[1-9][0-9]*$ ]] \
    || (( 10#$SELECTION > ${#BACKUP_FILES[@]} )); then
    echo "오류: 올바른 백업 번호를 입력하세요." >&2
    exit 1
  fi
  BACKUP_FILE="${BACKUP_FILES[$((10#$SELECTION - 1))]}"
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "오류: 백업 파일을 찾을 수 없습니다: $BACKUP_FILE" >&2
  exit 1
fi

echo "백업 압축 파일을 검사합니다: $BACKUP_FILE"
gzip -t "$BACKUP_FILE"

PRODUCTION_DB="$(
  "${COMPOSE[@]}" exec -T db sh -c 'printf %s "$POSTGRES_DB"'
)"
if [[ -z "$PRODUCTION_DB" ]]; then
  echo "오류: 운영 DB 이름을 확인하지 못했습니다." >&2
  exit 1
fi

echo
echo "경고: 운영 DB '$PRODUCTION_DB'의 현재 내용이 선택한 백업 시점으로 교체됩니다."
echo "선택한 백업: $BACKUP_FILE"
read -r -p "계속하려면 RESTORE $PRODUCTION_DB 를 입력하세요: " CONFIRMATION
if [[ "$CONFIRMATION" != "RESTORE $PRODUCTION_DB" ]]; then
  echo "입력값이 일치하지 않아 운영 DB 복원을 취소했습니다."
  exit 0
fi

mkdir -p -- "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
umask 077
SAFETY_TEMP="$(mktemp "$BACKUP_DIR/.pre-restore-$TIMESTAMP.XXXXXX.sql.gz")"

echo "현재 운영 DB의 긴급 백업을 생성합니다."
"${COMPOSE[@]}" exec -T db \
  sh -c 'exec pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' \
  | gzip -c > "$SAFETY_TEMP"
mv -- "$SAFETY_TEMP" "$SAFETY_BACKUP"
SAFETY_TEMP=""
chmod 600 "$SAFETY_BACKUP"
echo "복원 직전 긴급 백업: $SAFETY_BACKUP"

echo "백엔드 서비스를 중지합니다."
"${COMPOSE[@]}" stop backend
BACKEND_STOPPED=1

echo "운영 DB를 재생성합니다: $PRODUCTION_DB"
"${COMPOSE[@]}" exec -T db \
  sh -c 'dropdb --if-exists --force -U "$POSTGRES_USER" "$POSTGRES_DB"'
"${COMPOSE[@]}" exec -T db \
  sh -c 'createdb -T template0 -O "$POSTGRES_USER" -U "$POSTGRES_USER" "$POSTGRES_DB"'

echo "선택한 백업을 운영 DB에 복원합니다."
gzip -dc "$BACKUP_FILE" \
  | "${COMPOSE[@]}" exec -T db \
    sh -c \
    'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

echo "DB 통계를 갱신합니다."
"${COMPOSE[@]}" exec -T db \
  sh -c \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "ANALYZE;"'

echo "백엔드 서비스를 시작합니다."
"${COMPOSE[@]}" up -d --wait backend
BACKEND_STOPPED=0
RESTORE_SUCCEEDED=1

echo "운영 DB 복원이 완료됐습니다."
echo "적용한 백업: $BACKUP_FILE"
echo "복원 직전 긴급 백업: $SAFETY_BACKUP"
