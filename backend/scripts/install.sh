#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
BACKEND_DIR=$(cd -- "$SCRIPT_DIR/.." && pwd)
INSTALL_ROOT=${ULTRA_UI_INSTALL_ROOT:-/opt/ultra-ui-ubuntu-backend}
RUNTIME_DIR=${ULTRA_UI_RUNTIME:-/var/lib/ultra-ui-ubuntu/runtime}
LOG_DIR=${ULTRA_UI_LOG_DIR:-/var/log/ultra-ui-ubuntu}
ENV_DIR=/etc/ultra-ui-ubuntu
ENV_FILE=${ULTRA_UI_AGENT_ENV:-$ENV_DIR/agent.env}
SERVICE_NAME=${ULTRA_UI_SERVICE_NAME:-ultra-ui-ubuntu-backend}
PYTHON_BIN=${PYTHON_BIN:-/usr/bin/python3}
SERVICE_TEMPLATE=${ULTRA_UI_SERVICE_TEMPLATE:-$BACKEND_DIR/deploy/ultra-ui-ubuntu-backend.service}

if ! command -v sudo >/dev/null 2>&1; then
  sudo() { "$@"; }
fi

sudo mkdir -p "$INSTALL_ROOT" "$RUNTIME_DIR" "$LOG_DIR" "$ENV_DIR"
sudo rsync -a --delete "$BACKEND_DIR/" "$INSTALL_ROOT/"

if [[ ! -d "$INSTALL_ROOT/.venv" ]]; then
  sudo "$PYTHON_BIN" -m venv "$INSTALL_ROOT/.venv"
fi

sudo "$INSTALL_ROOT/.venv/bin/pip" install --upgrade pip
sudo "$INSTALL_ROOT/.venv/bin/pip" install -r "$INSTALL_ROOT/requirements.txt"

if [[ ! -f "$ENV_FILE" ]]; then
  sudo tee "$ENV_FILE" >/dev/null <<ENV
ULTRA_UI_HOST=0.0.0.0
ULTRA_UI_PORT=18090
ULTRA_UI_RUNTIME=$RUNTIME_DIR
ULTRA_UI_LOG_DIR=$LOG_DIR
ULTRA_UI_DB_PATH=$RUNTIME_DIR/backend.sqlite3
ULTRA_UI_SSL_CHECK_INTERVAL_SECS=14400
ULTRA_UI_CORS_ALLOW_ALL=1
MIHOMO_LOG_FILE=/var/log/mihomo/mihomo.log
ENV
else
  if sudo grep -q '^ULTRA_UI_HOST=127\.0\.0\.1$' "$ENV_FILE"; then
    sudo sed -i 's/^ULTRA_UI_HOST=127\.0\.0\.1$/ULTRA_UI_HOST=0.0.0.0/' "$ENV_FILE"
  fi
fi

sudo cp "$SERVICE_TEMPLATE" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload
sudo systemctl enable --now "$SERVICE_NAME"
sudo systemctl status "$SERVICE_NAME" --no-pager || true
