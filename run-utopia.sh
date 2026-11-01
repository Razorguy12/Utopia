#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$ROOT/.utopia"
PGDATA="$STATE_DIR/postgres"
PGSOCKET="$STATE_DIR/socket"
PGPORT="${UTOPIA_DB_PORT:-55432}"
API_PORT="${API_PORT:-8001}"
WEB_PORT="${WEB_PORT:-5174}"

cd "$ROOT"
if [[ ! -f .env ]]; then
  umask 077
  printf 'POSTGRES_PASSWORD=%s\nJWT_SECRET=%s\n' "$(openssl rand -hex 32)" "$(openssl rand -hex 48)" > .env
fi
set -a
source .env
set +a
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required in .env}"
: "${JWT_SECRET:?JWT_SECRET is required in .env}"

mkdir -p "$STATE_DIR" "$PGSOCKET"
if [[ ! -s "$PGDATA/PG_VERSION" ]]; then
  initdb -D "$PGDATA" --username=postgres --auth-local=trust --auth-host=scram-sha-256
fi

if ! pg_isready -h 127.0.0.1 -p "$PGPORT" -q; then
  pg_ctl -D "$PGDATA" -l "$STATE_DIR/postgres.log" \
    -o "-h 127.0.0.1 -p $PGPORT -k $PGSOCKET" -w start
fi

psql -h "$PGSOCKET" -p "$PGPORT" -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -v db_password="$POSTGRES_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE civicgrid LOGIN PASSWORD %L', :'db_password')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'civicgrid')
\gexec
ALTER ROLE civicgrid WITH LOGIN PASSWORD :'db_password';
SELECT 'CREATE DATABASE civicgrid OWNER civicgrid'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'civicgrid')
\gexec
SQL

if [[ ! -x backend/.venv/bin/uvicorn ]]; then
  UV_CACHE_DIR="$STATE_DIR/uv-cache" uv venv --clear --python 3.12 backend/.venv
  UV_CACHE_DIR="$STATE_DIR/uv-cache" uv pip sync --python backend/.venv/bin/python backend/requirements.lock
fi

if [[ ! -d frontend/node_modules ]]; then
  (cd frontend && npm ci)
fi

export DATABASE_HOST=127.0.0.1 DATABASE_PORT="$PGPORT" DATABASE_NAME=civicgrid
export DATABASE_USER=civicgrid DATABASE_PASSWORD="$POSTGRES_PASSWORD" JWT_SECRET
export MEDIA_STORAGE_DIR="$STATE_DIR/uploads"
export API_PROXY_TARGET="http://127.0.0.1:$API_PORT"
mkdir -p "$STATE_DIR/logs"

cleanup() {
  trap - INT TERM EXIT
  [[ -n "${WEB_PID:-}" ]] && kill "$WEB_PID" 2>/dev/null || true
  [[ -n "${API_PID:-}" ]] && kill "$API_PID" 2>/dev/null || true
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

(cd frontend && npm run dev -- --host 0.0.0.0 --port "$WEB_PORT") >"$STATE_DIR/logs/web.log" 2>&1 &
WEB_PID=$!
(cd backend && exec .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port "$API_PORT") >"$STATE_DIR/logs/api.log" 2>&1 &
API_PID=$!

printf 'Utopia is starting. Web: http://localhost:%s  API: http://localhost:%s/docs\n' "$WEB_PORT" "$API_PORT"
printf 'Logs: %s/logs/  Stop with Ctrl-C. PostgreSQL data: %s/postgres\n' "$STATE_DIR" "$STATE_DIR"
wait -n "$WEB_PID" "$API_PID"
