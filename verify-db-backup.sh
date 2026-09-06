#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env.production"
BACKUP_FILE="${1:-}"
TEST_DB="interior_restore_check_$(date +%Y%m%d%H%M%S)"
TEST_DB_CREATED=0

COMPOSE=(
  docker compose
  --env-file "$ENV_FILE"
  -f "$COMPOSE_FILE"
)

cleanup() {
  if [[ "$TEST_DB_CREATED" != "1" ]]; then
    return
  fi
  if [[ ! "$TEST_DB" =~ ^interior_restore_check_[0-9]{14}$ ]]; then
    echo "오류: 안전하지 않은 임시 DB 이름이므로 자동 삭제하지 않습니다: $TEST_DB" >&2
    return
  fi
  echo "임시 검증 DB를 삭제합니다: $TEST_DB"
  "${COMPOSE[@]}" exec -T \
    -e TEST_DB="$TEST_DB" \
    db sh -c \
    'dropdb --if-exists --force -U "$POSTGRES_USER" "$TEST_DB"' \
    >/dev/null 2>&1 || true
}
trap cleanup EXIT

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if [[ -z "$BACKUP_FILE" ]]; then
  echo "사용법: $0 /백업파일/경로.sql.gz" >&2
  exit 1
fi

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "오류: 백업 파일을 찾을 수 없습니다: $BACKUP_FILE" >&2
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

if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
  echo "오류: Docker Engine과 Docker Compose 플러그인이 필요합니다." >&2
  exit 1
fi

if ! command_exists gzip; then
  echo "오류: gzip이 설치되어 있지 않습니다." >&2
  exit 1
fi

echo "압축 파일을 검사합니다: $BACKUP_FILE"
gzip -t "$BACKUP_FILE"

echo "빈 임시 DB를 생성합니다: $TEST_DB"
"${COMPOSE[@]}" exec -T \
  -e TEST_DB="$TEST_DB" \
  db sh -c \
  'createdb -U "$POSTGRES_USER" "$TEST_DB"'
TEST_DB_CREATED=1

echo "백업을 임시 DB에 복원합니다."
gzip -dc "$BACKUP_FILE" \
  | "${COMPOSE[@]}" exec -T \
    -e TEST_DB="$TEST_DB" \
    db sh -c \
    'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$TEST_DB"'

echo "복원된 주요 데이터 건수를 확인합니다."
"${COMPOSE[@]}" exec -T \
  -e TEST_DB="$TEST_DB" \
  db sh -c \
  'psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$TEST_DB"' <<'SQL'
SELECT 'projects' AS table_name, COUNT(*) AS row_count FROM projects
UNION ALL
SELECT 'estimate_inquiries', COUNT(*) FROM estimate_inquiries
UNION ALL
SELECT 'estimate_documents', COUNT(*) FROM estimate_documents
UNION ALL
SELECT 'payments', COUNT(*) FROM payments
ORDER BY table_name;
SQL

echo "백업 복원 검증이 완료됐습니다."
