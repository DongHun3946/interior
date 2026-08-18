#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/.env}"
ACTION="${1:-start}"

if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
  echo "오류: Docker와 Docker Compose가 필요합니다." >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "오류: 환경설정 파일을 찾을 수 없습니다: $ENV_FILE" >&2
  echo "먼저 'cp .env.example .env'를 실행하고 DB 설정값을 수정하세요." >&2
  exit 1
fi

COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE")

case "$ACTION" in
  start|up)
    echo "[PostgreSQL] 컨테이너를 시작하고 healthcheck를 기다립니다."
    "${COMPOSE[@]}" up -d --wait db
    "${COMPOSE[@]}" ps db
    ;;
  stop)
    echo "[PostgreSQL] 컨테이너를 중지합니다. 데이터 볼륨은 유지됩니다."
    "${COMPOSE[@]}" stop db
    ;;
  restart)
    echo "[PostgreSQL] 컨테이너를 재시작합니다."
    "${COMPOSE[@]}" stop db
    "${COMPOSE[@]}" up -d --wait db
    "${COMPOSE[@]}" ps db
    ;;
  status|ps)
    "${COMPOSE[@]}" ps db
    ;;
  logs)
    "${COMPOSE[@]}" logs -f db
    ;;
  *)
    echo "사용법: bash ./postgres.sh {start|stop|restart|status|logs}" >&2
    exit 2
    ;;
esac
