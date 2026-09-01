#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.prod.yml"
ENV_FILE="$SCRIPT_DIR/.env.production"
BRANCH="${DEPLOY_BRANCH:-main}"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

if ! command_exists git; then
  echo "오류: Git이 설치되어 있지 않습니다." >&2
  exit 1
fi

if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
  echo "오류: Docker Engine과 Docker Compose 플러그인이 필요합니다." >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "오류: Docker 데몬에 연결할 수 없습니다." >&2
  echo "SSH에 다시 로그인했는지, Docker 서비스가 실행 중인지 확인하세요." >&2
  exit 1
fi

if [[ ! -d "$SCRIPT_DIR/.git" ]]; then
  echo "오류: 프로젝트가 Git 저장소가 아닙니다: $SCRIPT_DIR" >&2
  exit 1
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "오류: 운영 Compose 파일을 찾을 수 없습니다: $COMPOSE_FILE" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "오류: 운영 환경 파일을 찾을 수 없습니다: $ENV_FILE" >&2
  echo "먼저 cp .env.production.example .env.production 을 실행하고 값을 설정하세요." >&2
  exit 1
fi

cd "$SCRIPT_DIR"

if [[ "${RUN_PRODUCTION_AFTER_PULL:-0}" != "1" ]]; then
  current_branch="$(git branch --show-current)"
  if [[ "$current_branch" != "$BRANCH" ]]; then
    echo "오류: 현재 브랜치가 $BRANCH 이 아닙니다: $current_branch" >&2
    exit 1
  fi

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "오류: 서버 저장소의 추적 파일에 커밋되지 않은 변경사항이 있습니다." >&2
    echo "git status --short 로 확인한 뒤 변경사항을 정리하세요." >&2
    exit 1
  fi

  echo "[업데이트] origin/$BRANCH 의 최신 코드를 가져옵니다."
  git pull --ff-only origin "$BRANCH"

  exec env RUN_PRODUCTION_AFTER_PULL=1 DEPLOY_BRANCH="$BRANCH" bash "$SCRIPT_DIR/run-production.sh"
fi

echo "[검증] 운영 환경과 Docker Compose 구성을 확인합니다."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" config --quiet

echo "[배포] 운영 이미지를 빌드하고 컨테이너를 갱신합니다."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up \
  -d \
  --build \
  --remove-orphans \
  --wait \
  --wait-timeout 180

echo "[완료] 운영 컨테이너 상태입니다."
docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps
