#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)

export ULTRA_UI_RUNTIME="${ULTRA_UI_RUNTIME:-$BACKEND_DIR/runtime}"
export ULTRA_UI_LOG_DIR="${ULTRA_UI_LOG_DIR:-$BACKEND_DIR/runtime/logs}"
export ULTRA_UI_DB_PATH="${ULTRA_UI_DB_PATH:-$BACKEND_DIR/runtime/backend.sqlite3}"
export ULTRA_UI_HOST="${ULTRA_UI_HOST:-0.0.0.0}"
export ULTRA_UI_PORT="${ULTRA_UI_PORT:-18090}"

python3 -m uvicorn app.main:app --app-dir "$BACKEND_DIR" --host "$ULTRA_UI_HOST" --port "$ULTRA_UI_PORT"
