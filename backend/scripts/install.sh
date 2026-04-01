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
MIHOMO_CONFIG_DEFAULT=/etc/mihomo/config.yaml

if ! command -v sudo >/dev/null 2>&1; then
  sudo() { "$@"; }
fi

sanitize_yaml_scalar() {
  local value=${1:-}
  local dq='"'
  local sq="'"
  value="${value#$dq}"
  value="${value%$dq}"
  value="${value#$sq}"
  value="${value%$sq}"
  printf '%s' "$value"
}

read_mihomo_yaml_value() {
  local key=$1
  local file=$2
  [[ -f "$file" ]] || return 0
  local line
  line=$(sudo awk -F': *' -v key="$key" '$1 == key {print substr($0, index($0, ":") + 1); exit}' "$file" 2>/dev/null || true)
  line=$(printf '%s' "$line" | sed 's/#.*$//' | xargs)
  sanitize_yaml_scalar "$line"
}

ensure_env_kv() {
  local key=$1
  local value=$2
  local file=$3
  if sudo grep -q "^${key}=" "$file"; then
    sudo sed -i "s|^${key}=.*$|${key}=${value}|" "$file"
  else
    printf '%s=%s\n' "$key" "$value" | sudo tee -a "$file" >/dev/null
  fi
}

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
ULTRA_UI_SSL_WARN_DAYS=2
ULTRA_UI_CORS_ALLOW_ALL=1
MIHOMO_LOG_FILE=/var/log/mihomo/mihomo.log
MIHOMO_ACTIVE_CONFIG=/etc/mihomo/config.yaml
ENV
else
  if sudo grep -q '^ULTRA_UI_HOST=127\.0\.0\.1$' "$ENV_FILE"; then
    sudo sed -i 's/^ULTRA_UI_HOST=127\.0\.0\.1$/ULTRA_UI_HOST=0.0.0.0/' "$ENV_FILE"
  fi
  if ! sudo grep -q '^MIHOMO_ACTIVE_CONFIG=' "$ENV_FILE"; then
    echo 'MIHOMO_ACTIVE_CONFIG=/etc/mihomo/config.yaml' | sudo tee -a "$ENV_FILE" >/dev/null
  fi
  if ! sudo grep -q '^ULTRA_UI_SSL_WARN_DAYS=' "$ENV_FILE"; then
    echo 'ULTRA_UI_SSL_WARN_DAYS=2' | sudo tee -a "$ENV_FILE" >/dev/null
  fi
fi

MIHOMO_CONFIG_PATH=$(read_mihomo_yaml_value MIHOMO_ACTIVE_CONFIG "$ENV_FILE")
if [[ -z "$MIHOMO_CONFIG_PATH" ]]; then
  MIHOMO_CONFIG_PATH=$MIHOMO_CONFIG_DEFAULT
fi
DETECTED_CONTROLLER=$(read_mihomo_yaml_value external-controller "$MIHOMO_CONFIG_PATH")
DETECTED_SECRET=$(read_mihomo_yaml_value secret "$MIHOMO_CONFIG_PATH")
if [[ -n "$DETECTED_CONTROLLER" && "$DETECTED_CONTROLLER" != *://* ]]; then
  DETECTED_CONTROLLER="http://$DETECTED_CONTROLLER"
fi
if [[ -n "$DETECTED_CONTROLLER" ]]; then
  ensure_env_kv MIHOMO_CONTROLLER_URL "$DETECTED_CONTROLLER" "$ENV_FILE"
fi
if [[ -n "$DETECTED_SECRET" ]]; then
  ensure_env_kv MIHOMO_CONTROLLER_SECRET "$DETECTED_SECRET" "$ENV_FILE"
fi

sudo cp "$SERVICE_TEMPLATE" "/etc/systemd/system/${SERVICE_NAME}.service"
sudo systemctl daemon-reload
sudo systemctl enable "$SERVICE_NAME"
if sudo systemctl is-active --quiet "$SERVICE_NAME"; then
  sudo systemctl restart "$SERVICE_NAME"
else
  sudo systemctl start "$SERVICE_NAME"
fi
sudo systemctl status "$SERVICE_NAME" --no-pager || true
