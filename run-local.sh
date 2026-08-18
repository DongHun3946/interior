#!/usr/bin/env bash

set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"

BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

if [[ -f "$SCRIPT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$SCRIPT_DIR/.env"
  set +a
fi

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

validate_port() {
  local port="$1"
  local name="$2"
  if [[ ! "$port" =~ ^[0-9]+$ ]] || ((port < 1 || port > 65535)); then
    echo "오류: $name 포트가 올바르지 않습니다: $port" >&2
    exit 1
  fi
}

release_port() {
  local port="$1"
  local name="$2"

  if command_exists powershell.exe; then
    echo "[정리] $name 포트 $port 의 이전 프로세스를 확인합니다."
    TARGET_PORT="$port" TARGET_NAME="$name" powershell.exe -NoProfile -NonInteractive -Command '
      $port = [int]$env:TARGET_PORT
      $name = $env:TARGET_NAME
      $connections = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)
      $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique | Where-Object { $_ -gt 0 })

      foreach ($processId in $processIds) {
        & taskkill.exe /PID $processId /T /F 2>$null | Out-Null
        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      }

      for ($attempt = 0; $attempt -lt 20; $attempt++) {
        if (-not (Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue)) {
          exit 0
        }
        Start-Sleep -Milliseconds 250
      }

      $remaining = @(Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique)
      Write-Error "$name 포트 $port 을 해제하지 못했습니다. 남은 PID: $($remaining -join ", ")"
      exit 1
    '
  elif command_exists lsof; then
    local process_ids
    process_ids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$process_ids" ]]; then
      echo "[정리] $name 포트 $port 의 이전 프로세스를 종료합니다."
      kill $process_ids 2>/dev/null || true
      sleep 1
      process_ids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
      [[ -n "$process_ids" ]] && kill -9 $process_ids 2>/dev/null || true
    fi
    if lsof -tiTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "오류: $name 포트 $port 을 해제하지 못했습니다." >&2
      return 1
    fi
  else
    echo "오류: 포트 정리를 위해 PowerShell 또는 lsof가 필요합니다." >&2
    return 1
  fi
}

if ! command_exists uv; then
  echo "오류: Python 의존성 관리를 위한 uv가 필요합니다." >&2
  echo "설치 방법: https://docs.astral.sh/uv/getting-started/installation/" >&2
  exit 1
fi

if ! command_exists npm; then
  echo "오류: Node.js와 npm이 필요합니다." >&2
  exit 1
fi

if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
  echo "오류: 로컬 PostgreSQL 실행을 위한 Docker Compose가 필요합니다." >&2
  exit 1
fi

validate_port "$BACKEND_PORT" "백엔드"
validate_port "$FRONTEND_PORT" "프론트엔드"
if [[ "$BACKEND_PORT" == "$FRONTEND_PORT" ]]; then
  echo "오류: 백엔드와 프론트엔드 포트가 같습니다: $BACKEND_PORT" >&2
  exit 1
fi

release_port "$BACKEND_PORT" "백엔드"
release_port "$FRONTEND_PORT" "프론트엔드"

POSTGRES_DB="${POSTGRES_DB:-interior}"
POSTGRES_USER="${POSTGRES_USER:-interior}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-interior}"

DB_STARTED_BY_SCRIPT=false
if [[ -z "$(docker compose -f "$SCRIPT_DIR/docker-compose.yml" ps --status running -q db)" ]]; then
  DB_STARTED_BY_SCRIPT=true
fi

echo "[준비] PostgreSQL을 실행하고 연결을 기다립니다."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" up -d --wait db

echo "[준비] uv로 백엔드 환경을 동기화합니다."
uv sync --project "$BACKEND_DIR"

if [[ -z "${LOCAL_DATABASE_URL:-}" ]]; then
  LOCAL_DATABASE_URL="$(
    POSTGRES_DB="$POSTGRES_DB" \
    POSTGRES_USER="$POSTGRES_USER" \
    POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
    POSTGRES_PORT="$POSTGRES_PORT" \
      uv run --project "$BACKEND_DIR" --no-sync python -c '
import os
from sqlalchemy.engine import URL

print(URL.create(
    "postgresql+psycopg2",
    username=os.environ["POSTGRES_USER"],
    password=os.environ["POSTGRES_PASSWORD"],
    host="127.0.0.1",
    port=int(os.environ["POSTGRES_PORT"]),
    database=os.environ["POSTGRES_DB"],
).render_as_string(hide_password=False))
'
  )"
fi

if [[ ! -x "$FRONTEND_DIR/node_modules/.bin/vite" ]] || \
   [[ ! -f "$FRONTEND_DIR/node_modules/react/cjs/react.development.js" ]] || \
   [[ ! -f "$FRONTEND_DIR/node_modules/lucide-react/dist/esm/icons/index.js" ]]; then
  echo "[준비] 프론트엔드 패키지를 설치합니다."
  (cd "$FRONTEND_DIR" && npm ci)
fi

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
  trap - EXIT INT TERM
  echo
  echo "[종료] 로컬 서버를 종료합니다."
  if command -v taskkill.exe >/dev/null 2>&1; then
    [[ -n "$FRONTEND_PID" ]] && taskkill.exe //PID "$FRONTEND_PID" //T //F >/dev/null 2>&1 || true
    [[ -n "$BACKEND_PID" ]] && taskkill.exe //PID "$BACKEND_PID" //T //F >/dev/null 2>&1 || true
  else
    [[ -n "$FRONTEND_PID" ]] && kill "$FRONTEND_PID" 2>/dev/null || true
    [[ -n "$BACKEND_PID" ]] && kill "$BACKEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  release_port "$BACKEND_PORT" "백엔드" >/dev/null 2>&1 || true
  release_port "$FRONTEND_PORT" "프론트엔드" >/dev/null 2>&1 || true
  if [[ "$DB_STARTED_BY_SCRIPT" == true ]]; then
    docker compose -f "$SCRIPT_DIR/docker-compose.yml" stop db >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

echo "[실행] 백엔드: http://localhost:$BACKEND_PORT"
(
  cd "$BACKEND_DIR"
  DATABASE_URL="$LOCAL_DATABASE_URL" \
  CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:$FRONTEND_PORT}" \
  NAVER_MAPS_CLIENT_ID="${NAVER_MAPS_CLIENT_ID:-}" \
  NAVER_MAPS_CLIENT_SECRET="${NAVER_MAPS_CLIENT_SECRET:-}" \
    uv run --no-sync uvicorn app.main:app \
      --reload --host 0.0.0.0 --port "$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "[실행] 웹 사이트: http://localhost:$FRONTEND_PORT"
(
  cd "$FRONTEND_DIR"
  VITE_API_URL="${VITE_API_URL:-http://localhost:$BACKEND_PORT}" \
  VITE_NAVER_MAP_KEY_ID="${NAVER_MAPS_CLIENT_ID:-}" \
    npm run dev -- --host 0.0.0.0 --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

echo
echo "브라우저에서 http://localhost:$FRONTEND_PORT 을 여세요."
echo "종료하려면 Ctrl+C를 누르세요."

wait -n "$BACKEND_PID" "$FRONTEND_PID"
