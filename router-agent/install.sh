#!/bin/sh
set -e

AGENT_DIR="/opt/zash-agent"
PORT="9099"
AGENT_VERSION="0.6.22"

echo "[zash-agent] installing into $AGENT_DIR"

if [ ! -d /opt ]; then
  echo "[zash-agent] /opt is missing. Install Entware first." >&2
  exit 1
fi

# Ensure HTTP daemon exists (BusyBox httpd is not always compiled in on Keenetic builds).
# We use uhttpd from Entware (keenetic feed) as a drop-in replacement.
if ! command -v uhttpd >/dev/null 2>&1; then
  echo "[zash-agent] uhttpd not found. Installing uhttpd_kn (Entware keenetic feed)..." >&2
  opkg update >/dev/null 2>&1 || true
  opkg install uhttpd_kn >/dev/null 2>&1 || opkg install uhttpd >/dev/null 2>&1 || true
fi

WAN_IF="$(ip -4 route show default 2>/dev/null | awk '{print $5}' | head -n1)"
[ -n "$WAN_IF" ] || WAN_IF="eth0"

LAN_IF="br0"
if ! ip link show "$LAN_IF" >/dev/null 2>&1; then
  # try to find a bridge
  LAN_IF="$(ip -o link show 2>/dev/null | awk -F': ' '/: br/{print $2; exit}')"
  [ -n "$LAN_IF" ] || LAN_IF="br0"
fi

BIND_IP="$(ip -4 addr show "$LAN_IF" 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | head -n1)"
[ -n "$BIND_IP" ] || BIND_IP="0.0.0.0"

mkdir -p "$AGENT_DIR/www/cgi-bin" "$AGENT_DIR/var"

if [ ! -f "$AGENT_DIR/agent.env" ]; then
  cat > "$AGENT_DIR/agent.env" <<EOF
WAN_IF="$WAN_IF"
LAN_IF="$LAN_IF"
BIND_IP="$BIND_IP"
PORT="$PORT"
STATE_FILE="$AGENT_DIR/var/shapers.db"
BLOCKS_FILE="$AGENT_DIR/var/blocks.db"
PROVIDER_TRAFFIC_FILE="$AGENT_DIR/var/provider-traffic.json"
PROVIDER_TRAFFIC_META="$AGENT_DIR/var/provider-traffic.meta.json"

# Path to Mihomo YAML config on the router
MIHOMO_CONFIG="/opt/etc/mihomo/config.yaml"

# Optional: explicit path to Mihomo log file (if log-file is not set in config)
MIHOMO_LOG=""

# Optional: custom GEO download URLs (used by cmd=geo_update)
GEOIP_URL="https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat"
GEOSITE_URL="https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat"
ASN_URL="https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb"

# Optional: set a token to require Authorization: Bearer <token>
TOKEN=""

# Optional: backups to cloud via rclone (see /opt/zash-agent/backup.sh)
BACKUP_TMP_DIR="$AGENT_DIR/var/backups"
RCLONE_CONFIG=""   # optional explicit rclone config path
RCLONE_REMOTE=""   # legacy single remote, e.g. gdrive / yandex
RCLONE_REMOTES=""  # comma/space separated remotes, e.g. gdrive-crypt,yandex-crypt
RCLONE_PATH="NetcrazeBackups/zash-agent"
RCLONE_KEEP_DAYS="30"

# Provider SSL cache auto-refresh interval in seconds (default: 6h)
SSL_CACHE_AUTO_REFRESH_SECS="21600"

# Live host traffic state (keep in /tmp to avoid flash writes on every poll)
HOST_TRAFFIC_STATE_FILE="/tmp/zash-host-traffic.prev.tsv"
HOST_TRAFFIC_TS_FILE="/tmp/zash-host-traffic.prev.ts"

# Host QoS priority (best effort). Profiles use tc HTB class priority + guaranteed minimum share.
QOS_HOSTS_FILE="$AGENT_DIR/var/qos-hosts.db"
QOS_CRITICAL_PCT="35"
QOS_HIGH_PCT="25"
QOS_ELEVATED_PCT="16"
QOS_NORMAL_PCT="10"
QOS_LOW_PCT="5"
QOS_BACKGROUND_PCT="2"
QOS_CRITICAL_PRIO="0"
QOS_HIGH_PRIO="1"
QOS_ELEVATED_PRIO="2"
QOS_NORMAL_PRIO="3"
QOS_LOW_PRIO="5"
QOS_BACKGROUND_PRIO="7"

# Root class rates (mbit). Keep high unless you want a global cap.
WAN_RATE="1000"
LAN_RATE="1000"

# Host QoS safe mode:
# wan-only = apply host QoS only on WAN egress (safer default)
# wan-lan  = legacy mode with WAN + LAN shaping
QOS_MODE="wan-only"
EOF
  echo "[zash-agent] created $AGENT_DIR/agent.env (edit if needed)"
else
  echo "[zash-agent] using existing $AGENT_DIR/agent.env"
fi

cat > "$AGENT_DIR/www/cgi-bin/api.sh" <<'EOF'
#!/opt/bin/sh

ENV_FILE="/opt/zash-agent/agent.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

WAN_IF="${WAN_IF:-eth0}"
LAN_IF="${LAN_IF:-br0}"
PORT="${PORT:-9099}"
STATE_FILE="${STATE_FILE:-/opt/zash-agent/var/shapers.db}"
BLOCKS_FILE="${BLOCKS_FILE:-/opt/zash-agent/var/blocks.db}"
PROVIDER_TRAFFIC_FILE="${PROVIDER_TRAFFIC_FILE:-/opt/zash-agent/var/provider-traffic.json}"
PROVIDER_TRAFFIC_META="${PROVIDER_TRAFFIC_META:-/opt/zash-agent/var/provider-traffic.meta.json}"
USERS_DB_FILE="${USERS_DB_FILE:-/opt/zash-agent/var/users-db.json}"
USERS_DB_META="${USERS_DB_META:-/opt/zash-agent/var/users-db.meta.json}"
USERS_DB_REVS_DIR="${USERS_DB_REVS_DIR:-/opt/zash-agent/var/users-db.revs}"
USERS_DB_REVS_MAX="${USERS_DB_REVS_MAX:-10}"
MIHOMO_CFG_DIR="${MIHOMO_CFG_DIR:-/opt/zash-agent/var/mihomo-config}"
MIHOMO_CFG_DRAFT_FILE="${MIHOMO_CFG_DRAFT_FILE:-$MIHOMO_CFG_DIR/draft.yaml}"
MIHOMO_CFG_BASELINE_FILE="${MIHOMO_CFG_BASELINE_FILE:-$MIHOMO_CFG_DIR/baseline.yaml}"
MIHOMO_CFG_META="${MIHOMO_CFG_META:-$MIHOMO_CFG_DIR/meta.json}"
MIHOMO_CFG_REVS_DIR="${MIHOMO_CFG_REVS_DIR:-$MIHOMO_CFG_DIR/revs}"
MIHOMO_CFG_REVS_MAX="${MIHOMO_CFG_REVS_MAX:-10}"
TOKEN="${TOKEN:-}"
AGENT_VERSION="0.6.22"
MIHOMO_CONFIG="${MIHOMO_CONFIG:-/opt/etc/mihomo/config.yaml}"
MIHOMO_LOG="${MIHOMO_LOG:-}"
GEOIP_URL="${GEOIP_URL:-https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat}"
GEOSITE_URL="${GEOSITE_URL:-https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat}"
ASN_URL="${ASN_URL:-https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb}"
WAN_RATE="${WAN_RATE:-1000}"
LAN_RATE="${LAN_RATE:-1000}"
BACKUP_TMP_DIR="${BACKUP_TMP_DIR:-/opt/zash-agent/var/backups}"
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_REMOTES="${RCLONE_REMOTES:-}"
RCLONE_PATH="${RCLONE_PATH:-NetcrazeBackups/zash-agent}"
RCLONE_KEEP_DAYS="${RCLONE_KEEP_DAYS:-30}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-${RCLONE_KEEP_DAYS:-30}}"
HOST_TRAFFIC_STATE_FILE="${HOST_TRAFFIC_STATE_FILE:-/tmp/zash-host-traffic.prev.tsv}"
HOST_TRAFFIC_TS_FILE="${HOST_TRAFFIC_TS_FILE:-/tmp/zash-host-traffic.prev.ts}"
QOS_HOSTS_FILE="${QOS_HOSTS_FILE:-/opt/zash-agent/var/qos-hosts.db}"
QOS_CRITICAL_PCT="${QOS_CRITICAL_PCT:-35}"
QOS_HIGH_PCT="${QOS_HIGH_PCT:-25}"
QOS_ELEVATED_PCT="${QOS_ELEVATED_PCT:-16}"
QOS_NORMAL_PCT="${QOS_NORMAL_PCT:-10}"
QOS_LOW_PCT="${QOS_LOW_PCT:-5}"
QOS_BACKGROUND_PCT="${QOS_BACKGROUND_PCT:-2}"
QOS_CRITICAL_PRIO="${QOS_CRITICAL_PRIO:-0}"
QOS_HIGH_PRIO="${QOS_HIGH_PRIO:-1}"
QOS_ELEVATED_PRIO="${QOS_ELEVATED_PRIO:-2}"
QOS_NORMAL_PRIO="${QOS_NORMAL_PRIO:-3}"
QOS_LOW_PRIO="${QOS_LOW_PRIO:-5}"
QOS_BACKGROUND_PRIO="${QOS_BACKGROUND_PRIO:-7}"
QOS_MODE="${QOS_MODE:-wan-only}"
UI_ZIP_URL="${UI_ZIP_URL:-}"
SSL_CACHE_FILE="${SSL_CACHE_FILE:-/opt/zash-agent/var/mihomo-providers-ssl-cache.tsv}"
SSL_CACHE_TS_FILE="${SSL_CACHE_TS_FILE:-/opt/zash-agent/var/mihomo-providers-ssl-cache.ts}"
SSL_CACHE_AUTO_REFRESH_SECS="${SSL_CACHE_AUTO_REFRESH_SECS:-21600}"
SSL_CACHE_LOCK_FILE="${SSL_CACHE_LOCK_FILE:-/opt/zash-agent/var/mihomo-providers-ssl-cache.lock}"

json() {
  printf '{'
  first=1
  while [ "$#" -gt 0 ]; do
    k="$1"; v="$2"; shift 2
    [ $first -eq 0 ] && printf ','
    first=0
    # strings only (safe enough for our payload)
    printf '"%s":"%s"' "$k" "$(printf '%s' "$v" | sed 's/"/\\"/g')"
  done
  printf '}'
}

reply_ok() {
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo
  echo "$1"
}

reply_text() {
  ctype="$1"
  fname="$2"
  [ -n "$ctype" ] || ctype='text/plain; charset=utf-8'
  echo "Content-Type: $ctype"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  if [ -n "$fname" ]; then
    echo "Content-Disposition: inline; filename=\"$fname\""
  fi
  echo
  cat
}

reply_text_with_headers() {
  ctype="$1"
  fname="$2"
  extra_headers="$3"
  [ -n "$ctype" ] || ctype='text/plain; charset=utf-8'
  echo "Content-Type: $ctype"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  if [ -n "$fname" ]; then
    echo "Content-Disposition: inline; filename=\"$fname\""
  fi
  if [ -n "$extra_headers" ]; then
    printf '%s\n' "$extra_headers"
  fi
  echo
  cat
}

reply_err() {
  msg="$1"
  [ -n "$msg" ] || msg='error'
  reply_ok "$(printf '{\"ok\":false,\"error\":\"%s\"}' "$(jesc "$msg")")"
}


b64enc() {
  if command -v base64 >/dev/null 2>&1; then
    base64 -w 0 2>/dev/null || base64 2>/dev/null | tr -d '\n'
  elif command -v openssl >/dev/null 2>&1; then
    openssl base64 -A
  else
    cat | tr -d '\n'
  fi
}

run_with_timeout_sh() {
  secs="$1"
  script="$2"
  [ -n "$secs" ] || secs="7"

  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" sh -c "$script"
    return $?
  fi

  sh -c "$script" &
  cmd_pid=$!
  (
    sleep "$secs"
    kill -TERM "$cmd_pid" 2>/dev/null || true
    sleep 1
    kill -KILL "$cmd_pid" 2>/dev/null || true
  ) &
  killer_pid=$!

  wait "$cmd_pid"
  rc=$?
  kill -TERM "$killer_pid" 2>/dev/null || true
  wait "$killer_pid" 2>/dev/null || true
  return $rc
}

ssl_not_after() {
  host="$1"; port="$2"
  [ -n "$host" ] || return 0
  [ -n "$port" ] || port="443"
  command -v openssl >/dev/null 2>&1 || return 0

  host_esc="$(printf '%s' "$host" | sed "s/'/'\''/g")"
  port_esc="$(printf '%s' "$port" | sed "s/'/'\''/g")"
  script="echo | openssl s_client -servername '$host_esc' -connect '$host_esc:$port_esc' 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | sed 's/^notAfter=//'"
  end="$(run_with_timeout_sh 7 "$script" 2>/dev/null || true)"
  printf '%s' "$end"
}

provider_traffic_now_iso() {
  date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo ""
}

provider_traffic_load_meta() {
  pt_rev="$(sed -nE 's/.*"rev"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$PROVIDER_TRAFFIC_META" 2>/dev/null | head -n1)"
  pt_updatedAt="$(sed -nE 's/.*"updatedAt"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' "$PROVIDER_TRAFFIC_META" 2>/dev/null | head -n1)"
  echo "$pt_rev" | grep -qE '^[0-9]+$' || pt_rev=0
}

provider_traffic_write_meta() {
  printf '{"rev":%s,"updatedAt":"%s"}' "$pt_rev" "$(jesc "$pt_updatedAt")" > "$PROVIDER_TRAFFIC_META" 2>/dev/null || true
}

provider_traffic_init_if_missing() {
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true
  if [ ! -f "$PROVIDER_TRAFFIC_FILE" ]; then
    printf '{"version":1,"sessionTotals":{},"daily":{"day":"","totals":{}},"connTotals":{"entries":{}}}' > "$PROVIDER_TRAFFIC_FILE" 2>/dev/null || true
  fi
  if [ ! -f "$PROVIDER_TRAFFIC_META" ]; then
    printf '{"rev":0,"updatedAt":""}' > "$PROVIDER_TRAFFIC_META" 2>/dev/null || true
  fi
  provider_traffic_load_meta
}

provider_traffic_get_json() {
  provider_traffic_init_if_missing
  content="$( (head -c 4194304 "$PROVIDER_TRAFFIC_FILE" 2>/dev/null || cat "$PROVIDER_TRAFFIC_FILE" 2>/dev/null || printf '{}') | b64enc )"
  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s","contentB64":"%s"}' "$pt_rev" "$(jesc "$pt_updatedAt")" "$content")"
}

provider_traffic_put_json() {
  expected_rev="$1"
  [ -n "$expected_rev" ] || expected_rev='-1'

  if [ "$REQUEST_METHOD" != "POST" ]; then
    reply_ok '{"ok":false,"error":"method-not-allowed"}'
    return
  fi

  provider_traffic_init_if_missing

  lockdir="${PROVIDER_TRAFFIC_FILE}.lock"
  if [ -d "$lockdir" ]; then
    lm="$(stat_mtime_sec "$lockdir")"
    now="$(date +%s 2>/dev/null || echo 0)"
    echo "$lm" | grep -qE '^[0-9]+$' || lm=0
    echo "$now" | grep -qE '^[0-9]+$' || now=0
    if [ "$lm" -gt 0 ] && [ "$now" -gt 0 ] && [ $((now - lm)) -gt 120 ]; then
      rmdir "$lockdir" 2>/dev/null || true
    fi
  fi

  i=0
  while ! mkdir "$lockdir" 2>/dev/null; do
    i=$((i+1))
    [ $i -ge 10 ] && { reply_ok '{"ok":false,"error":"busy"}'; return; }
    sleep 1 2>/dev/null || true
  done

  provider_traffic_load_meta
  echo "$expected_rev" | grep -qE '^-?[0-9]+$' || expected_rev='-1'
  if [ "$expected_rev" != "$pt_rev" ]; then
    content="$( (head -c 4194304 "$PROVIDER_TRAFFIC_FILE" 2>/dev/null || cat "$PROVIDER_TRAFFIC_FILE" 2>/dev/null || printf '{}') | b64enc )"
    rmdir "$lockdir" 2>/dev/null || true
    reply_ok "$(printf '{"ok":false,"error":"conflict","rev":%s,"updatedAt":"%s","contentB64":"%s"}' "$pt_rev" "$(jesc "$pt_updatedAt")" "$content")"
    return
  fi

  body=""
  if [ -n "$CONTENT_LENGTH" ] && echo "$CONTENT_LENGTH" | grep -qE '^[0-9]+$'; then
    body="$(head -c "$CONTENT_LENGTH" 2>/dev/null || dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null || true)"
  else
    body="$(cat 2>/dev/null || true)"
  fi
  [ -n "$body" ] || body='{}'

  sz="$(printf '%s' "$body" | wc -c 2>/dev/null || echo 0)"
  echo "$sz" | grep -qE '^[0-9]+$' || sz=0
  if [ "$sz" -gt 4194304 ]; then
    rmdir "$lockdir" 2>/dev/null || true
    reply_ok '{"ok":false,"error":"too-large"}'
    return
  fi

  tmp="${PROVIDER_TRAFFIC_FILE}.tmp.$$"
  printf '%s' "$body" > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; rmdir "$lockdir" 2>/dev/null || true; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mv -f "$tmp" "$PROVIDER_TRAFFIC_FILE" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; rmdir "$lockdir" 2>/dev/null || true; reply_ok '{"ok":false,"error":"write-failed"}'; return; }

  pt_rev=$((pt_rev + 1))
  pt_updatedAt="$(provider_traffic_now_iso)"
  provider_traffic_write_meta >/dev/null 2>&1 || true

  rmdir "$lockdir" 2>/dev/null || true

  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s"}' "$pt_rev" "$(jesc "$pt_updatedAt")")"
}

users_db_panel_urls_lines() {
  # Extract providerPanelUrls map from users-db JSON as lines: name<TAB>url
  # We support a few legacy filenames to be robust across upgrades.
  file=""
  for f in "$USERS_DB_FILE" "/opt/zash-agent/var/users_db.json" "/opt/zash-agent/var/usersdb.json"; do
    if [ -f "$f" ]; then
      file="$f"
      break
    fi
  done
  [ -n "$file" ] || return 0

  data="$(head -c 2097152 "$file" 2>/dev/null | tr -d '\n\r')"

  # providerPanelUrls is expected to be a JSON object: { "Provider": "https://...", ... }
  part="$(printf '%s' "$data" | sed -nE 's/.*"providerPanelUrls"[[:space:]]*:[[:space:]]*\{([^}]*)\}.*/\1/p' | head -n1)"
  [ -n "$part" ] || return 0

  printf '%s' "$part" | tr ',' '\n' | sed -nE 's/^[[:space:]]*"([^"]+)"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1\t\2/p'
  return 0
}



safe_list_proxy_provider_lines() {
  [ -f "$MIHOMO_CONFIG" ] || return 0
  awk '
    BEGIN { in_pp=0; name=""; url="" }
    function trimq(s) {
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", s)
      gsub(/^"|"$/, "", s)
      gsub(/^\047|\047$/, "", s)
      return s
    }
    function flush() {
      if (name != "" && url != "") print name "\t" url
      name=""
      url=""
    }
    /^proxy-providers:[[:space:]]*$/ { in_pp=1; next }
    in_pp && /^[^[:space:]#]/ { flush(); exit }
    in_pp && /^  [^[:space:]#][^:]*:[[:space:]]*$/ {
      flush()
      line=$0
      sub(/^  /, "", line)
      sub(/:[[:space:]]*$/, "", line)
      name=trimq(line)
      next
    }
    in_pp && name != "" && /^    url:[[:space:]]*/ {
      line=$0
      sub(/^    url:[[:space:]]*/, "", line)
      url=trimq(line)
      next
    }
    END { flush() }
  ' "$MIHOMO_CONFIG" 2>/dev/null | awk -F'\t' '!seen[tolower($1)]++'
}

provider_lines_filter() {
  lines="$1"
  selected_csv="$2"
  [ -n "$selected_csv" ] || { printf '%s\n' "$lines"; return 0; }
  printf '%s\n' "$lines" | awk -F'\t' -v sel="$selected_csv" '
    BEGIN {
      n = split(sel, arr, /,/)
      for (i = 1; i <= n; i++) {
        gsub(/^[[:space:]]+|[[:space:]]+$/, "", arr[i])
        if (arr[i] != "") want[tolower(arr[i])] = 1
      }
    }
    { if (want[tolower($1)]) print $0 }
  '
}

pick_text_fetcher() {
  if [ -x /opt/bin/wget ]; then echo '/opt/bin/wget'; return; fi
  if command -v wget >/dev/null 2>&1; then echo 'wget'; return; fi
  if [ -x /opt/bin/curl ]; then echo '/opt/bin/curl'; return; fi
  if command -v curl >/dev/null 2>&1; then echo 'curl'; return; fi
  echo ''
}

fetch_url_text() {
  url="$1"
  fetcher="$(pick_text_fetcher)"
  [ -n "$fetcher" ] || return 2
  if echo "$fetcher" | grep -q wget; then
    "$fetcher" -qO- -T 8 -t 1 "$url" 2>/dev/null || return 1
  else
    "$fetcher" --connect-timeout 5 --max-time 8 -fsSL "$url" 2>/dev/null || return 1
  fi
}

b64dec_text() {
  if command -v base64 >/dev/null 2>&1; then
    base64 -d 2>/dev/null || return 1
  elif command -v openssl >/dev/null 2>&1; then
    openssl base64 -d -A 2>/dev/null || return 1
  else
    return 1
  fi
}

normalize_subscription_payload() {
  payload="$1"
  [ -n "$payload" ] || return 0
  trimmed="$(printf '%s' "$payload" | tr -d '\r')"
  compact="$(printf '%s' "$trimmed" | tr -d '\n\t ')"
  decoded=""
  if [ -n "$compact" ]; then
    decoded="$(printf '%s' "$compact" | b64dec_text 2>/dev/null || true)"
  fi
  if [ -n "$decoded" ] && printf '%s' "$decoded" | grep -q '://'; then
    printf '%s\n' "$decoded"
    return 0
  fi
  printf '%s\n' "$trimmed"
}

subscription_links_merged_text() {
  provider_lines="$1"
  tab="$(printf '\t' 2>/dev/null || echo ' ')"
  tmp="/tmp/zash-sub-links.$$"
  : > "$tmp"
  while IFS="$tab" read -r pname raw_url; do
    [ -n "$pname" ] || continue
    url="$(printf '%s' "$raw_url" | sed -E "s/^[\"\047]?//; s/[\"\047]?$//")"
    [ -n "$url" ] || continue
    body="$(fetch_url_text "$url" || true)"
    [ -n "$body" ] || continue
    normalized="$(normalize_subscription_payload "$body")"
    [ -n "$normalized" ] || continue
    printf '%s\n' "$normalized" >> "$tmp"
  done <<__PROVIDER_LINES__
$provider_lines
__PROVIDER_LINES__
  awk '{ sub(/\r$/, ""); if ($0 ~ /^[[:space:]]*$/) next; if ($0 !~ /:\/\//) next; if (!seen[$0]++) print $0 }' "$tmp" 2>/dev/null
  rm -f "$tmp" 2>/dev/null || true
}

subscription_v2raytun_headers() {
  title="$1"
  [ -n "$title" ] || title='Zash Aggregated'
  printf 'profile-title: %s\n' "$title"
  printf 'profile-update-interval: 6\n'
  printf 'update-always: true\n'
}

subscription_v2raytun_body_headers() {
  title="$1"
  [ -n "$title" ] || title='Zash Aggregated'
  title_b64="$(printf '%s' "$title" | b64enc | tr -d '\r\n')"
  printf '#profile-title: base64:%s\n' "$title_b64"
  printf '#profile-update-interval: 6\n'
  printf '#update-always: true\n'
}

subscription_v2raytun_text() {
  provider_lines="$1"
  title="$2"
  subscription_v2raytun_body_headers "$title"
  subscription_links_merged_text "$provider_lines"
}

subscription_with_crlf() {
  awk '{ sub(/\r$/, ""); printf "%s\r\n", $0 }'
}

json_array_from_lines() {
  awk '
    BEGIN { printf "["; first = 1 }
    {
      line = $0
      sub(/\r$/, "", line)
      if (line ~ /^[[:space:]]*$/) next
      gsub(/\\/, "\\\\", line)
      gsub(/"/, "\\"", line)
      if (!first) printf ","
      first = 0
      printf "\"%s\"", line
    }
    END { printf "]" }
  '
}


urlencode() {
  input="$1"
  out=""
  while [ -n "$input" ]; do
    ch="${input%"${input#?}"}"
    input="${input#?}"
    case "$ch" in
      [A-Za-z0-9.~_-])
        out="${out}${ch}"
        ;;
      ' ')
        out="${out}%20"
        ;;
      *)
        enc="$(printf '%s' "$ch" | od -An -tx1 -v 2>/dev/null | tr -s ' ' '\n' | awk 'NF { printf "%%%s", toupper($1) }')"
        out="${out}${enc}"
        ;;
    esac
  done
  printf '%s' "$out"
}

request_forwarded_value() {
  raw="$1"
  [ -n "$raw" ] || return 0
  printf '%s' "$raw" | awk -F',' '{ gsub(/^[[:space:]]+|[[:space:]]+$/, "", $1); print $1 }'
}

request_public_scheme() {
  proto="$(request_forwarded_value "$HTTP_X_FORWARDED_PROTO")"
  proto="$(printf '%s' "$proto" | tr '[:upper:]' '[:lower:]')"
  case "$proto" in
    https|http)
      printf '%s' "$proto"
      return 0
      ;;
  esac
  case "${HTTPS:-}" in
    on|ON|1|true|TRUE)
      printf 'https'
      return 0
      ;;
  esac
  if [ "${SERVER_PORT:-}" = '443' ]; then
    printf 'https'
  else
    printf 'http'
  fi
}

request_public_host() {
  host="$(request_forwarded_value "$HTTP_X_FORWARDED_HOST")"
  [ -n "$host" ] || host="$(request_forwarded_value "$HTTP_HOST")"
  if [ -n "$host" ]; then
    printf '%s' "$host"
    return 0
  fi
  host="${SERVER_NAME:-}"
  [ -n "$host" ] || return 0
  scheme="$(request_public_scheme)"
  port="${SERVER_PORT:-}"
  case "$scheme:$port" in
    http:80|https:443|'':*|*:)
      printf '%s' "$host"
      ;;
    *)
      printf '%s:%s' "$host" "$port"
      ;;
  esac
}

request_public_prefix() {
  prefix="$(request_forwarded_value "$HTTP_X_FORWARDED_PREFIX")"
  prefix="$(printf '%s' "$prefix" | sed 's#//*#/#g; s#/$##')"
  case "$prefix" in
    '') printf '' ;;
    /*) printf '%s' "$prefix" ;;
    *) printf '/%s' "$prefix" ;;
  esac
}

request_public_api_path() {
  script_path="${SCRIPT_NAME:-/cgi-bin/api.sh}"
  case "$script_path" in
    /*) ;;
    *) script_path="/${script_path}" ;;
  esac
  printf '%s%s' "$(request_public_prefix)" "$script_path"
}

request_public_api_url() {
  scheme="$(request_public_scheme)"
  host="$(request_public_host)"
  path="$(request_public_api_path)"
  [ -n "$scheme" ] || return 0
  [ -n "$host" ] || return 0
  printf '%s://%s%s' "$scheme" "$host" "$path"
}

subscription_canonical_url() {
  fmt="$1"
  selected_csv="$2"
  title="$3"
  token="$4"
  api_url="$(request_public_api_url)"
  [ -n "$api_url" ] || return 0
  qs="cmd=subscription&format=$(urlencode "$fmt")"
  [ -n "$title" ] && qs="$qs&name=$(urlencode "$title")"
  [ -n "$selected_csv" ] && qs="$qs&providers=$(urlencode "$selected_csv")"
  [ -n "$token" ] && qs="$qs&token=$(urlencode "$token")"
  printf '%s?%s' "$api_url" "$qs"
}


subscription_provider_names_json() {
  provider_lines="$1"
  tab="$(printf '\t' 2>/dev/null || echo ' ')"
  while IFS="$tab" read -r pname raw_url; do
    [ -n "$pname" ] || continue
    printf '%s\n' "$pname"
  done <<__PROVIDER_LINES__
$provider_lines
__PROVIDER_LINES__
}

subscription_json_manifest() {
  provider_lines="$1"
  title="$2"
  selected_csv="$3"
  token="$4"
  [ -n "$title" ] || title='Zash Aggregated'
  generated_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo '')"
  links_tmp="/tmp/zash-sub-json-links.$$"
  subscription_links_merged_text "$provider_lines" > "$links_tmp"
  item_count="$(awk 'NF{c++} END{print c+0}' "$links_tmp" 2>/dev/null)"
  provider_count="$(subscription_provider_names_json "$provider_lines" | awk 'NF{c++} END{print c+0}')"
  providers_json="$(subscription_provider_names_json "$provider_lines" | json_array_from_lines)"
  items_json="$(cat "$links_tmp" 2>/dev/null | json_array_from_lines)"
  public_api_url="$(request_public_api_url)"
  public_host="$(request_public_host)"
  if [ -n "$public_host" ]; then
    public_base="$(request_public_scheme)://$public_host$(request_public_prefix)"
  else
    public_base=""
  fi
  forwarded=false
  [ -n "${HTTP_X_FORWARDED_PROTO:-}${HTTP_X_FORWARDED_HOST:-}${HTTP_X_FORWARDED_PREFIX:-}" ] && forwarded=true
  mihomo_url="$(subscription_canonical_url 'mihomo' "$selected_csv" "$title" "$token")"
  b64_url="$(subscription_canonical_url 'b64' "$selected_csv" "$title" "$token")"
  plain_url="$(subscription_canonical_url 'plain' "$selected_csv" "$title" "$token")"
  json_url="$(subscription_canonical_url 'json' "$selected_csv" "$title" "$token")"
  rm -f "$links_tmp" 2>/dev/null || true
  printf '{"ok":true,"format":"json","schema":"zash.subscription.v1","title":"%s","generatedAt":"%s","providerCount":%s,"itemCount":%s,"providers":%s,"items":%s,"request":{"publicBase":"%s","apiUrl":"%s","forwarded":%s},"urls":{"mihomo":"%s","b64":"%s","plain":"%s","json":"%s"},"notes":{"status":"preview","transport":"https-recommended","purpose":"xray-v2ray-groundwork"}}'     "$(jesc "$title")" "$(jesc "$generated_at")" "$provider_count" "$item_count" "$providers_json" "$items_json"     "$(jesc "$public_base")" "$(jesc "$public_api_url")" "$forwarded"     "$(jesc "$mihomo_url")" "$(jesc "$b64_url")" "$(jesc "$plain_url")" "$(jesc "$json_url")"
}
yaml_sq() {
  printf '%s' "$1" | sed "s/'/''/g"
}

subscription_mihomo_yaml_text() {
  provider_lines="$1"
  title="$2"
  [ -n "$title" ] || title='Zash Aggregated'
  test_url='https://www.gstatic.com/generate_204'
  interval='600'
  echo "# Generated by router-agent"
  echo "# Direct traffic goes to provider servers; the router only serves this subscription URL."
  echo "mixed-port: 7890"
  echo "allow-lan: true"
  echo "mode: rule"
  echo "log-level: info"
  echo "ipv6: true"
  echo "profile:"
  echo "  store-selected: true"
  echo "  store-fake-ip: true"
  echo "proxy-providers:"
  tab="$(printf '\t' 2>/dev/null || echo ' ')"
  while IFS="$tab" read -r pname raw_url; do
    [ -n "$pname" ] || continue
    url="$(printf '%s' "$raw_url" | sed -E "s/^[\"\047]?//; s/[\"\047]?$//")"
    [ -n "$url" ] || continue
    echo "  '$(yaml_sq "$pname")':"
    echo "    type: http"
    echo "    url: '$url'"
    echo "    interval: 86400"
    echo "    health-check:"
    echo "      enable: true"
    echo "      url: '$test_url'"
    echo "      interval: $interval"
  done <<__PROVIDER_LINES__
$provider_lines
__PROVIDER_LINES__
  echo "proxy-groups:"
  for gname in Manual Auto Failover Balance; do
    echo "  - name: '$gname'"
    case "$gname" in
      Manual)
        echo "    type: select"
        ;;
      Auto)
        echo "    type: url-test"
        echo "    url: '$test_url'"
        echo "    interval: $interval"
        ;;
      Failover)
        echo "    type: fallback"
        echo "    url: '$test_url'"
        echo "    interval: $interval"
        ;;
      Balance)
        echo "    type: load-balance"
        echo "    strategy: round-robin"
        echo "    url: '$test_url'"
        echo "    interval: $interval"
        ;;
    esac
    echo "    use:"
    while IFS="$tab" read -r pname raw_url; do
      [ -n "$pname" ] || continue
      echo "      - '$(yaml_sq "$pname")'"
    done <<__PROVIDER_LINES__
$provider_lines
__PROVIDER_LINES__
  done
  echo "  - name: '$(yaml_sq "$title")'"
  echo "    type: select"
  echo "    proxies:"
  echo "      - 'Manual'"
  echo "      - 'Auto'"
  echo "      - 'Failover'"
  echo "      - 'Balance'"
  echo "      - 'DIRECT'"
  echo "rules:"
  echo "  - MATCH,'$(yaml_sq "$title")'"
}

subscriptions_export_text() {
  format="$1"
  selected_csv="$2"
  title="$3"
  provider_lines="$(safe_list_proxy_provider_lines)"
  provider_lines="$(provider_lines_filter "$provider_lines" "$selected_csv")"
  if [ -z "$provider_lines" ]; then
    reply_err 'no-providers'
    return
  fi
  case "$format" in
    mihomo)
      subscription_mihomo_yaml_text "$provider_lines" "$title" | reply_text 'text/yaml; charset=utf-8' 'zash-aggregated-mihomo.yaml'
      ;;
    plain)
      subscription_links_merged_text "$provider_lines" | reply_text 'text/plain; charset=utf-8' 'zash-aggregated-subscription.txt'
      ;;
    v2raytun)
      extra_headers="$(subscription_v2raytun_headers "$title")"
      subscription_v2raytun_text "$provider_lines" "$title" | subscription_with_crlf | reply_text_with_headers 'text/plain; charset=utf-8' '' "$extra_headers"
      ;;
    json|links-json|manifest)
      reply_ok "$(subscription_json_manifest "$provider_lines" "$title" "$selected_csv" "$token_q")"
      ;;
    b64|base64|'')
      subscription_links_merged_text "$provider_lines" | b64enc | reply_text 'text/plain; charset=utf-8' 'zash-aggregated-subscription.txt'
      ;;
    *)
      reply_err 'unsupported-format'
      ;;
  esac
}


panel_url_for_provider() {
  # args: providerName, panelMapLines
  name="$1"
  lines="$2"
  [ -n "$name" ] || return 0
  [ -n "$lines" ] || return 0
  printf '%s\n' "$lines" | awk -F'\t' -v n="$name" 'tolower($1)==tolower(n){print $2; exit}'
}

ssl_cache_ttl_secs() {
  ttl="${SSL_CACHE_AUTO_REFRESH_SECS:-21600}"
  echo "$ttl" | grep -qE '^[0-9]+$' || ttl=21600
  [ "$ttl" -gt 0 ] || ttl=21600
  echo "$ttl"
}

ssl_cache_next_refresh_at_sec() {
  [ -f "$SSL_CACHE_TS_FILE" ] || { echo -1; return 0; }
  ts="$(cat "$SSL_CACHE_TS_FILE" 2>/dev/null || echo 0)"
  ttl="$(ssl_cache_ttl_secs)"
  echo "$ts" | grep -qE '^[0-9]+$' || { echo -1; return 0; }
  echo "$ttl" | grep -qE '^[0-9]+$' || ttl=21600
  [ "$ts" -gt 0 ] || { echo -1; return 0; }
  echo $((ts + ttl))
}

ssl_cache_fields_for_provider() {
  name="$1"
  [ -n "$name" ] || return 0
  [ -f "$SSL_CACHE_FILE" ] || return 0
  awk -F'\t' -v n="$name" 'tolower($1)==tolower(n){printf "%s\t%s", $2, $3; exit}' "$SSL_CACHE_FILE" 2>/dev/null
}

ssl_cache_age_secs() {
  [ -f "$SSL_CACHE_TS_FILE" ] || { echo -1; return 0; }
  now="$(date +%s 2>/dev/null || echo 0)"
  ts="$(cat "$SSL_CACHE_TS_FILE" 2>/dev/null || echo 0)"
  echo "$ts" | grep -qE '^[0-9]+$' || { echo -1; return 0; }
  [ "$now" -gt 0 ] || { echo -1; return 0; }
  echo $((now-ts))
}

ssl_cache_is_fresh() {
  age="$(ssl_cache_age_secs)"
  ttl="$(ssl_cache_ttl_secs)"
  echo "$age" | grep -qE '^-?[0-9]+$' || return 1
  [ "$age" -ge 0 ] || return 1
  [ "$age" -lt "$ttl" ]
}

ssl_cache_lock_is_active() {
  [ -f "$SSL_CACHE_LOCK_FILE" ] || return 1
  oldpid="$(cat "$SSL_CACHE_LOCK_FILE" 2>/dev/null || echo '')"
  echo "$oldpid" | grep -qE '^[0-9]+$' || return 1
  kill -0 "$oldpid" 2>/dev/null
}

ssl_cache_ready() {
  [ -s "$SSL_CACHE_FILE" ]
}

ssl_cache_refresh_sync() {
  provider_lines="$1"
  panel_map="$2"
  tab="$(printf '	' 2>/dev/null || echo ' ')"
  tmp="${SSL_CACHE_FILE}.tmp.$$"
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true
  : > "$tmp"

  while IFS="$tab" read -r pname raw_url; do
    [ -n "$pname" ] || continue

    url="$(printf '%s' "$raw_url" | sed -E "s/^[\"']?//; s/[\"']?$//")"
    not_after=""
    panel_na=""
    old_fields="$(ssl_cache_fields_for_provider "$pname")"
    old_not_after=""
    old_panel_na=""
    if [ -n "$old_fields" ]; then
      old_not_after="${old_fields%%$tab*}"
      if [ "$old_fields" != "$old_not_after" ]; then
        old_panel_na="${old_fields#*$tab}"
      fi
    fi

    if [ -n "$url" ]; then
      scheme="${url%%://*}"
      rest="${url#*://}"
      hostport="${rest%%/*}"

      host="$hostport"
      port="443"
      if echo "$hostport" | grep -q '^\['; then
        host="$(echo "$hostport" | sed -E 's/^\[([^\]]+)\].*/\1/')"
        port_part="$(echo "$hostport" | sed -nE 's/^\[[^\]]+\]:(.*)$/\1/p')"
        [ -n "$port_part" ] && port="$port_part"
      else
        host="$(printf '%s' "$hostport" | cut -d: -f1)"
        if echo "$hostport" | grep -q ':'; then
          port_part="$(printf '%s' "$hostport" | awk -F: '{print $NF}')"
          [ -n "$port_part" ] && port="$port_part"
        fi
      fi

      if [ "$scheme" = "https" ] || [ "$scheme" = "wss" ]; then
        not_after="$(ssl_not_after "$host" "$port")"
      fi
    fi
    [ -n "$not_after" ] || not_after="$old_not_after"

    panel_url="$(panel_url_for_provider "$pname" "$panel_map")"
    if [ -n "$panel_url" ]; then
      pscheme="${panel_url%%://*}"
      prest="${panel_url#*://}"
      phostport="${prest%%/*}"

      p_host="$phostport"
      p_port="443"
      if echo "$phostport" | grep -q '^\['; then
        p_host="$(echo "$phostport" | sed -E 's/^\[([^\]]+)\].*/\1/')"
        pport_part="$(echo "$phostport" | sed -nE 's/^\[[^\]]+\]:(.*)$/\1/p')"
        [ -n "$pport_part" ] && p_port="$pport_part"
      else
        p_host="$(printf '%s' "$phostport" | cut -d: -f1)"
        if echo "$phostport" | grep -q ':'; then
          pport_part="$(printf '%s' "$phostport" | awk -F: '{print $NF}')"
          [ -n "$pport_part" ] && p_port="$pport_part"
        fi
      fi

      if [ "$pscheme" = "https" ] || [ "$pscheme" = "wss" ]; then
        panel_na="$(ssl_not_after "$p_host" "$p_port")"
      fi
    fi
    [ -n "$panel_na" ] || panel_na="$old_panel_na"

    printf '%s	%s	%s\n' "$pname" "$not_after" "$panel_na" >> "$tmp"
  done <<__SSL_CACHE_LINES__
$provider_lines
__SSL_CACHE_LINES__

  mv "$tmp" "$SSL_CACHE_FILE"
  date +%s 2>/dev/null > "$SSL_CACHE_TS_FILE" || echo 0 > "$SSL_CACHE_TS_FILE"
}

ssl_cache_refresh_async() {
  provider_lines="$1"
  panel_map="$2"
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true

  if ssl_cache_lock_is_active; then
    return 0
  fi
  rm -f "$SSL_CACHE_LOCK_FILE" 2>/dev/null || true

  (
    echo $$ > "$SSL_CACHE_LOCK_FILE"
    ssl_cache_refresh_sync "$provider_lines" "$panel_map"
    rm -f "$SSL_CACHE_LOCK_FILE" 2>/dev/null || true
  ) >/dev/null 2>&1 &
}

ssl_cache_refresh_json() {
  provider_lines="$(safe_list_proxy_provider_lines)"
  panel_map="$(users_db_panel_urls_lines)"
  if [ -z "$provider_lines" ]; then
    reply_ok '{"ok":false,"error":"no-providers"}'
    return
  fi

  ssl_cache_refresh_async "$provider_lines" "$panel_map"

  checkedAtSec="$(date +%s 2>/dev/null || echo 0)"
  cache_ready=false
  ssl_cache_ready && cache_ready=true
  cache_fresh=false
  ssl_cache_is_fresh && cache_fresh=true
  cache_age_sec="$(ssl_cache_age_secs)"
  echo "$cache_age_sec" | grep -qE '^-?[0-9]+$' || cache_age_sec=-1
  next_refresh_at="$(ssl_cache_next_refresh_at_sec)"
  echo "$next_refresh_at" | grep -qE '^-?[0-9]+$' || next_refresh_at=-1
  reply_ok "{\"ok\":true,\"checkedAtSec\":${checkedAtSec},\"ready\":${cache_ready},\"fresh\":${cache_fresh},\"refreshing\":true,\"cacheAgeSec\":${cache_age_sec},\"nextRefreshAtSec\":${next_refresh_at}}"
}


read_iface_counter() {
  ifn="$1"
  dir="$2"
  case "$dir" in
    rx|tx) ;;
    *) dir="rx" ;;
  esac

  p="/sys/class/net/$ifn/statistics/${dir}_bytes"
  if [ -r "$p" ]; then
    val="$(tr -dc '0-9' < "$p" 2>/dev/null | head -c 32)"
    [ -n "$val" ] || val=0
    printf '%s' "$val"
    return 0
  fi

  if command -v ip >/dev/null 2>&1; then
    if [ "$dir" = "rx" ]; then
      val="$(ip -s link show dev "$ifn" 2>/dev/null | awk '/^[[:space:]]*RX:/ {getline; print $1; exit}')"
    else
      val="$(ip -s link show dev "$ifn" 2>/dev/null | awk '/^[[:space:]]*TX:/ {getline; print $1; exit}')"
    fi
    val="$(printf '%s' "$val" | tr -dc '0-9' | head -c 32)"
    [ -n "$val" ] || val=0
    printf '%s' "$val"
    return 0
  fi

  printf '0'
}

firmware_fetch_url() {
  url="$1"
  ua='Mozilla/5.0 (UltraUIXkeen router-agent)'
  if command -v /opt/bin/wget >/dev/null 2>&1; then
    /opt/bin/wget -qO- --user-agent="$ua" "$url" 2>/dev/null && return 0
  fi
  if command -v curl >/dev/null 2>&1; then
    curl -LfsS -A "$ua" "$url" 2>/dev/null && return 0
  fi
  if command -v wget >/dev/null 2>&1; then
    wget -qO- --user-agent="$ua" "$url" 2>/dev/null && return 0
  fi
  return 1
}

firmware_extract_latest_version() {
  body="$1"
  printf '%s' "$body" \
    | tr '\r' '\n' \
    | grep -oE 'NDMS[[:space:]]+[0-9]+\.[0-9]+(\.[0-9]+|[[:space:]]+(Alpha|Beta|RC)[[:space:]]+[0-9]+)' \
    | head -n1 \
    | sed -E 's/[[:space:]]+/ /g; s/^NDMS //; s/[[:space:]]+$//'
}

firmware_version_key() {
  s="$1"
  base="$(printf '%s' "$s" | sed -nE 's/.*([0-9]+)\.([0-9]+)(\.([0-9]+))?.*/\1 \2 \4/p' | head -n1)"
  set -- $base
  maj="${1:-0}"
  min="${2:-0}"
  patch="${3:-0}"
  stage=3
  stage_no=0
  if printf '%s' "$s" | grep -qi 'alpha'; then
    stage=0
    stage_no="$(printf '%s' "$s" | sed -nE 's/.*[Aa]lpha[[:space:]]*([0-9]+).*/\1/p' | head -n1)"
  elif printf '%s' "$s" | grep -qi 'beta'; then
    stage=1
    stage_no="$(printf '%s' "$s" | sed -nE 's/.*[Bb]eta[[:space:]]*([0-9]+).*/\1/p' | head -n1)"
  elif printf '%s' "$s" | grep -qi 'rc'; then
    stage=2
    stage_no="$(printf '%s' "$s" | sed -nE 's/.*[Rr][Cc][[:space:]]*([0-9]+).*/\1/p' | head -n1)"
  fi
  [ -n "$stage_no" ] || stage_no=0
  printf '%s %s %s %s %s' "$maj" "$min" "$patch" "$stage" "$stage_no"
}

firmware_cmp() {
  ak="$(firmware_version_key "$1")"
  bk="$(firmware_version_key "$2")"
  awk -v a="$ak" -v b="$bk" 'BEGIN {
    split(a,A," "); split(b,B," ");
    for (i=1; i<=5; i++) {
      ai=A[i]+0; bi=B[i]+0;
      if (ai < bi) { print -1; exit }
      if (ai > bi) { print 1; exit }
    }
    print 0
  }'
}

firmware_detect_channel() {
  current="$1"
  main_latest="$2"
  preview_latest="$3"
  dev_latest="$4"

  if [ -n "$dev_latest" ] && [ -n "$preview_latest" ] && [ "$(firmware_cmp "$current" "$preview_latest")" = "1" ] && [ "$(firmware_cmp "$current" "$dev_latest")" != "1" ]; then
    printf 'dev'
    return 0
  fi
  if [ -n "$preview_latest" ] && [ -n "$main_latest" ] && [ "$(firmware_cmp "$current" "$main_latest")" = "1" ] && [ "$(firmware_cmp "$current" "$preview_latest")" != "1" ]; then
    printf 'preview'
    return 0
  fi
  if printf '%s' "$current" | grep -qi 'alpha'; then
    printf 'dev'
    return 0
  fi
  if printf '%s' "$current" | grep -qiE 'beta|preview|предвар'; then
    printf 'preview'
    return 0
  fi
  printf 'main'
}

traffic_iface_kind() {
  ifn="$1"
  case "$ifn" in
    xkeen*|*xkeen*) echo "xkeen" ;;
    wg*|wireguard*|*wg*|nordlynx*) echo "wireguard" ;;
    ovpn*|ovpnc*|ovpns*|openvpn*) echo "openvpn" ;;
    tun*|tap*) echo "tun" ;;
    ppp*|pptp*|l2tp*|sstp*) echo "ppp" ;;
    tailscale*|ts*) echo "tailscale" ;;
    zt*|zerotier*) echo "zerotier" ;;
    ipsec*|xfrm*) echo "ipsec" ;;
    *) echo "vpn" ;;
  esac
}

list_extra_traffic_ifaces() {
  ip -o link show 2>/dev/null | awk -F': ' '{print $2}' | sed 's/@.*//' | while IFS= read -r ifn; do
    [ -n "$ifn" ] || continue
    case "$ifn" in
      lo|"$WAN_IF"|"$LAN_IF"|br0|docker*|veth*|ifb*|imq*|sit*|ip6tnl*|gre*|gretap*|erspan*|bonding_masters|teql*|dummy*|eth*|wl*|ra*|apcli*|br-*)
        continue
        ;;
    esac
    [ -r "/sys/class/net/$ifn/statistics/rx_bytes" ] || continue
    state="$(cat "/sys/class/net/$ifn/operstate" 2>/dev/null || echo unknown)"
    case "$state" in
      down|notpresent|lowerlayerdown)
        continue
        ;;
    esac
    if printf '%s' "$ifn" | grep -qiE '(^|[-_])(xkeen|wg|wireguard|nordlynx|tun|tap|ppp|pptp|l2tp|sstp|ovpn|openvpn|vpn|ipsec|tailscale|zt|zerotier|xfrm)($|[-_0-9])'; then
      printf '%s
' "$ifn"
      continue
    fi
    if ip -d link show "$ifn" 2>/dev/null | grep -qiE 'wireguard|tun|tap|ppp|gretap|ipip|sit|vxlan|openvpn'; then
      printf '%s
' "$ifn"
      continue
    fi
  done
}

traffic_live_json() {
  iface="$WAN_IF"
  [ -n "$iface" ] || iface="eth0"
  if ! ip link show "$iface" >/dev/null 2>&1; then
    iface="$(ip -4 route show default 2>/dev/null | awk '{print $5}' | head -n1)"
  fi
  [ -n "$iface" ] || iface="$WAN_IF"
  [ -n "$iface" ] || iface="eth0"

  rx_bytes="$(read_iface_counter "$iface" rx)"
  tx_bytes="$(read_iface_counter "$iface" tx)"
  ts_ms="$(( $(date +%s 2>/dev/null || echo 0) * 1000 ))"

  extra_json=""
  first_extra=1
  for extra_if in $(list_extra_traffic_ifaces); do
    ex_rx="$(read_iface_counter "$extra_if" rx)"
    ex_tx="$(read_iface_counter "$extra_if" tx)"
    ex_kind="$(traffic_iface_kind "$extra_if")"
    [ $first_extra -eq 0 ] && extra_json="$extra_json,"
    first_extra=0
    extra_json="$extra_json$(printf '{"name":"%s","kind":"%s","rxBytes":%s,"txBytes":%s}' "$(jesc "$extra_if")" "$(jesc "$ex_kind")" "$ex_rx" "$ex_tx")"
  done

  reply_ok "$(printf '{"ok":true,"iface":"%s","rxBytes":%s,"txBytes":%s,"ts":%s,"extraIfaces":[%s]}' "$(jesc "$iface")" "$rx_bytes" "$tx_bytes" "$ts_ms" "$extra_json")"
}

mihomo_config_json() {
  if [ ! -f "$MIHOMO_CONFIG" ]; then
    reply_ok '{"ok":false,"error":"config-not-found"}'
    return
  fi
  content="$(head -c 524288 "$MIHOMO_CONFIG" | b64enc)"
  reply_ok "$(json ok true contentB64 "$content")"
}

mihomo_providers_json() {
  if [ ! -f "$MIHOMO_CONFIG" ]; then
    reply_ok '{"ok":false,"error":"config-not-found"}'
    return
  fi

  checkedAtSec="$(date +%s 2>/dev/null || echo 0)"
  panel_map="$(users_db_panel_urls_lines)"
  provider_lines="$(safe_list_proxy_provider_lines)"
  tab="$(printf '	' 2>/dev/null || echo ' ')"
  refresh_pending=0
  if [ -n "$provider_lines" ] && ! ssl_cache_is_fresh; then
    refresh_pending=1
    ssl_cache_refresh_async "$provider_lines" "$panel_map"
  fi

  cache_ready=false
  ssl_cache_ready && cache_ready=true
  cache_fresh=false
  ssl_cache_is_fresh && cache_fresh=true
  cache_age_sec="$(ssl_cache_age_secs)"
  echo "$cache_age_sec" | grep -qE '^-?[0-9]+$' || cache_age_sec=-1
  next_refresh_at="$(ssl_cache_next_refresh_at_sec)"
  echo "$next_refresh_at" | grep -qE '^-?[0-9]+$' || next_refresh_at=-1
  refreshing=false
  if ssl_cache_lock_is_active; then
    refreshing=true
  fi
  if [ "$refresh_pending" = "1" ]; then
    refreshing=true
  fi
  refresh_pending_json=false
  if [ "$refresh_pending" = "1" ]; then
    refresh_pending_json=true
  fi

  out="{\"ok\":true,\"checkedAtSec\":${checkedAtSec},\"sslCacheReady\":${cache_ready},\"sslCacheFresh\":${cache_fresh},\"sslRefreshing\":${refreshing},\"sslRefreshPending\":${refresh_pending_json},\"sslCacheAgeSec\":${cache_age_sec},\"sslCacheNextRefreshAtSec\":${next_refresh_at},\"providers\":["
  first=1

  while IFS="$tab" read -r pname raw_url; do
    [ -n "$pname" ] || continue

    url="$(printf '%s' "$raw_url" | sed -E "s/^[\"']?//; s/[\"']?$//")"
    host=""
    port=""

    if [ -n "$url" ]; then
      rest="${url#*://}"
      hostport="${rest%%/*}"

      host="$hostport"
      port="443"
      if echo "$hostport" | grep -q '^\['; then
        host="$(echo "$hostport" | sed -E 's/^\[([^\]]+)\].*/\1/')"
        port_part="$(echo "$hostport" | sed -nE 's/^\[[^\]]+\]:(.*)$/\1/p')"
        [ -n "$port_part" ] && port="$port_part"
      else
        host="$(printf '%s' "$hostport" | cut -d: -f1)"
        if echo "$hostport" | grep -q ':'; then
          port_part="$(printf '%s' "$hostport" | awk -F: '{print $NF}')"
          [ -n "$port_part" ] && port="$port_part"
        fi
      fi
    fi

    panel_url="$(panel_url_for_provider "$pname" "$panel_map")"
    cache_fields="$(ssl_cache_fields_for_provider "$pname")"
    not_after=""
    panel_na=""
    if [ -n "$cache_fields" ]; then
      not_after="${cache_fields%%$tab*}"
      if [ "$cache_fields" != "$not_after" ]; then
        panel_na="${cache_fields#*$tab}"
      fi
    fi

    [ $first -eq 0 ] && out="$out,"
    first=0

    esc_name="$(printf '%s' "$pname" | sed 's/"/\\\\\"/g')"
    esc_url="$(printf '%s' "$url" | sed 's/"/\\\\\"/g')"
    esc_host="$(printf '%s' "$host" | sed 's/"/\\\\\"/g')"
    esc_port="$(printf '%s' "$port" | sed 's/"/\\\\\"/g')"
    esc_na="$(printf '%s' "$not_after" | sed 's/"/\\\\\"/g')"
    esc_purl="$(printf '%s' "$panel_url" | sed 's/"/\\\\\"/g')"
    esc_pna="$(printf '%s' "$panel_na" | sed 's/"/\\\\\"/g')"

    out="$out{\"name\":\"$esc_name\",\"url\":\"$esc_url\",\"host\":\"$esc_host\",\"port\":\"$esc_port\",\"sslNotAfter\":\"$esc_na\",\"panelUrl\":\"$esc_purl\",\"panelSslNotAfter\":\"$esc_pna\"}"
  done <<__MPR_LINES__
$provider_lines
__MPR_LINES__

  out="$out]}"
  reply_ok "$out"
}

ssl_probe_batch_json() {
  checkedAtSec="$(date +%s 2>/dev/null || echo 0)"

  # Read POST body (text/plain). Each line: "<name>\t<url>".
  tab="$(printf '\t' 2>/dev/null || echo ' ' )"

  out="{\"ok\":true,\"checkedAtSec\":${checkedAtSec},\"items\":["
  first=1

  while IFS= read -r line; do
    # trim
    line="$(printf '%s' "$line" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -n "$line" ] || continue

    name=""
    url=""
    if echo "$line" | grep -q "$tab"; then
      name="${line%%$tab*}"
      url="${line#*$tab}"
    else
      # fallback: split by first space
      name="${line%% *}"
      url="${line#* }"
      [ "$name" = "$url" ] && url="$name"
    fi

    name="$(printf '%s' "$name" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    url="$(printf '%s' "$url" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//')"
    [ -n "$name" ] || continue
    [ -n "$url" ] || continue

    scheme="${url%%://*}"
    rest="${url#*://}"
    hostport="${rest%%/*}"

    host=""
    port="443"

    if echo "$hostport" | grep -q '^\['; then
      host="$(echo "$hostport" | sed -E 's/^\[([^\]]+)\].*/\1/')"
      port_part="$(echo "$hostport" | sed -nE 's/^\[[^\]]+\]:(.*)$/\1/p')"
      [ -n "$port_part" ] && port="$port_part"
    else
      host="$(printf '%s' "$hostport" | cut -d: -f1)"
      if echo "$hostport" | grep -q ':'; then
        port_part="$(printf '%s' "$hostport" | awk -F: '{print $NF}')"
        [ -n "$port_part" ] && port="$port_part"
      fi
    fi

    na=""
    err=""
    if [ "$scheme" = "https" ] || [ "$scheme" = "wss" ]; then
      na="$(ssl_not_after "$host" "$port")"
      [ -n "$na" ] || err="probe-failed"
    else
      err="non-https"
    fi

    [ $first -eq 0 ] && out="$out,"
    first=0

    esc_name="$(jesc "$name")"
    esc_url="$(jesc "$url")"
    esc_na="$(jesc "$na")"
    esc_err="$(jesc "$err")"

    out="$out{\"name\":\"$esc_name\",\"url\":\"$esc_url\",\"sslNotAfter\":\"$esc_na\",\"error\":\"$esc_err\"}"
  done

  out="$out]}"
  reply_ok "$out"
}


jesc() {
  # Minimal JSON string escape (quotes + backslashes)
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

normalize_rclone_path() {
  p="$1"
  p="$(printf '%s' "$p" | sed 's#^/*##; s#//*#/#g; s#/$##')"
  printf '%s' "$p"
}

stat_mtime_sec() {
  p="$1"

  # GNU/coreutils stat (Entware coreutils)
  out="$(stat -c %Y "$p" 2>/dev/null || true)"
  echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }

  # BusyBox stat may exist but not support all flags depending on build
  if command -v busybox >/dev/null 2>&1; then
    out="$(busybox stat -c %Y "$p" 2>/dev/null || true)"
    echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }
  fi

  # date -r (some BusyBox builds)
  out="$(date -r "$p" +%s 2>/dev/null || true)"
  echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }
  if command -v busybox >/dev/null 2>&1; then
    out="$(busybox date -r "$p" +%s 2>/dev/null || true)"
    echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }
  fi

  # Parse "Modify:" from BusyBox stat output and convert via date -d
  if command -v busybox >/dev/null 2>&1; then
    line="$(busybox stat "$p" 2>/dev/null | grep -E '^[[:space:]]*Modify:' | head -n1 || true)"
    if [ -n "$line" ]; then
      ts="$(echo "$line" | sed 's/^[[:space:]]*Modify:[[:space:]]*//')"
      out="$(date -d "$ts" +%s 2>/dev/null || true)"
      echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }
      out="$(busybox date -d "$ts" +%s 2>/dev/null || true)"
      echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }
    fi
  fi

  # BSD stat fallback (rare on routers)
  out="$(stat -f %m "$p" 2>/dev/null || true)"
  echo "$out" | grep -qE '^[0-9]+$' && { echo "$out"; return; }

  echo 0
}

stat_size_bytes() {
  p="$1"
  stat -c %s "$p" 2>/dev/null || stat -f %z "$p" 2>/dev/null || wc -c <"$p" 2>/dev/null || echo 0
}

geo_info_json() {
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  cfg_dir="$(dirname "$MIHOMO_CONFIG" 2>/dev/null || echo /opt/etc/mihomo)"

  geoip_path=""
  geosite_path=""
  asn_path=""
  mmdb_path=""

  for d in "$cfg_dir" /opt/etc/mihomo /opt/share/mihomo /opt/var/lib/mihomo /opt/var/mihomo /opt/etc/mihomo/geodata /opt/var/mihomo/geodata; do
    [ -n "$geoip_path" ] || {
      for f in geoip.dat GeoIP.dat geoip.dat.new GeoIP.dat.new; do
        [ -f "$d/$f" ] && geoip_path="$d/$f" && break
      done
    }
    [ -n "$geosite_path" ] || {
      for f in geosite.dat GeoSite.dat geosite.dat.new GeoSite.dat.new; do
        [ -f "$d/$f" ] && geosite_path="$d/$f" && break
      done
    }
    [ -n "$mmdb_path" ] || {
      for f in Country.mmdb country.mmdb GeoLite2-Country.mmdb; do
        [ -f "$d/$f" ] && mmdb_path="$d/$f" && break
      done
    }

    [ -n "$asn_path" ] || {
      for f in ASN.mmdb asn.mmdb GeoLite2-ASN.mmdb; do
        [ -f "$d/$f" ] && asn_path="$d/$f" && break
      done
    }
  done

  printf '{"ok":true,"items":['
  first=1
  add_item() {
    kind="$1"; path="$2"
    [ -n "$path" ] || return 0
    ex=false
    m=0
    s=0
    if [ -f "$path" ]; then
      ex=true
      m="$(stat_mtime_sec "$path")"
      s="$(stat_size_bytes "$path")"
    fi
    [ "$first" -eq 0 ] && printf ','
    first=0
    printf '{"kind":"%s","path":"%s","exists":%s,"mtimeSec":%s,"sizeBytes":%s}' \
      "$(jesc "$kind")" "$(jesc "$path")" "$ex" "$m" "$s"
  }
  add_item geoip "$geoip_path"
  add_item geosite "$geosite_path"
  add_item asn "$asn_path"
  add_item mmdb "$mmdb_path"
  printf ']}'
}

geo_update_json() {
  # Update GeoIP/GeoSite/ASN database files on router.
  # Prefer xkeen if available (xkeen -ugi / -ugs). Fallback to direct downloads via wget/curl.

  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  cfg_dir="$(dirname "$MIHOMO_CONFIG" 2>/dev/null || echo /opt/etc/mihomo)"
  [ -d "$cfg_dir" ] || cfg_dir="/opt/etc/mihomo"

  pick_target() {
    kind="$1"
    case "$kind" in
      geoip)
        for f in GeoIP.dat geoip.dat; do
          [ -f "$cfg_dir/$f" ] && { echo "$cfg_dir/$f"; return; }
        done
        echo "$cfg_dir/GeoIP.dat"
        ;;
      geosite)
        for f in GeoSite.dat geosite.dat; do
          [ -f "$cfg_dir/$f" ] && { echo "$cfg_dir/$f"; return; }
        done
        echo "$cfg_dir/GeoSite.dat"
        ;;
      asn)
        for f in ASN.mmdb GeoLite2-ASN.mmdb asn.mmdb; do
          [ -f "$cfg_dir/$f" ] && { echo "$cfg_dir/$f"; return; }
        done
        echo "$cfg_dir/ASN.mmdb"
        ;;
    esac
  }

  pick_fetcher() {
    # Prefer Entware wget/curl for HTTPS
    if [ -x /opt/bin/wget ]; then echo '/opt/bin/wget'; return; fi
    if command -v wget >/dev/null 2>&1; then echo 'wget'; return; fi
    if [ -x /opt/bin/curl ]; then echo '/opt/bin/curl'; return; fi
    if command -v curl >/dev/null 2>&1; then echo 'curl'; return; fi
    echo ''
  }

  fetcher="$(pick_fetcher)"

  dl_to() {
    url="$1"
    out="$2"
    tmp="${out}.tmp.$$"
    rm -f "$tmp" 2>/dev/null || true

    if [ -z "$fetcher" ]; then
      return 2
    fi

    if echo "$fetcher" | grep -q wget; then
      "$fetcher" -qO "$tmp" "$url" 2>/dev/null || return 1
    else
      "$fetcher" -fsSL "$url" -o "$tmp" 2>/dev/null || return 1
    fi

    sz="$(wc -c < "$tmp" 2>/dev/null || echo 0)"
    echo "$sz" | grep -qE '^[0-9]+$' || sz=0
    # sanity check: avoid overwriting with a tiny HTML error page
    [ "$sz" -ge 1024 ] || { rm -f "$tmp" 2>/dev/null || true; return 3; }

    mv -f "$tmp" "$out" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; return 4; }
    return 0
  }

  dl_to_any() {
    out="$1"; shift
    last_rc=1
    last_url=""
    for url in "$@"; do
      last_url="$url"
      dl_to "$url" "$out"
      rc=$?
      if [ $rc -eq 0 ]; then
        echo "$url"
        return 0
      fi
      last_rc=$rc
    done
    echo "$last_url"
    return $last_rc
  }

  # Targets
  t_geoip="$(pick_target geoip)"
  t_geosite="$(pick_target geosite)"
  t_asn="$(pick_target asn)"

  b_geoip=0; [ -f "$t_geoip" ] && b_geoip="$(stat_mtime_sec "$t_geoip")"
  b_geosite=0; [ -f "$t_geosite" ] && b_geosite="$(stat_mtime_sec "$t_geosite")"
  b_asn=0; [ -f "$t_asn" ] && b_asn="$(stat_mtime_sec "$t_asn")"

  # Try xkeen built-in updater when present
  used_xkeen=0
  if command -v xkeen >/dev/null 2>&1; then
    used_xkeen=1
    xkeen -ugi >/dev/null 2>&1 || true
    xkeen -ugs >/dev/null 2>&1 || true
  fi

  items=''
  first=1
  add_res() {
    kind="$1"; path="$2"; changed="$3"; ok="$4"; method_="$5"; src="$6"; err="$7"
    m=0; s=0
    if [ -f "$path" ]; then
      m="$(stat_mtime_sec "$path")"
      s="$(stat_size_bytes "$path")"
    fi
    [ "$first" -eq 0 ] && items="$items,"
    first=0
    items="$items{\"kind\":\"$(jesc "$kind")\",\"path\":\"$(jesc "$path")\",\"ok\":$ok,\"changed\":$changed,\"mtimeSec\":$m,\"sizeBytes\":$s,\"method\":\"$(jesc "$method_")\",\"source\":\"$(jesc "$src")\",\"error\":\"$(jesc "$err")\"}"
  }

  # Snapshot after xkeen attempt
  a_geoip=0; [ -f "$t_geoip" ] && a_geoip="$(stat_mtime_sec "$t_geoip")"
  a_geosite=0; [ -f "$t_geosite" ] && a_geosite="$(stat_mtime_sec "$t_geosite")"
  a_asn=0; [ -f "$t_asn" ] && a_asn="$(stat_mtime_sec "$t_asn")"

  # GEOIP
  if [ $used_xkeen -eq 1 ] && [ -f "$t_geoip" ] && [ "$a_geoip" -gt "$b_geoip" ]; then
    add_res geoip "$t_geoip" true true 'xkeen' 'xkeen -ugi' ''
  else
    rc=0
    used="$(dl_to_any "$t_geoip" "$GEOIP_URL"       "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip-lite.dat"       "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geoip.dat"       "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geoip.dat")"
    rc=$?
    if [ $rc -eq 0 ]; then
      add_res geoip "$t_geoip" true true 'download' "$used" ''
    else
      add_res geoip "$t_geoip" false false 'download' "$used" "download-failed($rc)"
    fi
  fi

  # GEOSITE
  if [ $used_xkeen -eq 1 ] && [ -f "$t_geosite" ] && [ "$a_geosite" -gt "$b_geosite" ]; then
    add_res geosite "$t_geosite" true true 'xkeen' 'xkeen -ugs' ''
  else
    rc=0
    used="$(dl_to_any "$t_geosite" "$GEOSITE_URL"       "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/geosite.dat"       "https://testingcf.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@release/geosite.dat")"
    rc=$?
    if [ $rc -eq 0 ]; then
      add_res geosite "$t_geosite" true true 'download' "$used" ''
    else
      add_res geosite "$t_geosite" false false 'download' "$used" "download-failed($rc)"
    fi
  fi

  # ASN
  if [ -f "$t_asn" ] && [ "$a_asn" -gt "$b_asn" ]; then
    add_res asn "$t_asn" true true 'xkeen' 'xkeen' ''
  else
    rc=0
    used="$(dl_to_any "$t_asn" "$ASN_URL"       "https://github.com/MetaCubeX/meta-rules-dat/releases/download/latest/GeoLite2-ASN.mmdb"       "https://github.com/xishang0128/geoip/releases/download/latest/GeoLite2-ASN.mmdb")"
    rc=$?
    if [ $rc -eq 0 ]; then
      add_res asn "$t_asn" true true 'download' "$used" ''
    else
      add_res asn "$t_asn" false false 'download' "$used" "download-failed($rc)"
    fi
  fi

  ok=true
  echo "$items" | grep -q '"ok":false' && ok=false

  if [ "$ok" = true ]; then
    reply_ok "{\"ok\":true,\"items\":[${items}],\"note\":\"Restart mihomo if geo data is cached.\"}"
  else
    reply_ok "{\"ok\":false,\"items\":[${items}],\"error\":\"some-downloads-failed\"}"
  fi
}



rules_info_json() {
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  cfg_dir="$(dirname "$MIHOMO_CONFIG" 2>/dev/null || echo /opt/etc/mihomo)"
  rules_dir=""
  for d in "$cfg_dir/rules" /opt/etc/mihomo/rules /opt/var/mihomo/rules /opt/share/mihomo/rules; do
    [ -d "$d" ] && rules_dir="$d" && break
  done

  if [ -z "$rules_dir" ]; then
    printf '{"ok":true,"dir":"","count":0,"newestMtimeSec":0,"oldestMtimeSec":0,"items":[]}'
    return
  fi

  tmp="/tmp/zash_rules.$$"
  : > "$tmp" 2>/dev/null || tmp="/tmp/zash_rules"

  count=0
  newest=0
  oldest=0

  # Scan up to 2 levels deep (rules/* and rules/*/*), including dotfiles.
  for f in "$rules_dir"/* "$rules_dir"/.[!.]* "$rules_dir"/..?* "$rules_dir"/*/* "$rules_dir"/*/.[!.]* "$rules_dir"/*/..?*; do
    [ -f "$f" ] || continue
    count=$((count + 1))
    m="$(stat_mtime_sec "$f")"
    echo "$m" | grep -qE '^[0-9]+$' || m=0
    s="$(stat_size_bytes "$f")"
    echo "$s" | grep -qE '^[0-9]+$' || s=0
    printf '%s|%s|%s
' "$m" "$s" "$f" >> "$tmp"
    [ "$m" -gt "$newest" ] && newest="$m"
    if [ "$oldest" -eq 0 ] || [ "$m" -lt "$oldest" ]; then
      oldest="$m"
    fi
  done

  # Build a short list (top 30 by mtime) to avoid large payloads.
  printf '{"ok":true,"dir":"%s","count":%s,"newestMtimeSec":%s,"oldestMtimeSec":%s,"items":[' "$(jesc "$rules_dir")" "$count" "$newest" "$oldest"
  first=1
  sort -t'|' -k1,1nr "$tmp" 2>/dev/null | head -n 30 | while IFS='|' read -r m s path; do
    [ -n "$path" ] || continue
    name="$(basename "$path")"
    [ "$first" -eq 0 ] && printf ','
    first=0
    printf '{"name":"%s","path":"%s","mtimeSec":%s,"sizeBytes":%s}' "$(jesc "$name")" "$(jesc "$path")" "$m" "$s"
  done
  printf ']}'
  rm -f "$tmp" 2>/dev/null
}



users_db_now_iso() {
  date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || echo ''
}

users_db_load_meta() {
  udb_rev=0
  udb_updatedAt=''
  if [ -f "$USERS_DB_META" ]; then
    udb_rev="$(sed -nE 's/.*"rev"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$USERS_DB_META" 2>/dev/null | head -n1)"
    udb_updatedAt="$(sed -nE 's/.*"updatedAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$USERS_DB_META" 2>/dev/null | head -n1)"
  fi
  echo "$udb_rev" | grep -qE '^[0-9]+$' || udb_rev=0
}

users_db_write_meta() {
  mkdir -p "$(dirname "$USERS_DB_META")" >/dev/null 2>&1 || true
  tmp="${USERS_DB_META}.tmp.$$"
  printf '{"rev":%s,"updatedAt":"%s"}' "$udb_rev" "$(jesc "$udb_updatedAt")" > "$tmp" 2>/dev/null || return 1
  mv -f "$tmp" "$USERS_DB_META" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; return 1; }
  return 0
}

users_db_init_if_missing() {
  mkdir -p "$(dirname "$USERS_DB_FILE")" >/dev/null 2>&1 || true
  if [ ! -f "$USERS_DB_FILE" ]; then
    printf '[]' > "$USERS_DB_FILE" 2>/dev/null || true
  fi
  users_db_load_meta
  if [ ! -f "$USERS_DB_META" ]; then
    udb_rev=0
    udb_updatedAt="$(users_db_now_iso)"
    users_db_write_meta >/dev/null 2>&1 || true
  fi
}


users_db_prune_revs() {
  max="$USERS_DB_REVS_MAX"
  echo "$max" | grep -qE '^[0-9]+$' || max=10
  [ "$max" -le 0 ] && max=10
  [ -d "$USERS_DB_REVS_DIR" ] || return 0

  revs="$(ls "$USERS_DB_REVS_DIR"/users-db.rev-*.meta.json 2>/dev/null | sed -nE 's/.*rev-([0-9]+)\.meta\.json/\1/p' | sort -n)"
  cnt="$(printf '%s\n' "$revs" | sed '/^$/d' | wc -l 2>/dev/null || echo 0)"
  echo "$cnt" | grep -qE '^[0-9]+$' || cnt=0
  if [ "$cnt" -le "$max" ]; then
    return 0
  fi
  rm_cnt=$((cnt - max))
  i=0
  printf '%s\n' "$revs" | sed '/^$/d' | while read r; do
    i=$((i+1))
    [ "$i" -le "$rm_cnt" ] || break
    rm -f "$USERS_DB_REVS_DIR/users-db.rev-$r.json" "$USERS_DB_REVS_DIR/users-db.rev-$r.meta.json" 2>/dev/null || true
  done
  return 0
}

users_db_snapshot_current() {
  mkdir -p "$USERS_DB_REVS_DIR" >/dev/null 2>&1 || true
  [ -d "$USERS_DB_REVS_DIR" ] || return 0

  # Snapshot current state (rev + updatedAt) before overwrite.
  snap_json="$USERS_DB_REVS_DIR/users-db.rev-$udb_rev.json"
  snap_meta="$USERS_DB_REVS_DIR/users-db.rev-$udb_rev.meta.json"
  cp "$USERS_DB_FILE" "$snap_json" 2>/dev/null || return 0
  printf '{"rev":%s,"updatedAt":"%s"}' "$udb_rev" "$(jesc "$udb_updatedAt")" > "$snap_meta" 2>/dev/null || true

  users_db_prune_revs >/dev/null 2>&1 || true
  return 0
}

users_db_read_rev_meta() {
  rev="$1"
  meta="$USERS_DB_REVS_DIR/users-db.rev-$rev.meta.json"
  r_updatedAt=''
  if [ -f "$meta" ]; then
    r_updatedAt="$(sed -nE 's/.*"updatedAt"[[:space:]]*:[[:space:]]*"([^"]*)".*/\1/p' "$meta" 2>/dev/null | head -n1)"
  fi
  echo "$r_updatedAt"
}

users_db_history_json() {
  users_db_init_if_missing

  echo "$USERS_DB_REVS_MAX" | grep -qE '^[0-9]+$' || USERS_DB_REVS_MAX=10

  printf 'Content-Type: application/json\n'
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo ""
  printf '{"ok":true,"items":['
  printf '{"rev":%s,"updatedAt":"%s","current":true}' "$udb_rev" "$(jesc "$udb_updatedAt")"

  if [ -d "$USERS_DB_REVS_DIR" ]; then
    # newest first (numeric)
    revs="$(ls "$USERS_DB_REVS_DIR"/users-db.rev-*.meta.json 2>/dev/null | sed -nE 's/.*rev-([0-9]+)\.meta\.json/\1/p' | sort -nr)"
    printf '%s\n' "$revs" | sed '/^$/d' | while read r; do
      [ -n "$r" ] || continue
      [ "$r" = "$udb_rev" ] && continue
      up="$(users_db_read_rev_meta "$r")"
      printf ',{"rev":%s,"updatedAt":"%s","current":false}' "$r" "$(jesc "$up")"
    done
  fi
  printf ']}'
}

users_db_get_rev_json() {
  req_rev="$1"
  echo "$req_rev" | grep -qE '^[0-9]+$' || req_rev=''
  [ -n "$req_rev" ] || { reply_ok '{"ok":false,"error":"bad-rev"}'; return; }

  users_db_init_if_missing
  if [ "$req_rev" = "$udb_rev" ]; then
    users_db_get_json
    return
  fi

  f="$USERS_DB_REVS_DIR/users-db.rev-$req_rev.json"
  if [ ! -f "$f" ]; then
    reply_ok '{"ok":false,"error":"not-found"}'
    return
  fi
  up="$(users_db_read_rev_meta "$req_rev")"
  content="$( (head -c 1048576 "$f" 2>/dev/null || cat "$f" 2>/dev/null || printf '[]') | b64enc )"
  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s","contentB64":"%s"}' "$req_rev" "$(jesc "$up")" "$content")"
}

users_db_restore_json() {
  req_rev="$1"
  echo "$req_rev" | grep -qE '^[0-9]+$' || req_rev=''

  if [ "$REQUEST_METHOD" != "POST" ]; then
    reply_ok '{"ok":false,"error":"method-not-allowed"}'
    return
  fi

  [ -n "$req_rev" ] || { reply_ok '{"ok":false,"error":"bad-rev"}'; return; }

  users_db_init_if_missing

  # Acquire lock (best effort)
  lockdir="${USERS_DB_FILE}.lock"
  if [ -d "$lockdir" ]; then
    lm="$(stat_mtime_sec "$lockdir")"
    now="$(date +%s 2>/dev/null || echo 0)"
    echo "$lm" | grep -qE '^[0-9]+$' || lm=0
    echo "$now" | grep -qE '^[0-9]+$' || now=0
    if [ "$lm" -gt 0 ] && [ "$now" -gt 0 ] && [ $((now - lm)) -gt 120 ]; then
      rmdir "$lockdir" 2>/dev/null || true
    fi
  fi

  i=0
  while ! mkdir "$lockdir" 2>/dev/null; do
    i=$((i+1))
    [ $i -ge 10 ] && { reply_ok '{"ok":false,"error":"busy"}'; return; }
    sleep 1 2>/dev/null || true
  done

  users_db_load_meta

  if [ "$req_rev" = "$udb_rev" ]; then
    rmdir "$lockdir" 2>/dev/null || true
    reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s","restoredFromRev":%s}' "$udb_rev" "$(jesc "$udb_updatedAt")" "$req_rev")"
    return
  fi

  f="$USERS_DB_REVS_DIR/users-db.rev-$req_rev.json"
  if [ ! -f "$f" ]; then
    rmdir "$lockdir" 2>/dev/null || true
    reply_ok '{"ok":false,"error":"not-found"}'
    return
  fi

  # Snapshot current before restore
  users_db_snapshot_current >/dev/null 2>&1 || true

  tmp="${USERS_DB_FILE}.tmp.$$"
  (head -c 1048576 "$f" 2>/dev/null || cat "$f" 2>/dev/null) > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; rmdir "$lockdir" 2>/dev/null || true; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mv -f "$tmp" "$USERS_DB_FILE" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; rmdir "$lockdir" 2>/dev/null || true; reply_ok '{"ok":false,"error":"write-failed"}'; return; }

  udb_rev=$((udb_rev + 1))
  udb_updatedAt="$(users_db_now_iso)"
  users_db_write_meta >/dev/null 2>&1 || true

  rmdir "$lockdir" 2>/dev/null || true

  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s","restoredFromRev":%s}' "$udb_rev" "$(jesc "$udb_updatedAt")" "$req_rev")"
}


users_db_get_json() {
  users_db_init_if_missing

  content="$( (head -c 1048576 "$USERS_DB_FILE" 2>/dev/null || cat "$USERS_DB_FILE" 2>/dev/null || printf '[]') | b64enc )"

  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s","contentB64":"%s"}' "$udb_rev" "$(jesc "$udb_updatedAt")" "$content")"
}

users_db_put_json() {
  expected_rev="$1"
  [ -n "$expected_rev" ] || expected_rev='-1'

  if [ "$REQUEST_METHOD" != "POST" ]; then
    reply_ok '{"ok":false,"error":"method-not-allowed"}'
    return
  fi

  users_db_init_if_missing

  # Acquire lock (best effort)
  lockdir="${USERS_DB_FILE}.lock"

  # Cleanup stale lock (>120s) to avoid deadlocks after crashes/reboots.
  if [ -d "$lockdir" ]; then
    lm="$(stat_mtime_sec "$lockdir")"
    now="$(date +%s 2>/dev/null || echo 0)"
    echo "$lm" | grep -qE '^[0-9]+$' || lm=0
    echo "$now" | grep -qE '^[0-9]+$' || now=0
    if [ "$lm" -gt 0 ] && [ "$now" -gt 0 ] && [ $((now - lm)) -gt 120 ]; then
      rmdir "$lockdir" 2>/dev/null || true
    fi
  fi

  i=0
  while ! mkdir "$lockdir" 2>/dev/null; do
    i=$((i+1))
    [ $i -ge 10 ] && { reply_ok '{"ok":false,"error":"busy"}'; return; }
    sleep 1 2>/dev/null || true
  done

  # Reload meta under lock
  users_db_load_meta

  echo "$expected_rev" | grep -qE '^-?[0-9]+$' || expected_rev='-1'
  if [ "$expected_rev" != "$udb_rev" ]; then
    content="$( (head -c 1048576 "$USERS_DB_FILE" 2>/dev/null || cat "$USERS_DB_FILE" 2>/dev/null || printf '[]') | b64enc )"
    rmdir "$lockdir" 2>/dev/null || true
    reply_ok "$(printf '{"ok":false,"error":"conflict","rev":%s,"updatedAt":"%s","contentB64":"%s"}' "$udb_rev" "$(jesc "$udb_updatedAt")" "$content")"
    return
  fi

  users_db_snapshot_current >/dev/null 2>&1 || true

  body=""
  if [ -n "$CONTENT_LENGTH" ] && echo "$CONTENT_LENGTH" | grep -qE '^[0-9]+$'; then
    # Read exactly Content-Length bytes to avoid blocking on CGI stdin.
    body="$(head -c "$CONTENT_LENGTH" 2>/dev/null || dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null || true)"
  else
    body="$(cat 2>/dev/null || true)"
  fi
  [ -n "$body" ] || body='[]'

  # Basic size guard (~1 MiB)
  sz="$(printf '%s' "$body" | wc -c 2>/dev/null || echo 0)"
  echo "$sz" | grep -qE '^[0-9]+$' || sz=0
  if [ "$sz" -gt 1048576 ]; then
    rmdir "$lockdir" 2>/dev/null || true
    reply_ok '{"ok":false,"error":"too-large"}'
    return
  fi

  tmp="${USERS_DB_FILE}.tmp.$$"
  printf '%s' "$body" > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; rmdir "$lockdir" 2>/dev/null || true; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mv -f "$tmp" "$USERS_DB_FILE" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; rmdir "$lockdir" 2>/dev/null || true; reply_ok '{"ok":false,"error":"write-failed"}'; return; }

  udb_rev=$((udb_rev + 1))
  udb_updatedAt="$(users_db_now_iso)"
  users_db_write_meta >/dev/null 2>&1 || true

  rmdir "$lockdir" 2>/dev/null || true

  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s"}' "$udb_rev" "$(jesc "$udb_updatedAt")")"
}


mihomo_cfg_now_iso() {
  date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || echo ''
}

mihomo_cfg_file_size() {
  f="$1"
  [ -f "$f" ] || {
    echo 0
    return
  }
  sz="$(wc -c < "$f" 2>/dev/null || echo 0)"
  echo "$sz" | grep -qE '^[0-9]+$' || sz=0
  echo "$sz"
}

mihomo_cfg_load_meta() {
  mcfg_activeRev=0
  mcfg_activeUpdatedAt=''
  mcfg_draftRev=0
  mcfg_draftUpdatedAt=''
  mcfg_baselineUpdatedAt=''
  mcfg_lastApplyStatus='idle'
  mcfg_lastApplyAt=''
  mcfg_lastApplySource=''
  mcfg_lastError=''
  mcfg_lastSuccessfulRev=0
  mcfg_lastSuccessfulAt=''
  mcfg_lastSuccessfulSource=''
  if [ -f "$MIHOMO_CFG_META" ]; then
    mcfg_activeRev="$(sed -nE 's/.*"activeRev"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_activeUpdatedAt="$(sed -nE 's/.*"activeUpdatedAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_draftRev="$(sed -nE 's/.*"draftRev"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_draftUpdatedAt="$(sed -nE 's/.*"draftUpdatedAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_baselineUpdatedAt="$(sed -nE 's/.*"baselineUpdatedAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastApplyStatus="$(sed -nE 's/.*"lastApplyStatus"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastApplyAt="$(sed -nE 's/.*"lastApplyAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastApplySource="$(sed -nE 's/.*"lastApplySource"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastError="$(sed -nE 's/.*"lastError"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastSuccessfulRev="$(sed -nE 's/.*"lastSuccessfulRev"[[:space:]]*:[[:space:]]*([0-9]+).*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastSuccessfulAt="$(sed -nE 's/.*"lastSuccessfulAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
    mcfg_lastSuccessfulSource="$(sed -nE 's/.*"lastSuccessfulSource"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$MIHOMO_CFG_META" 2>/dev/null | head -n1)"
  fi
  echo "$mcfg_activeRev" | grep -qE '^[0-9]+$' || mcfg_activeRev=0
  echo "$mcfg_draftRev" | grep -qE '^[0-9]+$' || mcfg_draftRev=0
  echo "$mcfg_lastSuccessfulRev" | grep -qE '^[0-9]+$' || mcfg_lastSuccessfulRev=0
  [ -n "$mcfg_lastApplyStatus" ] || mcfg_lastApplyStatus='idle'
}

mihomo_cfg_write_meta() {
  mkdir -p "$MIHOMO_CFG_DIR" >/dev/null 2>&1 || true
  tmp="$MIHOMO_CFG_META.tmp.$$"
  printf '{"activeRev":%s,"activeUpdatedAt":"%s","draftRev":%s,"draftUpdatedAt":"%s","baselineUpdatedAt":"%s","lastApplyStatus":"%s","lastApplyAt":"%s","lastApplySource":"%s","lastError":"%s","lastSuccessfulRev":%s,"lastSuccessfulAt":"%s","lastSuccessfulSource":"%s"}' \
    "$mcfg_activeRev" "$(jesc "$mcfg_activeUpdatedAt")" \
    "$mcfg_draftRev" "$(jesc "$mcfg_draftUpdatedAt")" \
    "$(jesc "$mcfg_baselineUpdatedAt")" \
    "$(jesc "$mcfg_lastApplyStatus")" \
    "$(jesc "$mcfg_lastApplyAt")" \
    "$(jesc "$mcfg_lastApplySource")" \
    "$(jesc "$mcfg_lastError")" \
    "$mcfg_lastSuccessfulRev" "$(jesc "$mcfg_lastSuccessfulAt")" "$(jesc "$mcfg_lastSuccessfulSource")" > "$tmp" 2>/dev/null || return 1
  mv -f "$tmp" "$MIHOMO_CFG_META" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; return 1; }
  return 0
}

mihomo_cfg_init_if_missing() {
  mkdir -p "$MIHOMO_CFG_DIR" "$MIHOMO_CFG_REVS_DIR" >/dev/null 2>&1 || true
  mihomo_cfg_load_meta
  if [ -f "$MIHOMO_CONFIG" ] && [ ! -f "$MIHOMO_CFG_BASELINE_FILE" ]; then
    cp "$MIHOMO_CONFIG" "$MIHOMO_CFG_BASELINE_FILE" 2>/dev/null || true
    [ -n "$mcfg_baselineUpdatedAt" ] || mcfg_baselineUpdatedAt="$(mihomo_cfg_now_iso)"
  fi
  if [ ! -f "$MIHOMO_CFG_META" ]; then
    if [ -f "$MIHOMO_CONFIG" ] && [ "$mcfg_activeRev" -le 0 ]; then
      mcfg_activeRev=1
      mcfg_activeUpdatedAt="$(mihomo_cfg_now_iso)"
    fi
    if [ -f "$MIHOMO_CFG_DRAFT_FILE" ] && [ "$mcfg_draftRev" -le 0 ]; then
      mcfg_draftRev=1
      mcfg_draftUpdatedAt="$(mihomo_cfg_now_iso)"
    fi
    [ -n "$mcfg_baselineUpdatedAt" ] || [ ! -f "$MIHOMO_CFG_BASELINE_FILE" ] || mcfg_baselineUpdatedAt="$(mihomo_cfg_now_iso)"
    mihomo_cfg_write_meta >/dev/null 2>&1 || true
  fi
  if [ -f "$MIHOMO_CONFIG" ] && [ "$mcfg_lastSuccessfulRev" -le 0 ]; then
    [ "$mcfg_activeRev" -gt 0 ] || mcfg_activeRev=1
    [ -n "$mcfg_activeUpdatedAt" ] || mcfg_activeUpdatedAt="$(mihomo_cfg_now_iso)"
    mcfg_lastSuccessfulRev="$mcfg_activeRev"
    mcfg_lastSuccessfulAt="$mcfg_activeUpdatedAt"
    [ -n "$mcfg_lastSuccessfulSource" ] || mcfg_lastSuccessfulSource='active'
    mihomo_cfg_write_meta >/dev/null 2>&1 || true
  fi
}

mihomo_cfg_prune_revs() {
  max="$MIHOMO_CFG_REVS_MAX"
  echo "$max" | grep -qE '^[0-9]+$' || max=10
  [ "$max" -le 0 ] && max=10
  [ -d "$MIHOMO_CFG_REVS_DIR" ] || return 0
  revs="$(ls "$MIHOMO_CFG_REVS_DIR"/rev-*.meta.json 2>/dev/null | sed -nE 's/.*rev-([0-9]+)\.meta\.json/\1/p' | sort -n)"
  cnt="$(printf '%s\n' "$revs" | sed '/^$/d' | wc -l 2>/dev/null || echo 0)"
  echo "$cnt" | grep -qE '^[0-9]+$' || cnt=0
  if [ "$cnt" -le "$max" ]; then
    return 0
  fi
  rm_cnt=$((cnt - max))
  i=0
  printf '%s\n' "$revs" | sed '/^$/d' | while read r; do
    i=$((i+1))
    [ "$i" -le "$rm_cnt" ] || break
    rm -f "$MIHOMO_CFG_REVS_DIR/rev-$r.yaml" "$MIHOMO_CFG_REVS_DIR/rev-$r.meta.json" 2>/dev/null || true
  done
  return 0
}

mihomo_cfg_snapshot_current() {
  [ -f "$MIHOMO_CONFIG" ] || return 0
  mkdir -p "$MIHOMO_CFG_REVS_DIR" >/dev/null 2>&1 || true
  [ "$mcfg_activeRev" -gt 0 ] || return 0
  snap_yaml="$MIHOMO_CFG_REVS_DIR/rev-$mcfg_activeRev.yaml"
  snap_meta="$MIHOMO_CFG_REVS_DIR/rev-$mcfg_activeRev.meta.json"
  cp "$MIHOMO_CONFIG" "$snap_yaml" 2>/dev/null || return 0
  printf '{"rev":%s,"updatedAt":"%s","source":"%s"}' "$mcfg_activeRev" "$(jesc "$mcfg_activeUpdatedAt")" "$(jesc "$mcfg_lastApplySource")" > "$snap_meta" 2>/dev/null || true
  mihomo_cfg_prune_revs >/dev/null 2>&1 || true
  return 0
}

mihomo_cfg_read_rev_meta() {
  rev="$1"
  meta="$MIHOMO_CFG_REVS_DIR/rev-$rev.meta.json"
  r_updatedAt=''
  r_source=''
  if [ -f "$meta" ]; then
    r_updatedAt="$(sed -nE 's/.*"updatedAt"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$meta" 2>/dev/null | head -n1)"
    r_source="$(sed -nE 's/.*"source"[[:space:]]*:[[:space:]]*"([^\"]*)".*/\1/p' "$meta" 2>/dev/null | head -n1)"
  fi
}

mihomo_cfg_lock_acquire() {
  lockdir="$MIHOMO_CFG_DIR/apply.lock"
  if [ -d "$lockdir" ]; then
    lm="$(stat_mtime_sec "$lockdir")"
    now="$(date +%s 2>/dev/null || echo 0)"
    echo "$lm" | grep -qE '^[0-9]+$' || lm=0
    echo "$now" | grep -qE '^[0-9]+$' || now=0
    if [ "$lm" -gt 0 ] && [ "$now" -gt 0 ] && [ $((now - lm)) -gt 120 ]; then
      rmdir "$lockdir" 2>/dev/null || true
    fi
  fi
  i=0
  while ! mkdir "$lockdir" 2>/dev/null; do
    i=$((i+1))
    [ $i -ge 10 ] && return 1
    sleep 1 2>/dev/null || true
  done
  return 0
}

mihomo_cfg_lock_release() {
  rmdir "$MIHOMO_CFG_DIR/apply.lock" 2>/dev/null || true
}

mihomo_cfg_detect_validator() {
  if command -v mihomo >/dev/null 2>&1; then
    echo "mihomo"
    return
  fi
  if command -v clash-meta >/dev/null 2>&1; then
    echo "clash-meta"
    return
  fi
  echo ""
}

mihomo_cfg_find_init() {
  for init in /opt/etc/init.d/S99mihomo /opt/etc/init.d/S98mihomo /opt/etc/init.d/S99clash /opt/etc/init.d/S98clash /etc/init.d/mihomo /etc/init.d/clash-meta; do
    [ -x "$init" ] && {
      echo "$init"
      return
    }
  done
  echo ""
}

mihomo_cfg_is_running() {
  if command -v pidof >/dev/null 2>&1; then
    pidof mihomo >/dev/null 2>&1 && return 0
    pidof clash-meta >/dev/null 2>&1 && return 0
  fi
  ps 2>/dev/null | grep -E '[m]ihomo|[c]lash-meta' >/dev/null 2>&1 && return 0
  return 1
}

mihomo_cfg_validate_file() {
  f="$1"
  validate_rc=1
  validate_output=''
  validate_cmd=''
  [ -f "$f" ] || {
    validate_rc=1
    validate_output='config-not-found'
    return 1
  }
  bin="$(mihomo_cfg_detect_validator)"
  [ -n "$bin" ] || {
    validate_rc=127
    validate_output='validator-unavailable'
    return 127
  }
  d="$(dirname "$f" 2>/dev/null || echo /opt/etc/mihomo)"
  f_q="$(printf '%s' "$f" | sed "s/'/'\\''/g")"
  d_q="$(printf '%s' "$d" | sed "s/'/'\\''/g")"
  for args in "-t -f '$f_q'" "-t -d '$d_q' -f '$f_q'"; do
    out="$(run_with_timeout_sh 20 "$bin $args" 2>&1)"
    rc="$?"
    validate_cmd="$bin $args"
    if [ "$rc" -eq 0 ]; then
      validate_rc=0
      validate_output="$out"
      return 0
    fi
    validate_rc="$rc"
    validate_output="$out"
  done
  return 1
}

mihomo_cfg_restart_core() {
  restart_rc=1
  restart_output=''
  restart_method=''
  init="$(mihomo_cfg_find_init)"
  if [ -n "$init" ]; then
    out="$("$init" restart 2>&1)"
    rc="$?"
    restart_method='init'
    restart_output="$out"
    restart_rc="$rc"
  else
    restart_method='signal'
    pids="$(pidof mihomo 2>/dev/null || true) $(pidof clash-meta 2>/dev/null || true)"
    pids="$(printf '%s' "$pids" | tr '\n\t' '  ' | sed 's/  */ /g; s/^ //; s/ $//')"
    if [ -n "$pids" ]; then
      kill -HUP $pids >/dev/null 2>&1 || true
      restart_output='sent-HUP'
      restart_rc=0
    else
      restart_output='restart-method-not-found'
      restart_rc=1
    fi
  fi
  i=0
  while [ $i -lt 6 ]; do
    mihomo_cfg_is_running && break
    sleep 1 2>/dev/null || true
    i=$((i+1))
  done
  mihomo_cfg_is_running
  running_rc="$?"
  if [ "$running_rc" -ne 0 ] && [ "$restart_rc" -eq 0 ]; then
    restart_rc=1
    [ -n "$restart_output" ] && restart_output="$restart_output\nnot-running-after-restart" || restart_output='not-running-after-restart'
  fi
  return "$restart_rc"
}

mihomo_cfg_state_json() {
  mihomo_cfg_init_if_missing
  validator_bin="$(mihomo_cfg_detect_validator)"
  restart_init="$(mihomo_cfg_find_init)"
  [ -n "$validator_bin" ] && validator_available=true || validator_available=false
  if [ -n "$restart_init" ]; then
    restart_available=true
    restart_mode='init'
  elif mihomo_cfg_is_running; then
    restart_available=true
    restart_mode='signal'
  else
    restart_available=false
    restart_mode=''
  fi
  active_exists=false; [ -f "$MIHOMO_CONFIG" ] && active_exists=true
  draft_exists=false; [ -f "$MIHOMO_CFG_DRAFT_FILE" ] && draft_exists=true
  baseline_exists=false; [ -f "$MIHOMO_CFG_BASELINE_FILE" ] && baseline_exists=true
  last_success_exists=false
  if [ "$mcfg_lastSuccessfulRev" -gt 0 ]; then
    if [ "$mcfg_lastSuccessfulRev" = "$mcfg_activeRev" ] && [ -f "$MIHOMO_CONFIG" ]; then
      last_success_exists=true
    elif [ -f "$MIHOMO_CFG_REVS_DIR/rev-$mcfg_lastSuccessfulRev.yaml" ]; then
      last_success_exists=true
    fi
  fi
  last_success_current=false
  [ "$mcfg_lastSuccessfulRev" -gt 0 ] && [ "$mcfg_lastSuccessfulRev" = "$mcfg_activeRev" ] && last_success_current=true
  reply_ok "$(printf '{"ok":true,"active":{"path":"%s","rev":%s,"updatedAt":"%s","exists":%s,"sizeBytes":%s},"draft":{"path":"%s","rev":%s,"updatedAt":"%s","exists":%s,"sizeBytes":%s},"baseline":{"path":"%s","updatedAt":"%s","exists":%s,"sizeBytes":%s},"lastApplyStatus":"%s","lastApplyAt":"%s","lastApplySource":"%s","lastError":"%s","lastSuccessful":{"rev":%s,"updatedAt":"%s","source":"%s","exists":%s,"current":%s},"validator":{"available":%s,"bin":"%s"},"restart":{"available":%s,"mode":"%s"}}' \
    "$(jesc "$MIHOMO_CONFIG")" "$mcfg_activeRev" "$(jesc "$mcfg_activeUpdatedAt")" "$active_exists" "$(mihomo_cfg_file_size "$MIHOMO_CONFIG")" \
    "$(jesc "$MIHOMO_CFG_DRAFT_FILE")" "$mcfg_draftRev" "$(jesc "$mcfg_draftUpdatedAt")" "$draft_exists" "$(mihomo_cfg_file_size "$MIHOMO_CFG_DRAFT_FILE")" \
    "$(jesc "$MIHOMO_CFG_BASELINE_FILE")" "$(jesc "$mcfg_baselineUpdatedAt")" "$baseline_exists" "$(mihomo_cfg_file_size "$MIHOMO_CFG_BASELINE_FILE")" \
    "$(jesc "$mcfg_lastApplyStatus")" "$(jesc "$mcfg_lastApplyAt")" "$(jesc "$mcfg_lastApplySource")" "$(jesc "$mcfg_lastError")" \
    "$mcfg_lastSuccessfulRev" "$(jesc "$mcfg_lastSuccessfulAt")" "$(jesc "$mcfg_lastSuccessfulSource")" "$last_success_exists" "$last_success_current" \
    "$validator_available" "$(jesc "$validator_bin")" "$restart_available" "$(jesc "$restart_mode")")"
}

mihomo_cfg_get_json() {
  kind="$1"
  mihomo_cfg_init_if_missing
  case "$kind" in
    active)
      f="$MIHOMO_CONFIG"
      rev="$mcfg_activeRev"
      updatedAt="$mcfg_activeUpdatedAt"
      ;;
    draft)
      f="$MIHOMO_CFG_DRAFT_FILE"
      rev="$mcfg_draftRev"
      updatedAt="$mcfg_draftUpdatedAt"
      ;;
    baseline)
      f="$MIHOMO_CFG_BASELINE_FILE"
      rev=''
      updatedAt="$mcfg_baselineUpdatedAt"
      ;;
    *)
      reply_ok '{"ok":false,"error":"bad-kind"}'
      return
      ;;
  esac
  [ -f "$f" ] || {
    reply_ok '{"ok":false,"error":"not-found"}'
    return
  }
  content="$( (head -c 1048576 "$f" 2>/dev/null || cat "$f" 2>/dev/null || printf '') | b64enc )"
  reply_ok "$(printf '{"ok":true,"kind":"%s","path":"%s","rev":%s,"updatedAt":"%s","contentB64":"%s"}' "$(jesc "$kind")" "$(jesc "$f")" "${rev:-0}" "$(jesc "$updatedAt")" "$content")"
}

mihomo_cfg_put_json() {
  kind="$1"
  [ "$REQUEST_METHOD" = "POST" ] || { reply_ok '{"ok":false,"error":"method-not-allowed"}'; return; }
  [ "$kind" = 'draft' ] || { reply_ok '{"ok":false,"error":"bad-kind"}'; return; }
  mihomo_cfg_init_if_missing
  mihomo_cfg_lock_acquire || { reply_ok '{"ok":false,"error":"busy"}'; return; }
  body=''
  if [ -n "$CONTENT_LENGTH" ] && echo "$CONTENT_LENGTH" | grep -qE '^[0-9]+$'; then
    body="$(head -c "$CONTENT_LENGTH" 2>/dev/null || dd bs=1 count="$CONTENT_LENGTH" 2>/dev/null || true)"
  else
    body="$(cat 2>/dev/null || true)"
  fi
  sz="$(printf '%s' "$body" | wc -c 2>/dev/null || echo 0)"
  echo "$sz" | grep -qE '^[0-9]+$' || sz=0
  if [ "$sz" -gt 1048576 ]; then
    mihomo_cfg_lock_release
    reply_ok '{"ok":false,"error":"too-large"}'
    return
  fi
  tmp="$MIHOMO_CFG_DRAFT_FILE.tmp.$$"
  printf '%s' "$body" > "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mv -f "$tmp" "$MIHOMO_CFG_DRAFT_FILE" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mcfg_draftRev=$((mcfg_draftRev + 1))
  mcfg_draftUpdatedAt="$(mihomo_cfg_now_iso)"
  mcfg_lastError=''
  mihomo_cfg_write_meta >/dev/null 2>&1 || true
  mihomo_cfg_lock_release
  reply_ok "$(printf '{"ok":true,"kind":"draft","rev":%s,"updatedAt":"%s"}' "$mcfg_draftRev" "$(jesc "$mcfg_draftUpdatedAt")")"
}

mihomo_cfg_copy_json() {
  from="$1"
  to="$2"
  [ "$REQUEST_METHOD" = "POST" ] || { reply_ok '{"ok":false,"error":"method-not-allowed"}'; return; }
  [ "$to" = 'draft' ] || { reply_ok '{"ok":false,"error":"bad-target"}'; return; }
  case "$from" in
    active) src="$MIHOMO_CONFIG" ;;
    baseline) src="$MIHOMO_CFG_BASELINE_FILE" ;;
    *) reply_ok '{"ok":false,"error":"bad-source"}'; return ;;
  esac
  [ -f "$src" ] || { reply_ok '{"ok":false,"error":"not-found"}'; return; }
  mihomo_cfg_init_if_missing
  mihomo_cfg_lock_acquire || { reply_ok '{"ok":false,"error":"busy"}'; return; }
  tmp="$MIHOMO_CFG_DRAFT_FILE.tmp.$$"
  cp "$src" "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mv -f "$tmp" "$MIHOMO_CFG_DRAFT_FILE" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mcfg_draftRev=$((mcfg_draftRev + 1))
  mcfg_draftUpdatedAt="$(mihomo_cfg_now_iso)"
  mcfg_lastError=''
  mihomo_cfg_write_meta >/dev/null 2>&1 || true
  mihomo_cfg_lock_release
  reply_ok "$(printf '{"ok":true,"from":"%s","to":"%s","rev":%s,"updatedAt":"%s"}' "$(jesc "$from")" "$(jesc "$to")" "$mcfg_draftRev" "$(jesc "$mcfg_draftUpdatedAt")")"
}

mihomo_cfg_validate_json() {
  kind="$1"
  case "$kind" in
    active) f="$MIHOMO_CONFIG" ;;
    draft) f="$MIHOMO_CFG_DRAFT_FILE" ;;
    baseline) f="$MIHOMO_CFG_BASELINE_FILE" ;;
    *) reply_ok '{"ok":false,"error":"bad-kind"}'; return ;;
  esac
  mihomo_cfg_validate_file "$f"
  ok=false
  [ "$validate_rc" -eq 0 ] && ok=true
  reply_ok "$(printf '{"ok":%s,"phase":"validate","kind":"%s","cmd":"%s","exitCode":%s,"output":"%s"}' "$ok" "$(jesc "$kind")" "$(jesc "$validate_cmd")" "${validate_rc:-1}" "$(jesc "$validate_output")")"
}

mihomo_cfg_apply_path() {
  src="$1"
  source_name="$2"
  [ -f "$src" ] || {
    reply_ok '{"ok":false,"error":"not-found"}'
    return
  }
  mihomo_cfg_init_if_missing
  mihomo_cfg_lock_acquire || { reply_ok '{"ok":false,"error":"busy"}'; return; }
  mihomo_cfg_load_meta

  first_restart_method=''
  first_restart_output=''
  rollback_restart_method=''
  rollback_restart_output=''
  baseline_restart_method=''
  baseline_restart_output=''
  recovery='none'

  mihomo_cfg_validate_file "$src"
  if [ "$validate_rc" -ne 0 ]; then
    mcfg_lastApplyStatus='validate-failed'
    mcfg_lastApplyAt="$(mihomo_cfg_now_iso)"
    mcfg_lastApplySource="$source_name"
    mcfg_lastError="$validate_output"
    mihomo_cfg_write_meta >/dev/null 2>&1 || true
    mihomo_cfg_lock_release
    reply_ok "$(printf '{"ok":false,"phase":"validate","error":"validation-failed","source":"%s","cmd":"%s","exitCode":%s,"output":"%s"}' "$(jesc "$source_name")" "$(jesc "$validate_cmd")" "${validate_rc:-1}" "$(jesc "$validate_output")")"
    return
  fi

  backup="$MIHOMO_CFG_DIR/active.rollback.yaml"
  if [ -f "$MIHOMO_CONFIG" ]; then
    cp "$MIHOMO_CONFIG" "$backup" 2>/dev/null || true
    mihomo_cfg_snapshot_current >/dev/null 2>&1 || true
  else
    rm -f "$backup" 2>/dev/null || true
  fi

  tmp="$MIHOMO_CONFIG.tmp.$$"
  cp "$src" "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"phase":"apply","error":"write-failed"}'; return; }
  mv -f "$tmp" "$MIHOMO_CONFIG" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"phase":"apply","error":"write-failed"}'; return; }

  mihomo_cfg_restart_core
  first_restart_method="$restart_method"
  first_restart_output="$restart_output"
  if [ "$restart_rc" -ne 0 ]; then
    if [ -f "$backup" ]; then
      cp "$backup" "$MIHOMO_CONFIG" 2>/dev/null || true
      mihomo_cfg_restart_core
      rollback_restart_method="$restart_method"
      rollback_restart_output="$restart_output"
      if [ "$restart_rc" -eq 0 ]; then
        recovery='previous-active'
        mcfg_lastApplyStatus='rolled-back'
        mcfg_lastApplyAt="$(mihomo_cfg_now_iso)"
        mcfg_lastApplySource="$source_name"
        mcfg_lastError='apply-failed-restored-previous'
        mihomo_cfg_write_meta >/dev/null 2>&1 || true
        mihomo_cfg_lock_release
        reply_ok "$(printf '{"ok":false,"phase":"restart","error":"apply-failed","source":"%s","recovery":"%s","restored":"previous-active","validateCmd":"%s","firstRestartMethod":"%s","firstRestartOutput":"%s","rollbackRestartMethod":"%s","rollbackRestartOutput":"%s"}' "$(jesc "$source_name")" "$(jesc "$recovery")" "$(jesc "$validate_cmd")" "$(jesc "$first_restart_method")" "$(jesc "$first_restart_output")" "$(jesc "$rollback_restart_method")" "$(jesc "$rollback_restart_output")")"
        return
      fi
    fi
    if [ -f "$MIHOMO_CFG_BASELINE_FILE" ]; then
      cp "$MIHOMO_CFG_BASELINE_FILE" "$MIHOMO_CONFIG" 2>/dev/null || true
      mihomo_cfg_restart_core
      baseline_restart_method="$restart_method"
      baseline_restart_output="$restart_output"
      if [ "$restart_rc" -eq 0 ]; then
        recovery='baseline'
        mcfg_activeRev=$((mcfg_activeRev + 1))
        mcfg_activeUpdatedAt="$(mihomo_cfg_now_iso)"
        mcfg_lastApplyStatus='restored-baseline'
        mcfg_lastApplyAt="$mcfg_activeUpdatedAt"
        mcfg_lastApplySource='baseline'
        mcfg_lastError='apply-failed-restored-baseline'
        mcfg_lastSuccessfulRev="$mcfg_activeRev"
        mcfg_lastSuccessfulAt="$mcfg_activeUpdatedAt"
        mcfg_lastSuccessfulSource='baseline'
        mihomo_cfg_write_meta >/dev/null 2>&1 || true
        mihomo_cfg_lock_release
        reply_ok "$(printf '{"ok":false,"phase":"restart","error":"apply-failed","source":"%s","recovery":"%s","restored":"baseline","rev":%s,"updatedAt":"%s","validateCmd":"%s","firstRestartMethod":"%s","firstRestartOutput":"%s","rollbackRestartMethod":"%s","rollbackRestartOutput":"%s","baselineRestartMethod":"%s","baselineRestartOutput":"%s"}' "$(jesc "$source_name")" "$(jesc "$recovery")" "$mcfg_activeRev" "$(jesc "$mcfg_activeUpdatedAt")" "$(jesc "$validate_cmd")" "$(jesc "$first_restart_method")" "$(jesc "$first_restart_output")" "$(jesc "$rollback_restart_method")" "$(jesc "$rollback_restart_output")" "$(jesc "$baseline_restart_method")" "$(jesc "$baseline_restart_output")")"
        return
      fi
    fi
    recovery='failed'
    mcfg_lastApplyStatus='failed'
    mcfg_lastApplyAt="$(mihomo_cfg_now_iso)"
    mcfg_lastApplySource="$source_name"
    mcfg_lastError="$restart_output"
    mihomo_cfg_write_meta >/dev/null 2>&1 || true
    mihomo_cfg_lock_release
    reply_ok "$(printf '{"ok":false,"phase":"restart","error":"restart-failed","source":"%s","recovery":"%s","validateCmd":"%s","firstRestartMethod":"%s","firstRestartOutput":"%s","rollbackRestartMethod":"%s","rollbackRestartOutput":"%s","baselineRestartMethod":"%s","baselineRestartOutput":"%s","restartMethod":"%s","restartOutput":"%s"}' "$(jesc "$source_name")" "$(jesc "$recovery")" "$(jesc "$validate_cmd")" "$(jesc "$first_restart_method")" "$(jesc "$first_restart_output")" "$(jesc "$rollback_restart_method")" "$(jesc "$rollback_restart_output")" "$(jesc "$baseline_restart_method")" "$(jesc "$baseline_restart_output")" "$(jesc "$restart_method")" "$(jesc "$restart_output")")"
    return
  fi

  mcfg_activeRev=$((mcfg_activeRev + 1))
  mcfg_activeUpdatedAt="$(mihomo_cfg_now_iso)"
  mcfg_lastApplyStatus='ok'
  mcfg_lastApplyAt="$mcfg_activeUpdatedAt"
  mcfg_lastApplySource="$source_name"
  mcfg_lastError=''
  mcfg_lastSuccessfulRev="$mcfg_activeRev"
  mcfg_lastSuccessfulAt="$mcfg_activeUpdatedAt"
  mcfg_lastSuccessfulSource="$source_name"
  mihomo_cfg_write_meta >/dev/null 2>&1 || true
  mihomo_cfg_lock_release
  reply_ok "$(printf '{"ok":true,"phase":"apply","rev":%s,"updatedAt":"%s","appliedFrom":"%s","recovery":"none","restartMethod":"%s","restartOutput":"%s","validateCmd":"%s"}' "$mcfg_activeRev" "$(jesc "$mcfg_activeUpdatedAt")" "$(jesc "$source_name")" "$(jesc "$first_restart_method")" "$(jesc "$first_restart_output")" "$(jesc "$validate_cmd")")"
}

mihomo_cfg_apply_json() {
  [ "$REQUEST_METHOD" = "POST" ] || { reply_ok '{"ok":false,"error":"method-not-allowed"}'; return; }
  mihomo_cfg_apply_path "$MIHOMO_CFG_DRAFT_FILE" 'draft'
}

mihomo_cfg_set_baseline_from_active_json() {
  [ "$REQUEST_METHOD" = "POST" ] || { reply_ok '{"ok":false,"error":"method-not-allowed"}'; return; }
  [ -f "$MIHOMO_CONFIG" ] || { reply_ok '{"ok":false,"error":"config-not-found"}'; return; }
  mihomo_cfg_init_if_missing
  mihomo_cfg_lock_acquire || { reply_ok '{"ok":false,"error":"busy"}'; return; }
  tmp="$MIHOMO_CFG_BASELINE_FILE.tmp.$$"
  cp "$MIHOMO_CONFIG" "$tmp" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mv -f "$tmp" "$MIHOMO_CFG_BASELINE_FILE" 2>/dev/null || { rm -f "$tmp" 2>/dev/null || true; mihomo_cfg_lock_release; reply_ok '{"ok":false,"error":"write-failed"}'; return; }
  mcfg_baselineUpdatedAt="$(mihomo_cfg_now_iso)"
  mihomo_cfg_write_meta >/dev/null 2>&1 || true
  mihomo_cfg_lock_release
  reply_ok "$(printf '{"ok":true,"updatedAt":"%s"}' "$(jesc "$mcfg_baselineUpdatedAt")")"
}

mihomo_cfg_restore_baseline_json() {
  [ "$REQUEST_METHOD" = "POST" ] || { reply_ok '{"ok":false,"error":"method-not-allowed"}'; return; }
  mihomo_cfg_apply_path "$MIHOMO_CFG_BASELINE_FILE" 'baseline'
}

mihomo_cfg_history_json() {
  mihomo_cfg_init_if_missing
  printf 'Content-Type: application/json\n'
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo ""
  printf '{"ok":true,"items":['
  printf '{"rev":%s,"updatedAt":"%s","current":true,"source":"%s"}' "$mcfg_activeRev" "$(jesc "$mcfg_activeUpdatedAt")" "$(jesc "$mcfg_lastApplySource")"
  if [ -d "$MIHOMO_CFG_REVS_DIR" ]; then
    revs="$(ls "$MIHOMO_CFG_REVS_DIR"/rev-*.meta.json 2>/dev/null | sed -nE 's/.*rev-([0-9]+)\.meta\.json/\1/p' | sort -nr)"
    printf '%s\n' "$revs" | sed '/^$/d' | while read r; do
      [ -n "$r" ] || continue
      [ "$r" = "$mcfg_activeRev" ] && continue
      mihomo_cfg_read_rev_meta "$r"
      printf ',{"rev":%s,"updatedAt":"%s","current":false,"source":"%s"}' "$r" "$(jesc "$r_updatedAt")" "$(jesc "$r_source")"
    done
  fi
  printf ']}'
}

mihomo_cfg_get_rev_json() {
  req_rev="$1"
  echo "$req_rev" | grep -qE '^[0-9]+$' || req_rev=''
  [ -n "$req_rev" ] || { reply_ok '{"ok":false,"error":"bad-rev"}'; return; }
  mihomo_cfg_init_if_missing
  if [ "$req_rev" = "$mcfg_activeRev" ]; then
    mihomo_cfg_get_json active
    return
  fi
  f="$MIHOMO_CFG_REVS_DIR/rev-$req_rev.yaml"
  [ -f "$f" ] || { reply_ok '{"ok":false,"error":"not-found"}'; return; }
  mihomo_cfg_read_rev_meta "$req_rev"
  content="$( (head -c 1048576 "$f" 2>/dev/null || cat "$f" 2>/dev/null || printf '') | b64enc )"
  reply_ok "$(printf '{"ok":true,"rev":%s,"updatedAt":"%s","source":"%s","contentB64":"%s"}' "$req_rev" "$(jesc "$r_updatedAt")" "$(jesc "$r_source")" "$content")"
}

mihomo_cfg_restore_rev_json() {
  [ "$REQUEST_METHOD" = "POST" ] || { reply_ok '{"ok":false,"error":"method-not-allowed"}'; return; }
  req_rev="$1"
  echo "$req_rev" | grep -qE '^[0-9]+$' || req_rev=''
  [ -n "$req_rev" ] || { reply_ok '{"ok":false,"error":"bad-rev"}'; return; }
  f="$MIHOMO_CFG_REVS_DIR/rev-$req_rev.yaml"
  [ -f "$f" ] || { reply_ok '{"ok":false,"error":"not-found"}'; return; }
  mihomo_cfg_apply_path "$f" "history:$req_rev"
}

if [ "$REQUEST_METHOD" = "OPTIONS" ]; then
  reply_ok "{}"
  exit 0
fi

# Parse query string (key=value&...)
cmd=""; ip=""; up=""; down=""; mac=""; ports=""; token_q=""; type=""; lines=""; offset=""; rev_q=""; enabled_q=""; schedule_q=""; remote_q=""; remotes_q=""; force_q=""; format_q=""; providers_q=""; name_q=""; kind_q=""; from_q=""; to_q=""
IFS='&'
for kv in $QUERY_STRING; do
  key="${kv%%=*}"
  val="${kv#*=}"
  # URL decode for %2F etc. and '+' -> space for query params like cron schedules.
  val="$(printf '%s' "$val" | tr '+' ' ')"
  val_esc="$(printf '%s' "$val" | sed 's/%/\\x/g')"
  val="$(printf '%b' "$val_esc")"
  case "$key" in
    cmd) cmd="$val" ;;
    ip) ip="$val" ;;
    up) up="$val" ;;
    down) down="$val" ;;
    mac) mac="$val" ;;
    ports) ports="$val" ;;
    type) type="$val" ;;
    lines) lines="$val" ;;
    offset) offset="$val" ;;
    rev) rev_q="$val" ;;
    token) token_q="$val" ;;
    enabled) enabled_q="$val" ;;
    schedule) schedule_q="$val" ;;
    file) file_q="$val" ;;
    scope) scope_q="$val" ;;
    env) env_q="$val" ;;
    remote) remote_q="$val" ;;
    remotes) remotes_q="$val" ;;
    force) force_q="$val" ;;
    format) format_q="$val" ;;
    providers) providers_q="$val" ;;
    name) name_q="$val" ;;
    kind) kind_q="$val" ;;
    from) from_q="$val" ;;
    to) to_q="$val" ;;
  esac
done
unset IFS

if [ -n "$TOKEN" ]; then
  auth="$HTTP_AUTHORIZATION"
  if [ "${auth#Bearer }" != "$TOKEN" ] && [ "$token_q" != "$TOKEN" ]; then
    reply_ok '{"ok":false,"error":"unauthorized"}'
    exit 0
  fi
fi

have_tc=0
command -v tc >/dev/null 2>&1 && have_tc=1

ensure_block_chain() {
  iptables -t filter -nL ZASH_BLOCK >/dev/null 2>&1 || iptables -t filter -N ZASH_BLOCK
  # Block both access to router and forwarded traffic from LAN.
  iptables -t filter -C INPUT -i "$LAN_IF" -j ZASH_BLOCK >/dev/null 2>&1 || iptables -t filter -I INPUT 1 -i "$LAN_IF" -j ZASH_BLOCK
  iptables -t filter -C FORWARD -i "$LAN_IF" -j ZASH_BLOCK >/dev/null 2>&1 || iptables -t filter -I FORWARD 1 -i "$LAN_IF" -j ZASH_BLOCK
}

ensure_iptables_chains() {
  iptables -t mangle -nL ZASH_UP >/dev/null 2>&1 || iptables -t mangle -N ZASH_UP
  iptables -t mangle -nL ZASH_DOWN >/dev/null 2>&1 || iptables -t mangle -N ZASH_DOWN
  iptables -t mangle -nL ZASH_QOS_UP >/dev/null 2>&1 || iptables -t mangle -N ZASH_QOS_UP
  iptables -t mangle -nL ZASH_QOS_DOWN >/dev/null 2>&1 || iptables -t mangle -N ZASH_QOS_DOWN
  iptables -t mangle -C FORWARD -j ZASH_UP >/dev/null 2>&1 || iptables -t mangle -I FORWARD 1 -j ZASH_UP
  iptables -t mangle -C FORWARD -j ZASH_DOWN >/dev/null 2>&1 || iptables -t mangle -I FORWARD 1 -j ZASH_DOWN
  iptables -t mangle -C FORWARD -j ZASH_QOS_UP >/dev/null 2>&1 || iptables -t mangle -I FORWARD 1 -j ZASH_QOS_UP
  iptables -t mangle -C FORWARD -j ZASH_QOS_DOWN >/dev/null 2>&1 || iptables -t mangle -I FORWARD 1 -j ZASH_QOS_DOWN
}


ensure_host_traffic_chains() {
  iptables -t mangle -nL ZASH_HOST_UP >/dev/null 2>&1 || iptables -t mangle -N ZASH_HOST_UP
  iptables -t mangle -nL ZASH_HOST_DOWN >/dev/null 2>&1 || iptables -t mangle -N ZASH_HOST_DOWN
  iptables -t mangle -C FORWARD -j ZASH_HOST_UP >/dev/null 2>&1 || iptables -t mangle -I FORWARD 1 -j ZASH_HOST_UP
  iptables -t mangle -C FORWARD -j ZASH_HOST_DOWN >/dev/null 2>&1 || iptables -t mangle -I FORWARD 1 -j ZASH_HOST_DOWN
}

ensure_host_traffic_rule() {
  chain="$1"
  direction="$2"
  ip_="$3"
  host_if="$4"
  target_if="$5"
  [ -n "$chain" ] || return 0
  [ -n "$direction" ] || return 0
  [ -n "$ip_" ] || return 0
  [ -n "$host_if" ] || return 0
  [ -n "$target_if" ] || return 0
  [ "$host_if" = "$target_if" ] && return 0

  case "$direction" in
    up)
      iptables -t mangle -C "$chain" -i "$host_if" -s "$ip_" -o "$target_if" -j RETURN >/dev/null 2>&1 ||         iptables -t mangle -A "$chain" -i "$host_if" -s "$ip_" -o "$target_if" -j RETURN >/dev/null 2>&1 || true
      ;;
    down)
      iptables -t mangle -C "$chain" -i "$target_if" -d "$ip_" -o "$host_if" -j RETURN >/dev/null 2>&1 ||         iptables -t mangle -A "$chain" -i "$target_if" -d "$ip_" -o "$host_if" -j RETURN >/dev/null 2>&1 || true
      ;;
  esac
}

route_iface_for_ip() {
  target_ip="$1"
  [ -n "$target_ip" ] || return 0
  ip route get "$target_ip" 2>/dev/null | awk '
    {
      for (i = 1; i <= NF; i++) {
        if ($i == "dev") {
          print $(i + 1)
          exit
        }
      }
    }
  ' | head -n1
}

pick_wg_bin() {
  if [ -x /opt/bin/wg ]; then echo '/opt/bin/wg'; return 0; fi
  if command -v wg >/dev/null 2>&1; then echo 'wg'; return 0; fi
  echo ''
}

route_prefix_for_ip_on_dev() {
  dev="$1"
  target_ip="$2"
  [ -n "$dev" ] || return 0
  [ -n "$target_ip" ] || return 0

  ip -4 route show dev "$dev" 2>/dev/null | awk -v target="$target_ip" '
    function is_ipv4(v) { return (v ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) }
    function ip2int(ip,    a) {
      split(ip, a, ".")
      return (((a[1] * 256) + a[2]) * 256 + a[3]) * 256 + a[4]
    }
    function normalize_cidr(raw) {
      if (raw == "default") return "0.0.0.0/0"
      if (raw ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) return raw "/32"
      if (raw ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+\/[0-9]+$/) return raw
      return ""
    }
    function cidr_prefix(cidr,    parts) {
      split(cidr, parts, "/")
      return (parts[2] == "" ? 32 : parts[2] + 0)
    }
    function block_size(bits,    size, i) {
      size = 1
      for (i = 0; i < bits; i++) size *= 2
      return size
    }
    function cidr_match(ip, cidr,    parts, base, prefix, net, target_num, host_bits, size, low, high) {
      split(cidr, parts, "/")
      base = parts[1]
      prefix = (parts[2] == "" ? 32 : parts[2] + 0)
      if (!is_ipv4(ip) || !is_ipv4(base)) return 0
      if (prefix < 0 || prefix > 32) return 0
      if (prefix == 0) return 1
      net = ip2int(base)
      target_num = ip2int(ip)
      host_bits = 32 - prefix
      size = block_size(host_bits)
      low = int(net / size) * size
      high = low + size
      return (target_num >= low && target_num < high)
    }
    {
      cidr = normalize_cidr($1)
      if (cidr == "" || cidr == "0.0.0.0/0") next
      prefix = cidr_prefix(cidr)
      if (!cidr_match(target, cidr)) next
      if (prefix > best_prefix) {
        best_prefix = prefix
        best = cidr
      }
    }
    END {
      if (best != "") print best
    }
  ' | head -n1
}

wg_peer_hint_for_prefix() {
  dev="$1"
  prefix="$2"
  [ -n "$dev" ] || return 0
  [ -n "$prefix" ] || return 0
  wgbin="$(pick_wg_bin)"
  [ -n "$wgbin" ] || return 0

  "$wgbin" show "$dev" allowed-ips 2>/dev/null | awk -v prefix="$prefix" '
    function trim(v) {
      sub(/^[ 	]+/, "", v)
      sub(/[ 	]+$/, "", v)
      return v
    }
    {
      peer = $1
      $1 = ""
      allowed = trim($0)
      count = split(allowed, items, /,[ 	]*/)
      for (i = 1; i <= count; i++) {
        item = trim(items[i])
        if (item == prefix) {
          if (peer != "") printf "peer-%s", substr(peer, 1, 8)
          exit
        }
      }
    }
  ' | head -n1
}

route_site_source_for_ip() {
  kind="$1"
  dev="$2"
  target_ip="$3"
  [ -n "$kind" ] || kind="vpn"
  [ -n "$dev" ] || return 0
  [ -n "$target_ip" ] || return 0

  source="${kind}-route:${dev}"
  prefix="$(route_prefix_for_ip_on_dev "$dev" "$target_ip")"
  [ -n "$prefix" ] && source="${source}|subnet=${prefix}"

  case "$kind" in
    wireguard|wg)
      peer_hint="$(wg_peer_hint_for_prefix "$dev" "$prefix")"
      [ -n "$peer_hint" ] && source="${source}|peer=${peer_hint}"
      ;;
  esac

  printf '%s' "$source"
}

read_conntrack_table() {
  if [ -r /proc/net/nf_conntrack ]; then
    cat /proc/net/nf_conntrack 2>/dev/null
    return 0
  fi
  if [ -r /proc/net/ip_conntrack ]; then
    cat /proc/net/ip_conntrack 2>/dev/null
    return 0
  fi
  if command -v conntrack >/dev/null 2>&1; then
    conntrack -L 2>/dev/null || true
    return 0
  fi
  return 0
}

new_tmp_file() {
  prefix="$1"
  [ -n "$prefix" ] || prefix="zash_tmp"
  mkdir -p /tmp >/dev/null 2>&1 || true
  if command -v mktemp >/dev/null 2>&1; then
    tmp_path="$(mktemp "/tmp/${prefix}.XXXXXX" 2>/dev/null || true)"
    if [ -n "$tmp_path" ]; then
      printf '%s
' "$tmp_path"
      return 0
    fi
  fi
  printf '/tmp/%s.%s.%s
' "$prefix" "$$" "$(date +%s 2>/dev/null || echo 0)"
}

ensure_tmp_file() {
  tmp_path="$1"
  [ -n "$tmp_path" ] || return 1
  mkdir -p /tmp >/dev/null 2>&1 || true
  : > "$tmp_path" 2>/dev/null || touch "$tmp_path" 2>/dev/null || return 1
  [ -f "$tmp_path" ]
}

collect_routed_tunnel_hosts_tsv() {
  out_file="$1"
  [ -n "$out_file" ] || return 1

  extra_ifaces=" $(list_extra_traffic_ifaces 2>/dev/null | tr '\n' ' ') "
  local_ips_tmp="/tmp/zash_local_ips.$$"
  cand_tmp="/tmp/zash_routed_host_candidates.$$"

  : > "$out_file" 2>/dev/null || true
  : > "$local_ips_tmp" 2>/dev/null || true
  : > "$cand_tmp" 2>/dev/null || true

  ip -4 addr show 2>/dev/null | awk '/inet /{print $2}' | cut -d/ -f1 | sort -u > "$local_ips_tmp" 2>/dev/null || true

  read_conntrack_table | awk '
    function is_ipv4(v) { return (v ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) }
    {
      srcc=dstc=0
      o_src=o_dst=""
      for (i = 1; i <= NF; i++) {
        if ($i ~ /^src=/) {
          val = substr($i, 5)
          srcc++
          if (srcc == 1) o_src = val
        } else if ($i ~ /^dst=/) {
          val = substr($i, 5)
          dstc++
          if (dstc == 1) o_dst = val
        }
      }
      if (is_ipv4(o_src)) seen[o_src] = 1
      if (is_ipv4(o_dst)) seen[o_dst] = 1
    }
    END {
      for (ip in seen) print ip
    }
  ' 2>/dev/null | sort -u > "$cand_tmp" 2>/dev/null || true

  while IFS= read -r ip_; do
    printf '%s' "$ip_" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || continue
    grep -qx "$ip_" "$local_ips_tmp" 2>/dev/null && continue
    dev="$(route_iface_for_ip "$ip_")"
    [ -n "$dev" ] || continue
    case "$extra_ifaces" in
      *" $dev "*) ;;
      *) continue ;;
    esac
    kind="$(traffic_iface_kind "$dev")"
    [ -n "$kind" ] || kind="vpn"
    source="$(route_site_source_for_ip "$kind" "$dev" "$ip_")"
    [ -n "$source" ] || source="${kind}-route:${dev}"
    printf '%s\t\t\t%s\n' "$ip_" "$source" >> "$out_file"
  done < "$cand_tmp"

  sort -u -o "$out_file" "$out_file" 2>/dev/null || true
  rm -f "$local_ips_tmp" "$cand_tmp" 2>/dev/null || true
}

collect_tracked_hosts_tsv() {
  out_file="$1"
  [ -n "$out_file" ] || return 1
  ensure_tmp_file "$out_file" || return 1

  lan_tmp="$(new_tmp_file zash_tracked_lan_hosts)"
  routed_tmp="$(new_tmp_file zash_tracked_routed_hosts)"
  [ -n "$lan_tmp" ] || lan_tmp="/tmp/zash_tracked_lan_hosts.$$"
  [ -n "$routed_tmp" ] || routed_tmp="/tmp/zash_tracked_routed_hosts.$$"
  ensure_tmp_file "$lan_tmp" || return 1
  ensure_tmp_file "$routed_tmp" || { rm -f "$lan_tmp" 2>/dev/null || true; return 1; }

  collect_lan_hosts_tsv "$lan_tmp"
  collect_routed_tunnel_hosts_tsv "$routed_tmp"

  awk -F'	' '
    FNR == NR {
      if ($1 != "") {
        mac[$1] = $2
        host[$1] = $3
        src[$1] = ($4 != "" ? $4 : "dhcp")
        order[$1] = 1
      }
      next
    }
    {
      if ($1 != "") {
        if (!($1 in order)) order[$1] = 2
        if (mac[$1] == "" && $2 != "") mac[$1] = $2
        if (host[$1] == "" && $3 != "") host[$1] = $3
        if (src[$1] == "" && $4 != "") src[$1] = $4
      }
    }
    END {
      for (ip in src) print ip "	" mac[ip] "	" host[ip] "	" src[ip] "	" order[ip]
    }
  ' "$lan_tmp" "$routed_tmp" 2>/dev/null | sort -t'	' -k5,5n -k1,1 | awk -F'	' '{print $1 "	" $2 "	" $3 "	" $4}' > "$out_file" 2>/dev/null || ensure_tmp_file "$out_file" || true

  [ -f "$out_file" ] || ensure_tmp_file "$out_file" || true
  rm -f "$lan_tmp" "$routed_tmp" 2>/dev/null || true
}

host_traffic_sync_rules() {
  ensure_host_traffic_chains
  mkdir -p /tmp >/dev/null 2>&1 || true

  hosts_tmp="$(new_tmp_file zash_host_traffic_hosts)"
  [ -n "$hosts_tmp" ] || hosts_tmp="/tmp/zash_host_traffic_hosts.$$.$(date +%s 2>/dev/null || echo 0)"
  ensure_tmp_file "$hosts_tmp" || return 0
  collect_tracked_hosts_tsv "$hosts_tmp" || ensure_tmp_file "$hosts_tmp" || return 0
  [ -f "$hosts_tmp" ] || ensure_tmp_file "$hosts_tmp" || return 0
  extra_ifaces="$(list_extra_traffic_ifaces 2>/dev/null | tr '
' ' ')"

  if [ ! -s "$hosts_tmp" ]; then
    rm -f "$hosts_tmp" 2>/dev/null || true
    return 0
  fi

  [ -r "$hosts_tmp" ] || { rm -f "$hosts_tmp" 2>/dev/null || true; return 0; }

  while IFS='	' read -r ip_ mac_ host_ src_; do
    printf '%s' "$ip_" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || continue
    host_if="$(route_iface_for_ip "$ip_")"
    [ -n "$host_if" ] || host_if="$LAN_IF"
    if [ "$host_if" = "$LAN_IF" ]; then
      ensure_host_traffic_rule ZASH_HOST_UP up "$ip_" "$host_if" "$WAN_IF"
      ensure_host_traffic_rule ZASH_HOST_DOWN down "$ip_" "$host_if" "$WAN_IF"
      for ex_if in $extra_ifaces; do
        [ -n "$ex_if" ] || continue
        ensure_host_traffic_rule ZASH_HOST_UP up "$ip_" "$host_if" "$ex_if"
        ensure_host_traffic_rule ZASH_HOST_DOWN down "$ip_" "$host_if" "$ex_if"
      done
    else
      ensure_host_traffic_rule ZASH_HOST_UP up "$ip_" "$host_if" "$WAN_IF"
      ensure_host_traffic_rule ZASH_HOST_DOWN down "$ip_" "$host_if" "$WAN_IF"
      ensure_host_traffic_rule ZASH_HOST_UP up "$ip_" "$host_if" "$LAN_IF"
      ensure_host_traffic_rule ZASH_HOST_DOWN down "$ip_" "$host_if" "$LAN_IF"
      for ex_if in $extra_ifaces; do
        [ -n "$ex_if" ] || continue
        [ "$ex_if" = "$host_if" ] && continue
        ensure_host_traffic_rule ZASH_HOST_UP up "$ip_" "$host_if" "$ex_if"
        ensure_host_traffic_rule ZASH_HOST_DOWN down "$ip_" "$host_if" "$ex_if"
      done
    fi
  done < "$hosts_tmp"

  rm -f "$hosts_tmp" 2>/dev/null || true
}
host_traffic_collect_bytes_tsv() {
  out_file="$1"
  [ -n "$out_file" ] || return 1
  : > "$out_file" 2>/dev/null || true

  iptables -t mangle -nvxL ZASH_HOST_UP 2>/dev/null | awk -v wan="$WAN_IF" '
    NR>2 && $3=="RETURN" {
      iface=$6; ip=$7; bytes=$2+0;
      if(ip ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) {
        key=(iface==wan ? "bypassUpBytes" : "vpnUpBytes");
        sum[ip SUBSEP key]+=bytes;
        ips[ip]=1;
      }
    }
    END {
      for (k in sum) {
        split(k, parts, SUBSEP);
        print parts[1] "	" parts[2] "	" sum[k];
      }
    }
  ' >> "$out_file" || true

  iptables -t mangle -nvxL ZASH_HOST_DOWN 2>/dev/null | awk -v wan="$WAN_IF" '
    NR>2 && $3=="RETURN" {
      iface=$5; ip=$8; bytes=$2+0;
      if(ip ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) {
        key=(iface==wan ? "bypassDownBytes" : "vpnDownBytes");
        sum[ip SUBSEP key]+=bytes;
      }
    }
    END {
      for (k in sum) {
        split(k, parts, SUBSEP);
        print parts[1] "	" parts[2] "	" sum[k];
      }
    }
  ' >> "$out_file" || true
}

host_traffic_live_json() {
  mkdir -p /tmp >/dev/null 2>&1 || true
  host_traffic_sync_rules

  hosts_tmp="$(new_tmp_file zash_host_traffic_hosts)"
  raw_tmp="$(new_tmp_file zash_host_traffic_raw)"
  current_tmp="$(new_tmp_file zash_host_traffic_current)"
  [ -n "$hosts_tmp" ] || hosts_tmp="/tmp/zash_host_traffic_hosts.$$.$(date +%s 2>/dev/null || echo 0)"
  [ -n "$raw_tmp" ] || raw_tmp="/tmp/zash_host_traffic_raw.$$.$(date +%s 2>/dev/null || echo 0)"
  [ -n "$current_tmp" ] || current_tmp="/tmp/zash_host_traffic_current.$$.$(date +%s 2>/dev/null || echo 0)"
  prev_tmp="$HOST_TRAFFIC_STATE_FILE"
  prev_ts_file="$HOST_TRAFFIC_TS_FILE"

  ensure_tmp_file "$hosts_tmp" || { reply_ok '{"ok":true,"ts":0,"dtMs":0,"trackedHosts":0,"items":[]}'; return; }
  ensure_tmp_file "$raw_tmp" || { rm -f "$hosts_tmp" 2>/dev/null || true; reply_ok '{"ok":true,"ts":0,"dtMs":0,"trackedHosts":0,"items":[]}'; return; }
  ensure_tmp_file "$current_tmp" || { rm -f "$hosts_tmp" "$raw_tmp" 2>/dev/null || true; reply_ok '{"ok":true,"ts":0,"dtMs":0,"trackedHosts":0,"items":[]}'; return; }
  collect_tracked_hosts_tsv "$hosts_tmp" || ensure_tmp_file "$hosts_tmp" || true
  host_traffic_collect_bytes_tsv "$raw_tmp"
  [ -f "$hosts_tmp" ] || ensure_tmp_file "$hosts_tmp" || true
  [ -f "$raw_tmp" ] || ensure_tmp_file "$raw_tmp" || true
  [ -r "$hosts_tmp" ] || ensure_tmp_file "$hosts_tmp" || true
  [ -r "$raw_tmp" ] || ensure_tmp_file "$raw_tmp" || true

  awk -F'	' '
    FNR==NR {
      ip=$1; mac=$2; host=$3; src=$4;
      if(ip!="") {
        host_mac[ip]=mac;
        host_name[ip]=host;
        host_src[ip]=src;
        ips[ip]=1;
      }
      next
    }
    {
      ip=$1; key=$2; val=$3+0;
      if(ip!="") {
        data[ip SUBSEP key]=val;
        ips[ip]=1;
      }
    }
    END {
      for (ip in ips) {
        print ip "	"           (data[ip SUBSEP "bypassDownBytes"] + 0) "	"           (data[ip SUBSEP "bypassUpBytes"] + 0) "	"           (data[ip SUBSEP "vpnDownBytes"] + 0) "	"           (data[ip SUBSEP "vpnUpBytes"] + 0) "	"           host_mac[ip] "	" host_name[ip] "	" host_src[ip];
      }
    }
  ' "$hosts_tmp" "$raw_tmp" 2>/dev/null | sort > "$current_tmp" 2>/dev/null || ensure_tmp_file "$current_tmp" || true

  now_ms="$(( $(date +%s 2>/dev/null || echo 0) * 1000 ))"
  prev_ms="$(cat "$prev_ts_file" 2>/dev/null | tr -d '
 ' || true)"
  echo "$prev_ms" | grep -qE '^[0-9]+$' || prev_ms=0
  if [ "$prev_ms" -gt 0 ] && [ "$now_ms" -gt "$prev_ms" ]; then
    dt_ms=$((now_ms - prev_ms))
  else
    dt_ms=0
  fi
  if [ "$dt_ms" -gt 0 ]; then
    dt_sec="$(awk -v ms="$dt_ms" 'BEGIN { printf "%.3f", (ms / 1000) }')"
  else
    dt_sec="0"
  fi

  prev_input="/dev/null"
  [ -f "$prev_tmp" ] && prev_input="$prev_tmp"

  items_json="$(awk -F'	' -v dt="$dt_sec" '
    function clamp(v) { return (v < 0 ? 0 : v) }
    function esc(s) {
      gsub(/\/, "\", s)
      gsub(/"/, "\"", s)
      gsub(/
/, "", s)
      gsub(/
/, " ", s)
      return s
    }
    FNR==NR {
      ip=$1;
      prev_bd[ip]=$2+0;
      prev_bu[ip]=$3+0;
      prev_vd[ip]=$4+0;
      prev_vu[ip]=$5+0;
      next
    }
    {
      ip=$1; bd=$2+0; bu=$3+0; vd=$4+0; vu=$5+0; mac=$6; host=$7; src=$8;
      bypassDownBps = (dt > 0 ? clamp((bd - prev_bd[ip]) / dt) : 0);
      bypassUpBps = (dt > 0 ? clamp((bu - prev_bu[ip]) / dt) : 0);
      vpnDownBps = (dt > 0 ? clamp((vd - prev_vd[ip]) / dt) : 0);
      vpnUpBps = (dt > 0 ? clamp((vu - prev_vu[ip]) / dt) : 0);
      totalDownBps = bypassDownBps + vpnDownBps;
      totalUpBps = bypassUpBps + vpnUpBps;
      if (totalDownBps + totalUpBps <= 1 && bd + bu + vd + vu <= 0) next;
      if (first == 0) printf ",";
      first = 0;
      printf "{"ip":"%s","mac":"%s","hostname":"%s","source":"%s","bypassDownBps":%.3f,"bypassUpBps":%.3f,"vpnDownBps":%.3f,"vpnUpBps":%.3f,"totalDownBps":%.3f,"totalUpBps":%.3f}",         esc(ip), esc(mac), esc(host), esc(src), bypassDownBps, bypassUpBps, vpnDownBps, vpnUpBps, totalDownBps, totalUpBps;
    }
  ' "$prev_input" "$current_tmp" 2>/dev/null)"

  cp "$current_tmp" "$prev_tmp" 2>/dev/null || true
  printf '%s' "$now_ms" > "$prev_ts_file" 2>/dev/null || true

  tracked_hosts="$(wc -l < "$current_tmp" 2>/dev/null | tr -d ' ')"
  echo "$tracked_hosts" | grep -qE '^[0-9]+$' || tracked_hosts=0

  reply_ok "$(printf '{"ok":true,"ts":%s,"dtMs":%s,"trackedHosts":%s,"items":[%s]}' "$now_ms" "$dt_ms" "$tracked_hosts" "$items_json")"

  rm -f "$hosts_tmp" "$raw_tmp" "$current_tmp" 2>/dev/null || true
}


route_iface_for_host_target() {
  src_ip="$1"
  dst_ip="$2"
  [ -n "$src_ip" ] || return 0
  [ -n "$dst_ip" ] || return 0
  ip route get "$dst_ip" from "$src_ip" 2>/dev/null | awk '
    {
      for (i = 1; i <= NF; i++) {
        if ($i == "dev") {
          print $(i + 1)
          exit
        }
      }
    }
  ' | head -n1
}

host_remote_targets_json() {
  host_ip="$ip"
  printf '%s' "$host_ip" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' || {
    reply_ok '{"ok":false,"error":"invalid-ip"}'
    return 0
  }

  mkdir -p /tmp >/dev/null 2>&1 || true

  raw_tmp="/tmp/zash_host_remote_targets_raw.$$"
  agg_tmp="/tmp/zash_host_remote_targets_agg.$$"
  current_tmp="/tmp/zash_host_remote_targets_current.$$"
  state_id="$(printf '%s' "$host_ip" | tr -c '0-9A-Za-z._-' '_')"
  prev_tmp="/tmp/zash-host-remote-targets-${state_id}.prev.tsv"
  prev_ts_file="/tmp/zash-host-remote-targets-${state_id}.prev.ts"

  : > "$raw_tmp" 2>/dev/null || true
  : > "$agg_tmp" 2>/dev/null || true
  : > "$current_tmp" 2>/dev/null || true

  read_conntrack_table | awk -v host="$host_ip" '
    function is_ipv4(v) { return (v ~ /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/) }
    {
      proto=""
      srcc=dstc=sportc=dportc=bytesc=0
      o_src=o_dst=o_sport=o_dport=o_bytes=""
      r_src=r_dst=r_sport=r_dport=r_bytes=""
      for (i = 1; i <= NF; i++) {
        if (proto == "" && i == 3) proto = $i
        if ($i ~ /^src=/) {
          val = substr($i, 5)
          srcc++
          if (srcc == 1) o_src = val
          else if (srcc == 2) r_src = val
        } else if ($i ~ /^dst=/) {
          val = substr($i, 5)
          dstc++
          if (dstc == 1) o_dst = val
          else if (dstc == 2) r_dst = val
        } else if ($i ~ /^sport=/) {
          val = substr($i, 7)
          sportc++
          if (sportc == 1) o_sport = val
          else if (sportc == 2) r_sport = val
        } else if ($i ~ /^dport=/) {
          val = substr($i, 7)
          dportc++
          if (dportc == 1) o_dport = val
          else if (dportc == 2) r_dport = val
        } else if ($i ~ /^bytes=/) {
          val = substr($i, 7) + 0
          bytesc++
          if (bytesc == 1) o_bytes = val
          else if (bytesc == 2) r_bytes = val
        }
      }

      if (!is_ipv4(o_src) || !is_ipv4(o_dst)) next

      remote=""; port=""; up=0; down=0
      if (o_src == host) {
        remote = o_dst
        port = (o_dport != "" ? o_dport : r_sport)
        up = (o_bytes + 0)
        down = (r_bytes + 0)
      } else if (o_dst == host) {
        remote = o_src
        port = (o_sport != "" ? o_sport : r_dport)
        up = (r_bytes + 0)
        down = (o_bytes + 0)
      } else next

      if (!is_ipv4(remote) || remote == host) next
      gsub(/[^0-9A-Za-z_.:-]/, "", port)
      print remote "\t" port "\t" proto "\t" up "\t" down
    }
  ' > "$raw_tmp" 2>/dev/null || true

  awk -F'\t' '
    {
      key = $1 SUBSEP $2 SUBSEP $3
      up[key] += ($4 + 0)
      down[key] += ($5 + 0)
      cnt[key] += 1
    }
    END {
      for (key in cnt) {
        split(key, parts, SUBSEP)
        print parts[1] "\t" parts[2] "\t" parts[3] "\t" (up[key] + 0) "\t" (down[key] + 0) "\t" (cnt[key] + 0)
      }
    }
  ' "$raw_tmp" 2>/dev/null | sort > "$agg_tmp" 2>/dev/null || true

  extra_ifaces=" $(list_extra_traffic_ifaces 2>/dev/null | tr '\n' ' ') "
  host_dev="$(route_iface_for_ip "$host_ip")"
  host_dev_is_extra=0
  case "$extra_ifaces" in
    *" $host_dev "*) host_dev_is_extra=1 ;;
  esac
  while IFS='\t' read -r remote port proto up_bytes down_bytes count; do
    [ -n "$remote" ] || continue
    dev="$(route_iface_for_host_target "$host_ip" "$remote")"
    [ -n "$dev" ] || continue
    scope=""
    kind=""
    via=""

    if [ "$dev" = "$WAN_IF" ]; then
      scope="bypass"
      kind="bypass"
      via="$WAN_IF"
    elif [ "$dev" = "$LAN_IF" ] && [ "$host_dev_is_extra" -eq 1 ]; then
      scope="vpn"
      kind="$(traffic_iface_kind "$host_dev")"
      via="$host_dev"
    else
      case "$extra_ifaces" in
        *" $dev "*)
          scope="vpn"
          kind="$(traffic_iface_kind "$dev")"
          via="$dev"
          ;;
        *)
          continue
          ;;
      esac
    fi

    target="$remote"
    [ -n "$port" ] && target="${remote}:$port"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$target" "$scope" "$kind" "$via" "$proto" "$up_bytes" "$down_bytes" "$count" >> "$current_tmp"
  done < "$agg_tmp"

  sort -o "$current_tmp" "$current_tmp" 2>/dev/null || true

  now_ms="$(( $(date +%s 2>/dev/null || echo 0) * 1000 ))"
  prev_ms="$(cat "$prev_ts_file" 2>/dev/null | tr -d '\r\n ' || true)"
  echo "$prev_ms" | grep -qE '^[0-9]+$' || prev_ms=0
  if [ "$prev_ms" -gt 0 ] && [ "$now_ms" -gt "$prev_ms" ]; then
    dt_ms=$((now_ms - prev_ms))
  else
    dt_ms=0
  fi
  if [ "$dt_ms" -gt 0 ]; then
    dt_sec="$(awk -v ms="$dt_ms" 'BEGIN { printf "%.3f", (ms / 1000) }')"
  else
    dt_sec="0"
  fi

  prev_input="/dev/null"
  [ -f "$prev_tmp" ] && prev_input="$prev_tmp"

  items_json="$(awk -F'\t' -v dt="$dt_sec" '
    function clamp(v) { return (v < 0 ? 0 : v) }
    function esc(s) {
      gsub(/\\/, "\\\\", s)
      gsub(/"/, "\\\"", s)
      gsub(/\r/, "", s)
      gsub(/\n/, " ", s)
      return s
    }
    FNR == NR {
      key = $1 SUBSEP $2 SUBSEP $4 SUBSEP $5
      prev_up[key] = ($6 + 0)
      prev_down[key] = ($7 + 0)
      next
    }
    {
      target = $1
      scope = $2
      kind = $3
      via = $4
      proto = $5
      up_bytes = ($6 + 0)
      down_bytes = ($7 + 0)
      count = ($8 + 0)
      key = target SUBSEP scope SUBSEP via SUBSEP proto
      up_bps = (dt > 0 ? clamp((up_bytes - prev_up[key]) / dt) : 0)
      down_bps = (dt > 0 ? clamp((down_bytes - prev_down[key]) / dt) : 0)
      if (up_bps + down_bps <= 1 && count <= 0) next
      if (first == 0) printf ","
      first = 0
      printf "{\"target\":\"%s\",\"scope\":\"%s\",\"kind\":\"%s\",\"via\":\"%s\",\"proto\":\"%s\",\"connections\":%d,\"downBps\":%.3f,\"upBps\":%.3f}", \
        esc(target), esc(scope), esc(kind), esc(via), esc(proto), count, down_bps, up_bps
    }
  ' "$prev_input" "$current_tmp" 2>/dev/null)"

  cp "$current_tmp" "$prev_tmp" 2>/dev/null || true
  printf '%s' "$now_ms" > "$prev_ts_file" 2>/dev/null || true

  tracked_targets="$(wc -l < "$current_tmp" 2>/dev/null | tr -d ' ')"
  echo "$tracked_targets" | grep -qE '^[0-9]+$' || tracked_targets=0

  reply_ok "$(printf '{\"ok\":true,\"ip\":\"%s\",\"ts\":%s,\"dtMs\":%s,\"trackedTargets\":%s,\"items\":[%s]}' "$(jesc "$host_ip")" "$now_ms" "$dt_ms" "$tracked_targets" "$items_json")"

  rm -f "$raw_tmp" "$agg_tmp" "$current_tmp" 2>/dev/null || true
}

ensure_tc_base() {
  [ $have_tc -eq 1 ] || return 0

  # WAN
  tc qdisc show dev "$WAN_IF" 2>/dev/null | grep -q "htb 1:" || {
    tc qdisc add dev "$WAN_IF" root handle 1: htb default 1 2>/dev/null || true
    tc class add dev "$WAN_IF" parent 1: classid 1:1 htb rate "${WAN_RATE}mbit" ceil "${WAN_RATE}mbit" 2>/dev/null || true
  }
  # LAN
  tc qdisc show dev "$LAN_IF" 2>/dev/null | grep -q "htb 2:" || {
    tc qdisc add dev "$LAN_IF" root handle 2: htb default 1 2>/dev/null || true
    tc class add dev "$LAN_IF" parent 2: classid 2:1 htb rate "${LAN_RATE}mbit" ceil "${LAN_RATE}mbit" 2>/dev/null || true
  }
}

neighbors() {
  # Return LAN neighbor table (IP -> MAC). Useful to keep UI limits stable across DHCP changes.
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  printf '{"ok":true,"items":['
  first=1
  ip neigh show dev "$LAN_IF" 2>/dev/null | while read -r line; do
    ipn="$(echo "$line" | awk '{print $1}')"
    macn="$(echo "$line" | awk '{print $5}')"
    stn="$(echo "$line" | awk '{print $6}')"
    echo "$macn" | grep -q ':' || continue
    [ -n "$ipn" ] || continue
    [ -n "$macn" ] || continue
    # skip incomplete
    [ "$macn" = "00:00:00:00:00:00" ] && continue
    [ "$first" -eq 0 ] && printf ','
    first=0
    printf '{"ip":"%s","mac":"%s","state":"%s"}' "$ipn" "$macn" "$stn"
  done
  printf ']}'
}

collect_lan_hosts_tsv() {
  out_file="$1"
  [ -n "$out_file" ] || return 1

  leases_tmp="/tmp/zash_leases.$$"
  arp_tmp="/tmp/zash_arp.$$"

  : > "$leases_tmp" 2>/dev/null || true
  : > "$arp_tmp" 2>/dev/null || true

  # Common dnsmasq lease locations (Keenetic/OpenWrt/Entware)
  for f in /tmp/dhcp.leases /var/lib/misc/dnsmasq.leases /opt/var/lib/misc/dnsmasq.leases /opt/var/state/dhcp/dhcp.leases; do
    if [ -f "$f" ]; then
      # expiry mac ip hostname clientid
      awk 'NF>=4 { ip=$3; mac=tolower($2); host=$4; exp=$1; if(host=="*" || host=="-") host=""; if(ip!="" && mac!="") print ip"|"mac"|"host"|"exp }' "$f" 2>/dev/null >> "$leases_tmp" || true
    fi
  done

  if [ -r /proc/net/arp ]; then
    awk 'NR>1 { ip=$1; mac=tolower($4); if(ip!="" && mac ~ /^([0-9a-f]{2}:){5}[0-9a-f]{2}$/ && mac!="00:00:00:00:00:00") print ip"|"mac }' /proc/net/arp 2>/dev/null >> "$arp_tmp" || true
  fi

  awk -F'|' '
    FNR==NR {
      ip=$1; mac=$2; host=$3;
      if(ip!="") {
        dhcp_mac[ip]=mac;
        dhcp_host[ip]=host;
        ips[ip]=1;
      }
      next
    }
    {
      ip=$1; mac=$2;
      if(ip!="") {
        arp_mac[ip]=mac;
        ips[ip]=1;
      }
    }
    END {
      for(ip in ips) {
        mac=dhcp_mac[ip]; host=dhcp_host[ip]; src="dhcp";
        if(mac=="") { mac=arp_mac[ip]; src="arp"; }
        if(mac=="") mac="";
        print ip"	"mac"	"host"	"src;
      }
    }
  ' "$leases_tmp" "$arp_tmp" 2>/dev/null | sort > "$out_file" 2>/dev/null || true

  rm -f "$leases_tmp" "$arp_tmp" 2>/dev/null || true
}

lan_hosts_json() {
  # Return LAN hosts from DHCP leases and ARP table (best effort).
  # items: {ip, mac, hostname, source}
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  merged_tmp="/tmp/zash_hosts.$$"
  collect_lan_hosts_tsv "$merged_tmp"

  printf '{"ok":true,"items":['
  first=1
  while IFS='	' read -r ipn macn hostn srcn; do
    [ -n "$ipn" ] || continue
    ipj="$(jesc "$ipn")"
    macj="$(jesc "$macn")"
    hostj="$(jesc "$hostn")"
    srcj="$(jesc "$srcn")"
    [ "$first" -eq 0 ] && printf ','
    first=0
    printf '{"ip":"%s","mac":"%s","hostname":"%s","source":"%s"}' "$ipj" "$macj" "$hostj" "$srcj"
  done < "$merged_tmp"
  printf ']}'

  rm -f "$merged_tmp" 2>/dev/null || true
}

ip2mac() {
  # Resolve a single IP to a MAC address (best effort).
  ip_="$1"
  [ -n "$ip_" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; return; }

  # Try to populate ARP/neighbor cache first.
  ping -c 1 -W 1 "$ip_" >/dev/null 2>&1 || true

  mac_=""
  # Prefer neighbor table without binding to a specific dev (bridges may differ).
  mac_="$(ip neigh show to "$ip_" 2>/dev/null | awk '/lladdr/{print $5; exit}' | tr 'A-Z' 'a-z')"
  if [ -z "$mac_" ]; then
    mac_="$(ip neigh show 2>/dev/null | awk -v ip="$ip_" '$1==ip && /lladdr/ {print $5; exit}' | tr 'A-Z' 'a-z')"
  fi
  if [ -z "$mac_" ]; then
    mac_="$(arp -n "$ip_" 2>/dev/null | awk '{for(i=1;i<=NF;i++) if ($i ~ /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/){print $i; exit}}' | tr 'A-Z' 'a-z')"
  fi

  if [ -n "$mac_" ] && echo "$mac_" | grep -qiE '^([0-9a-f]{2}:){5}[0-9a-f]{2}$'; then
    reply_ok "$(json ok true mac "$mac_")"
  else
    reply_ok '{"ok":false,"error":"not-found"}'
  fi
}

persist_block() {
  kind="$1"; k="$2"; p="$3"
  mkdir -p "$(dirname "$BLOCKS_FILE")" >/dev/null 2>&1 || true
  tmp="${BLOCKS_FILE}.tmp"
  # Remove previous entries for this key (kind+key) or legacy format.
  if [ -f "$BLOCKS_FILE" ]; then
    grep -vi "^${kind}[[:space:]]\+${k}[[:space:]]" "$BLOCKS_FILE" | grep -vi "^${k}[[:space:]]" > "$tmp" 2>/dev/null || true
  fi
  echo "${kind} ${k} ${p}" >> "$tmp"
  mv "$tmp" "$BLOCKS_FILE" 2>/dev/null || true
}

remove_persist_block() {
  kind="$1"; k="$2"
  [ -f "$BLOCKS_FILE" ] || return 0
  tmp="${BLOCKS_FILE}.tmp"
  grep -vi "^${kind}[[:space:]]\+${k}[[:space:]]" "$BLOCKS_FILE" | grep -vi "^${k}[[:space:]]" > "$tmp" 2>/dev/null || true
  mv "$tmp" "$BLOCKS_FILE" 2>/dev/null || true
}

block_mac_ports() {
  m="$1"; p="$2"
  [ -n "$m" ] || { reply_ok '{"ok":false,"error":"missing-mac"}'; return; }
  ensure_block_chain

  # If ports are empty or 'all', block ALL traffic from this MAC (DROP).
  if [ -z "$p" ] || [ "$p" = "all" ] || [ "$p" = "ALL" ]; then
    iptables -t filter -C ZASH_BLOCK -m mac --mac-source "$m" -j DROP >/dev/null 2>&1 || \
      iptables -t filter -A ZASH_BLOCK -m mac --mac-source "$m" -j DROP
    persist_block "mac" "$m" "all"
    reply_ok '{"ok":true}'
    return
  fi

  oldIFS="$IFS"
  IFS=','
  for port in $p; do
    port="$(echo "$port" | tr -d ' ')"
    echo "$port" | grep -q '^[0-9]\+$' || continue
    iptables -t filter -C ZASH_BLOCK -m mac --mac-source "$m" -p tcp --dport "$port" -j REJECT >/dev/null 2>&1 || \
      iptables -t filter -A ZASH_BLOCK -m mac --mac-source "$m" -p tcp --dport "$port" -j REJECT
    iptables -t filter -C ZASH_BLOCK -m mac --mac-source "$m" -p udp --dport "$port" -j REJECT >/dev/null 2>&1 || \
      iptables -t filter -A ZASH_BLOCK -m mac --mac-source "$m" -p udp --dport "$port" -j REJECT
  done
  IFS="$oldIFS"

  persist_block "mac" "$m" "$p"
  reply_ok '{"ok":true}'
}

unblock_mac_ports() {
  m="$1"
  [ -n "$m" ] || { reply_ok '{"ok":false,"error":"missing-mac"}'; return; }
  ensure_block_chain

  # remove any rules for this MAC (best effort)
  while iptables -t filter -D ZASH_BLOCK -m mac --mac-source "$m" -j REJECT >/dev/null 2>&1; do :; done
  # Also remove with protocol/port (some iptables builds require exact match)
  # NOTE: pattern starts with "--" so we must pass "--" to grep to avoid it being parsed as an option
  iptables -t filter -S ZASH_BLOCK 2>/dev/null | grep -i -F -- "--mac-source $m" | while read -r rule; do
    # Convert -A to -D
    drule="$(echo "$rule" | sed 's/^-A /-D /')"
    iptables -t filter $drule >/dev/null 2>&1 || true
  done

  remove_persist_block "mac" "$m"
  reply_ok '{"ok":true}'
}

block_ip() {
  ip_="$1"
  [ -n "$ip_" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; return; }
  ensure_block_chain
  iptables -t filter -C ZASH_BLOCK -s "$ip_" -j DROP >/dev/null 2>&1 || \
    iptables -t filter -A ZASH_BLOCK -s "$ip_" -j DROP
  persist_block "ip" "$ip_" "all"
  reply_ok '{"ok":true}'
}

unblock_ip() {
  ip_="$1"
  [ -n "$ip_" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; return; }
  ensure_block_chain
  while iptables -t filter -D ZASH_BLOCK -s "$ip_" -j DROP >/dev/null 2>&1; do :; done
  remove_persist_block "ip" "$ip_"
  reply_ok '{"ok":true}'
}

rehydrate_blocks() {
  [ -f "$BLOCKS_FILE" ] || return 0
  ensure_block_chain
  while read -r a b c; do
    [ -n "$a" ] || continue

    kind="$a"
    key="$b"
    val="$c"

    # Legacy format: <mac> <ports>
    if [ "$kind" != "mac" ] && [ "$kind" != "ip" ]; then
      kind="mac"
      key="$a"
      val="$b"
    fi

    if [ "$kind" = "ip" ]; then
      [ -n "$key" ] || continue
      iptables -t filter -C ZASH_BLOCK -s "$key" -j DROP >/dev/null 2>&1 || \
        iptables -t filter -A ZASH_BLOCK -s "$key" -j DROP
      continue
    fi

    m="$key"
    p="$val"
    [ -n "$m" ] || continue
    [ -n "$p" ] || p="all"

    if [ "$p" = "all" ] || [ "$p" = "ALL" ]; then
      iptables -t filter -C ZASH_BLOCK -m mac --mac-source "$m" -j DROP >/dev/null 2>&1 || \
        iptables -t filter -A ZASH_BLOCK -m mac --mac-source "$m" -j DROP
      continue
    fi

    oldIFS="$IFS"; IFS=','
    for port in $p; do
      port="$(echo "$port" | tr -d ' ')"
      echo "$port" | grep -q '^[0-9]\+$' || continue
      iptables -t filter -C ZASH_BLOCK -m mac --mac-source "$m" -p tcp --dport "$port" -j REJECT >/dev/null 2>&1 || \
        iptables -t filter -A ZASH_BLOCK -m mac --mac-source "$m" -p tcp --dport "$port" -j REJECT
      iptables -t filter -C ZASH_BLOCK -m mac --mac-source "$m" -p udp --dport "$port" -j REJECT >/dev/null 2>&1 || \
        iptables -t filter -A ZASH_BLOCK -m mac --mac-source "$m" -p udp --dport "$port" -j REJECT
    done
    IFS="$oldIFS"
  done < "$BLOCKS_FILE"
  return 0
}

ip_to_int() {
  echo "$1" | awk -F. '{print ($1*256*256*256)+($2*256*256)+($3*256)+$4}'
}

minor_for_ip() {
  n="$(ip_to_int "$1")"
  echo $(( (n % 4095) + 10 ))
}

qos_minor_for_ip() {
  n="$(ip_to_int "$1")"
  echo $(( (n % 4095) + 5000 ))
}

qos_profile_pct() {
  case "$1" in
    critical) echo "$QOS_CRITICAL_PCT" ;;
    high) echo "$QOS_HIGH_PCT" ;;
    elevated) echo "$QOS_ELEVATED_PCT" ;;
    low) echo "$QOS_LOW_PCT" ;;
    background) echo "$QOS_BACKGROUND_PCT" ;;
    *) echo "$QOS_NORMAL_PCT" ;;
  esac
}

qos_profile_prio() {
  case "$1" in
    critical) echo "$QOS_CRITICAL_PRIO" ;;
    high) echo "$QOS_HIGH_PRIO" ;;
    elevated) echo "$QOS_ELEVATED_PRIO" ;;
    low) echo "$QOS_LOW_PRIO" ;;
    background) echo "$QOS_BACKGROUND_PRIO" ;;
    *) echo "$QOS_NORMAL_PRIO" ;;
  esac
}

qos_min_rate() {
  total="$1"; pct="$2"
  echo "$total" | grep -qE '^[0-9]+$' || total=1
  echo "$pct" | grep -qE '^[0-9]+$' || pct=1
  [ "$total" -lt 1 ] && total=1
  [ "$pct" -lt 1 ] && pct=1
  rate=$(( (total * pct + 99) / 100 ))
  [ "$rate" -lt 1 ] && rate=1
  [ "$rate" -gt "$total" ] && rate="$total"
  echo "$rate"
}

qos_downlink_enabled() {
  case "$QOS_MODE" in
    wan-lan|full|legacy) return 0 ;;
    *) return 1 ;;
  esac
}

cleanup_qos_downlink_for_ip() {
  ip_="$1"
  [ -n "$ip_" ] || return 0
  minor_="$(qos_minor_for_ip "$ip_")"
  mark_down_=$((32768 + minor_))
  iptables -t mangle -D ZASH_QOS_DOWN -d "$ip_" -o "$LAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_down_/0xffff" >/dev/null 2>&1 || true
  if [ $have_tc -eq 1 ]; then
    tc filter del dev "$LAN_IF" parent 2: protocol ip prio 10 handle "$mark_down_" fw 2>/dev/null || true
    tc class del dev "$LAN_IF" classid "2:${minor_}" 2>/dev/null || true
  fi
}

cleanup_all_qos_downlink() {
  [ $have_tc -eq 1 ] || return 0
  iptables -t mangle -F ZASH_QOS_DOWN >/dev/null 2>&1 || true
  if [ -f "$QOS_HOSTS_FILE" ]; then
    while read -r ip_ _rest; do
      [ -n "$ip_" ] || continue
      cleanup_qos_downlink_for_ip "$ip_"
    done < "$QOS_HOSTS_FILE"
  fi
  return 0
}

persist_qos_host() {
  ip_="$1"; profile_="$2"
  mkdir -p "$(dirname "$QOS_HOSTS_FILE")" >/dev/null 2>&1 || true
  tmp="${QOS_HOSTS_FILE}.tmp"
  [ -f "$QOS_HOSTS_FILE" ] && grep -v "^${ip_}[[:space:]]" "$QOS_HOSTS_FILE" > "$tmp" 2>/dev/null || true
  echo "${ip_} ${profile_}" >> "$tmp"
  mv "$tmp" "$QOS_HOSTS_FILE" 2>/dev/null || true
}

remove_persist_qos_host() {
  ip_="$1"
  [ -f "$QOS_HOSTS_FILE" ] || return 0
  tmp="${QOS_HOSTS_FILE}.tmp"
  grep -v "^${ip_}[[:space:]]" "$QOS_HOSTS_FILE" > "$tmp" 2>/dev/null || true
  mv "$tmp" "$QOS_HOSTS_FILE" 2>/dev/null || true
}

apply_qos_only() {
  ip="$1"; profile="$2"
  [ $have_tc -eq 1 ] || return 1
  ensure_iptables_chains
  ensure_tc_base

  minor="$(qos_minor_for_ip "$ip")"
  mark_up=$((24576 + minor))
  mark_down=$((32768 + minor))
  pct="$(qos_profile_pct "$profile")"
  prio="$(qos_profile_prio "$profile")"
  up_min="$(qos_min_rate "$WAN_RATE" "$pct")"
  down_min=0
  if qos_downlink_enabled; then
    down_min="$(qos_min_rate "$LAN_RATE" "$pct")"
  fi

  cleanup_qos_downlink_for_ip "$ip"

  iptables -t mangle -C ZASH_QOS_UP -s "$ip" -o "$WAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_up/0xffff" >/dev/null 2>&1 ||     iptables -t mangle -A ZASH_QOS_UP -s "$ip" -o "$WAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_up/0xffff"

  tc class show dev "$WAN_IF" 2>/dev/null | grep -q "1:${minor}" &&     tc class change dev "$WAN_IF" parent 1: classid "1:${minor}" htb rate "${up_min}mbit" ceil "${WAN_RATE}mbit" prio "$prio" 2>/dev/null ||     tc class add dev "$WAN_IF" parent 1: classid "1:${minor}" htb rate "${up_min}mbit" ceil "${WAN_RATE}mbit" prio "$prio" 2>/dev/null || true

  tc filter show dev "$WAN_IF" parent 1: 2>/dev/null | grep -q "handle $mark_up" ||     tc filter add dev "$WAN_IF" parent 1: protocol ip prio 10 handle "$mark_up" fw flowid "1:${minor}" 2>/dev/null || true

  if qos_downlink_enabled; then
    iptables -t mangle -C ZASH_QOS_DOWN -d "$ip" -o "$LAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_down/0xffff" >/dev/null 2>&1 ||       iptables -t mangle -A ZASH_QOS_DOWN -d "$ip" -o "$LAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_down/0xffff"

    tc class show dev "$LAN_IF" 2>/dev/null | grep -q "2:${minor}" &&       tc class change dev "$LAN_IF" parent 2: classid "2:${minor}" htb rate "${down_min}mbit" ceil "${LAN_RATE}mbit" prio "$prio" 2>/dev/null ||       tc class add dev "$LAN_IF" parent 2: classid "2:${minor}" htb rate "${down_min}mbit" ceil "${LAN_RATE}mbit" prio "$prio" 2>/dev/null || true

    tc filter show dev "$LAN_IF" parent 2: 2>/dev/null | grep -q "handle $mark_down" ||       tc filter add dev "$LAN_IF" parent 2: protocol ip prio 10 handle "$mark_down" fw flowid "2:${minor}" 2>/dev/null || true
  fi

  return 0
}

set_host_qos() {
  ip="$1"; profile="$2"
  case "$profile" in
    critical|high|elevated|normal|low|background) ;;
    off|none|disabled|remove|clear|"") remove_host_qos "$ip"; return ;;
    *) reply_ok '{"ok":false,"error":"bad-profile"}'; return ;;
  esac

  if [ $have_tc -ne 1 ]; then
    reply_ok '{"ok":false,"error":"no-tc"}'
    return
  fi

  apply_qos_only "$ip" "$profile" || { reply_ok '{"ok":false,"error":"apply-failed"}'; return; }
  persist_qos_host "$ip" "$profile"

  pct="$(qos_profile_pct "$profile")"
  prio="$(qos_profile_prio "$profile")"
  up_min="$(qos_min_rate "$WAN_RATE" "$pct")"
  down_min=0
  if qos_downlink_enabled; then
    down_min="$(qos_min_rate "$LAN_RATE" "$pct")"
  fi
  reply_ok "$(printf '{"ok":true,"ip":"%s","profile":"%s","priority":%s,"upMinMbit":%s,"downMinMbit":%s,"mode":"%s"}' "$(jesc "$ip")" "$profile" "$prio" "$up_min" "$down_min" "$(jesc "$QOS_MODE")")"
}

remove_host_qos() {
  ip="$1"
  minor="$(qos_minor_for_ip "$ip")"
  mark_up=$((24576 + minor))
  mark_down=$((32768 + minor))

  iptables -t mangle -D ZASH_QOS_UP -s "$ip" -o "$WAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_up/0xffff" >/dev/null 2>&1 || true
  iptables -t mangle -D ZASH_QOS_DOWN -d "$ip" -o "$LAN_IF" -m mark --mark 0x0/0xffff -j MARK --set-xmark "$mark_down/0xffff" >/dev/null 2>&1 || true

  if [ $have_tc -eq 1 ]; then
    tc filter del dev "$WAN_IF" parent 1: protocol ip prio 10 handle "$mark_up" fw 2>/dev/null || true
    tc class del dev "$WAN_IF" classid "1:${minor}" 2>/dev/null || true
    tc filter del dev "$LAN_IF" parent 2: protocol ip prio 10 handle "$mark_down" fw 2>/dev/null || true
    tc class del dev "$LAN_IF" classid "2:${minor}" 2>/dev/null || true
  fi

  remove_persist_qos_host "$ip"
  reply_ok '{"ok":true}'
}

rehydrate_qos_hosts() {
  [ $have_tc -eq 1 ] || return 0
  ensure_iptables_chains
  cleanup_all_qos_downlink >/dev/null 2>&1 || true
  [ -f "$QOS_HOSTS_FILE" ] || return 0
  while read -r ip profile; do
    [ -n "$ip" ] || continue
    case "$profile" in critical|high|elevated|normal|low|background) apply_qos_only "$ip" "$profile" >/dev/null 2>&1 || true ;; esac
  done < "$QOS_HOSTS_FILE"
  return 0
}

qos_status() {
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  printf '{"ok":true,"supported":%s,"wanRateMbit":%s,"lanRateMbit":%s,"qosMode":"%s","qosDownlinkEnabled":%s,"defaults":{"critical":{"pct":%s,"priority":%s},"high":{"pct":%s,"priority":%s},"elevated":{"pct":%s,"priority":%s},"normal":{"pct":%s,"priority":%s},"low":{"pct":%s,"priority":%s},"background":{"pct":%s,"priority":%s}},"items":['     "$( [ $have_tc -eq 1 ] && echo true || echo false )" "$WAN_RATE" "$LAN_RATE" "$(jesc "$QOS_MODE")" $( qos_downlink_enabled && echo true || echo false )     "$QOS_CRITICAL_PCT" "$QOS_CRITICAL_PRIO" "$QOS_HIGH_PCT" "$QOS_HIGH_PRIO" "$QOS_ELEVATED_PCT" "$QOS_ELEVATED_PRIO" "$QOS_NORMAL_PCT" "$QOS_NORMAL_PRIO" "$QOS_LOW_PCT" "$QOS_LOW_PRIO" "$QOS_BACKGROUND_PCT" "$QOS_BACKGROUND_PRIO"
  first=1
  if [ -f "$QOS_HOSTS_FILE" ]; then
    while read -r ip profile; do
      [ -n "$ip" ] || continue
      case "$profile" in critical|high|elevated|normal|low|background) ;; *) continue ;; esac
      pct="$(qos_profile_pct "$profile")"
      prio="$(qos_profile_prio "$profile")"
      up_min="$(qos_min_rate "$WAN_RATE" "$pct")"
      down_min=0
      if qos_downlink_enabled; then
        down_min="$(qos_min_rate "$LAN_RATE" "$pct")"
      fi
      [ "$first" -eq 0 ] && printf ','
      first=0
      printf '{"ip":"%s","profile":"%s","priority":%s,"upMinMbit":%s,"downMinMbit":%s}' "$(jesc "$ip")" "$profile" "$prio" "$up_min" "$down_min"
    done < "$QOS_HOSTS_FILE"
  fi
  printf ']}'
}

apply_tc_only() {
  ip="$1"; up="$2"; down="$3"
  [ $have_tc -eq 1 ] || return 1

  ensure_iptables_chains
  ensure_tc_base

  minor="$(minor_for_ip "$ip")"
  mark_up="$minor"
  mark_down=$((16384 + minor))

  # iptables marks (idempotent)
  iptables -t mangle -C ZASH_UP -s "$ip" -o "$WAN_IF" -j MARK --set-xmark "$mark_up/0xffff" >/dev/null 2>&1 || \
    iptables -t mangle -A ZASH_UP -s "$ip" -o "$WAN_IF" -j MARK --set-xmark "$mark_up/0xffff"

  iptables -t mangle -C ZASH_DOWN -d "$ip" -o "$LAN_IF" -j MARK --set-xmark "$mark_down/0xffff" >/dev/null 2>&1 || \
    iptables -t mangle -A ZASH_DOWN -d "$ip" -o "$LAN_IF" -j MARK --set-xmark "$mark_down/0xffff"

  # WAN class/filter
  tc class show dev "$WAN_IF" 2>/dev/null | grep -q "1:${minor}" && \
    tc class change dev "$WAN_IF" parent 1: classid "1:${minor}" htb rate "${up}mbit" ceil "${up}mbit" 2>/dev/null || \
    tc class add dev "$WAN_IF" parent 1: classid "1:${minor}" htb rate "${up}mbit" ceil "${up}mbit" 2>/dev/null || true

  tc filter show dev "$WAN_IF" parent 1: 2>/dev/null | grep -q "handle $mark_up" || \
    tc filter add dev "$WAN_IF" parent 1: protocol ip prio 1 handle "$mark_up" fw flowid "1:${minor}" 2>/dev/null || true

  # LAN class/filter
  tc class show dev "$LAN_IF" 2>/dev/null | grep -q "2:${minor}" && \
    tc class change dev "$LAN_IF" parent 2: classid "2:${minor}" htb rate "${down}mbit" ceil "${down}mbit" 2>/dev/null || \
    tc class add dev "$LAN_IF" parent 2: classid "2:${minor}" htb rate "${down}mbit" ceil "${down}mbit" 2>/dev/null || true

  tc filter show dev "$LAN_IF" parent 2: 2>/dev/null | grep -q "handle $mark_down" || \
    tc filter add dev "$LAN_IF" parent 2: protocol ip prio 1 handle "$mark_down" fw flowid "2:${minor}" 2>/dev/null || true

  return 0
}

shape_ip() {
  ip="$1"; up="$2"; down="$3"
  if [ $have_tc -ne 1 ]; then
    reply_ok '{"ok":false,"error":"no-tc"}'
    return
  fi

  apply_tc_only "$ip" "$up" "$down" || { reply_ok '{"ok":false,"error":"apply-failed"}'; return; }

  # Persist state
  mkdir -p "$(dirname "$STATE_FILE")" >/dev/null 2>&1 || true
  tmp="${STATE_FILE}.tmp"
  [ -f "$STATE_FILE" ] && grep -v "^${ip} " "$STATE_FILE" > "$tmp" 2>/dev/null || true
  echo "${ip} ${up} ${down}" >> "$tmp"
  mv "$tmp" "$STATE_FILE" 2>/dev/null || true

  reply_ok '{"ok":true}'
}

unshape_ip() {
  ip="$1"
  minor="$(minor_for_ip "$ip")"
  mark_up="$minor"
  mark_down=$((16384 + minor))

  # Remove iptables marks
  iptables -t mangle -D ZASH_UP -s "$ip" -o "$WAN_IF" -j MARK --set-xmark "$mark_up/0xffff" >/dev/null 2>&1 || true
  iptables -t mangle -D ZASH_DOWN -d "$ip" -o "$LAN_IF" -j MARK --set-xmark "$mark_down/0xffff" >/dev/null 2>&1 || true

  if [ $have_tc -eq 1 ]; then
    # Remove tc filters/classes (best effort)
    tc filter del dev "$WAN_IF" parent 1: protocol ip prio 1 handle "$mark_up" fw 2>/dev/null || true
    tc class del dev "$WAN_IF" classid "1:${minor}" 2>/dev/null || true
    tc filter del dev "$LAN_IF" parent 2: protocol ip prio 1 handle "$mark_down" fw 2>/dev/null || true
    tc class del dev "$LAN_IF" classid "2:${minor}" 2>/dev/null || true
  fi

  # Persist state
  if [ -f "$STATE_FILE" ]; then
    tmp="${STATE_FILE}.tmp"
    grep -v "^${ip} " "$STATE_FILE" > "$tmp" 2>/dev/null || true
    mv "$tmp" "$STATE_FILE" 2>/dev/null || true
  fi

  reply_ok '{"ok":true}'
}

rehydrate() {
  if [ $have_tc -ne 1 ]; then
    reply_ok '{"ok":false,"error":"no-tc"}'
    return
  fi
  if [ ! -f "$STATE_FILE" ]; then
    rehydrate_blocks >/dev/null 2>&1 || true
    reply_ok '{"ok":true,"count":0}'
    return
  fi
  count=0
  while read -r ip up down; do
    [ -n "$ip" ] || continue
    [ -n "$up" ] || continue
    [ -n "$down" ] || down="$up"
    apply_tc_only "$ip" "$up" "$down" && count=$((count + 1))
  done < "$STATE_FILE"
  rehydrate_qos_hosts >/dev/null 2>&1 || true
  rehydrate_blocks >/dev/null 2>&1 || true
  reply_ok "$(printf '{"ok":true,"count":%s}' "$count")"
}

status() {
  have_iptables=0
  command -v iptables >/dev/null 2>&1 && have_iptables=1

  # detect hashlimit support
  have_hashlimit=0
  iptables -m hashlimit -h >/dev/null 2>&1 && have_hashlimit=1

  # --- System metrics (best effort) ---
  cpu_pct=0
  if [ -r /proc/stat ]; then
    read _ u1 n1 s1 i1 w1 irq1 sirq1 stl1 rest < /proc/stat
    t1=$((u1+n1+s1+i1+w1+irq1+sirq1+stl1))
    id1=$((i1+w1))
    if command -v usleep >/dev/null 2>&1; then
      usleep 200000 2>/dev/null || true
    else
      sleep 0.2 2>/dev/null || sleep 1 2>/dev/null || true
    fi
    read _ u2 n2 s2 i2 w2 irq2 sirq2 stl2 rest < /proc/stat
    t2=$((u2+n2+s2+i2+w2+irq2+sirq2+stl2))
    id2=$((i2+w2))
    dt=$((t2-t1))
    did=$((id2-id1))
    if [ "$dt" -gt 0 ]; then
      cpu_pct=$(( (100*(dt-did))/dt ))
    fi
  fi
  [ "$cpu_pct" -lt 0 ] && cpu_pct=0
  [ "$cpu_pct" -gt 100 ] && cpu_pct=100

  load1="0"
  load5="0"
  load15="0"
  if [ -r /proc/loadavg ]; then
    load1="$(awk '{print $1}' /proc/loadavg 2>/dev/null)"
    load5="$(awk '{print $2}' /proc/loadavg 2>/dev/null)"
    load15="$(awk '{print $3}' /proc/loadavg 2>/dev/null)"
  fi
  [ -n "$load1" ] || load1="0"
  [ -n "$load5" ] || load5="0"
  [ -n "$load15" ] || load15="0"

  uptime_sec=0
  [ -r /proc/uptime ] && uptime_sec="$(awk '{print int($1)}' /proc/uptime 2>/dev/null)"
  echo "$uptime_sec" | grep -qE '^[0-9]+$' || uptime_sec=0

  mem_total_kb=0
  mem_avail_kb=0
  if [ -r /proc/meminfo ]; then
    mem_total_kb="$(awk '/MemTotal:/{print $2; exit}' /proc/meminfo 2>/dev/null)"
    mem_avail_kb="$(awk '/MemAvailable:/{print $2; exit}' /proc/meminfo 2>/dev/null)"
    [ -n "$mem_avail_kb" ] || mem_avail_kb="$(awk '/MemFree:/{print $2; exit}' /proc/meminfo 2>/dev/null)"
  fi
  echo "$mem_total_kb" | grep -qE '^[0-9]+$' || mem_total_kb=0
  echo "$mem_avail_kb" | grep -qE '^[0-9]+$' || mem_avail_kb=0

  mem_used_kb=$((mem_total_kb-mem_avail_kb))
  [ "$mem_used_kb" -lt 0 ] && mem_used_kb=0
  mem_used_pct=0
  if [ "$mem_total_kb" -gt 0 ]; then
    mem_used_pct=$(( (100*mem_used_kb)/mem_total_kb ))
  fi
  mem_total_b=$((mem_total_kb*1024))
  mem_used_b=$((mem_used_kb*1024))
  mem_free_b=$((mem_avail_kb*1024))

  storage_path="/opt"
  storage_total_b=0
  storage_used_b=0
  storage_free_b=0
  if ! df -k "$storage_path" >/dev/null 2>&1; then
    storage_path="/"
  fi
  if df -k "$storage_path" >/dev/null 2>&1; then
    set -- $(df -k "$storage_path" 2>/dev/null | awk 'NR==2{print $2, $3, $4}')
    st_total_kb="$1"
    st_used_kb="$2"
    st_free_kb="$3"
    echo "$st_total_kb" | grep -qE '^[0-9]+$' || st_total_kb=0
    echo "$st_used_kb" | grep -qE '^[0-9]+$' || st_used_kb=0
    echo "$st_free_kb" | grep -qE '^[0-9]+$' || st_free_kb=0
    storage_total_b=$((st_total_kb*1024))
    storage_used_b=$((st_used_kb*1024))
    storage_free_b=$((st_free_kb*1024))
  fi

  temp_c=""
  for tf in /sys/class/thermal/thermal_zone*/temp /sys/devices/virtual/thermal/thermal_zone*/temp /sys/class/hwmon/hwmon*/temp1_input; do
    [ -r "$tf" ] || continue
    raw_temp="$(cat "$tf" 2>/dev/null | tr -d '\\r\\n ')"
    echo "$raw_temp" | grep -qE '^-?[0-9]+(\.[0-9]+)?$' || continue
    temp_c="$(awk -v t="$raw_temp" 'BEGIN { if (t > 1000 || t < -1000) printf "%.1f", t/1000; else printf "%.1f", t }' 2>/dev/null)"
    [ -n "$temp_c" ] && break
  done

  hostname="$(uname -n 2>/dev/null | tr -d '\r' | head -n 1)"
  [ -n "$hostname" ] || hostname="router"

  model=""
  [ -r /tmp/sysinfo/model ] && model="$(cat /tmp/sysinfo/model 2>/dev/null | tr -d '\000\r' | head -n 1)"
  [ -n "$model" ] || [ ! -r /proc/device-tree/model ] || model="$(cat /proc/device-tree/model 2>/dev/null | tr -d '\000\r' | head -n 1)"
  [ -n "$model" ] || model="$(uname -m 2>/dev/null | tr -d '\r' | head -n 1)"

  firmware="$(detect_router_firmware_text)"

  kernel="$(uname -r 2>/dev/null | tr -d '\r' | head -n 1)"
  arch="$(uname -m 2>/dev/null | tr -d '\r' | head -n 1)"

  xkeen_ver=""
  if command -v xkeen >/dev/null 2>&1; then
    xkeen_ver="$(xkeen -v 2>/dev/null | head -n 1 | tr -d '\r')"
    [ -n "$xkeen_ver" ] || xkeen_ver="$(xkeen --version 2>/dev/null | head -n 1 | tr -d '\r')"
    [ -n "$xkeen_ver" ] || xkeen_ver="installed"
  fi

  mihomo_ver=""
  if command -v mihomo >/dev/null 2>&1; then
    mihomo_ver="$(mihomo -v 2>/dev/null | head -n 1 | tr -d '\r')"
  elif command -v clash-meta >/dev/null 2>&1; then
    mihomo_ver="$(clash-meta -v 2>/dev/null | head -n 1 | tr -d '\r')"
  fi

  agent_ver="$AGENT_VERSION"
  server_ver="$(remote_agent_version 2>/dev/null || true)"
  if [ -z "$server_ver" ] || [ "$(version_cmp_sh "$server_ver" "$agent_ver")" -lt 0 ]; then
    server_ver="$agent_ver"
  fi

  reply_ok "$(printf '{"ok":true,"version":"%s","serverVersion":"%s","wan":"%s","lan":"%s","tc":%s,"iptables":%s,"hashlimit":%s,"hostQos":%s,"usersDb":true,"cpuPct":%s,"load1":"%s","load5":"%s","load15":"%s","uptimeSec":%s,"memTotal":%s,"memUsed":%s,"memFree":%s,"memUsedPct":%s,"storagePath":"%s","storageTotal":%s,"storageUsed":%s,"storageFree":%s,"tempC":"%s","hostname":"%s","model":"%s","firmware":"%s","kernel":"%s","arch":"%s","xkeenVersion":"%s","mihomoBinVersion":"%s"}'     "$agent_ver" "$server_ver" "$WAN_IF" "$LAN_IF"     $( [ $have_tc -eq 1 ] && echo true || echo false )     $( [ $have_iptables -eq 1 ] && echo true || echo false )     $( [ $have_hashlimit -eq 1 ] && echo true || echo false )     $( [ $have_tc -eq 1 ] && echo true || echo false )     "$cpu_pct" "$load1" "$load5" "$load15" "$uptime_sec" "$mem_total_b" "$mem_used_b" "$mem_free_b" "$mem_used_pct" "$(jesc "$storage_path")" "$storage_total_b" "$storage_used_b" "$storage_free_b" "$(jesc "$temp_c")"     "$(jesc "$hostname")" "$(jesc "$model")" "$(jesc "$firmware")" "$(jesc "$kernel")" "$(jesc "$arch")" "$(jesc "$xkeen_ver")" "$(jesc "$mihomo_ver")")"
}

detect_router_firmware_text() {
  line=""
  for p in /etc/ndm/version /opt/etc/ndm/version /tmp/sysinfo/firmware_version /tmp/sysinfo/firmware /etc/version; do
    [ -r "$p" ] || continue
    line="$(head -n 1 "$p" 2>/dev/null | tr -d '\000
')"
    [ -n "$line" ] && { printf '%s' "$line"; return 0; }
  done

  if command -v ndmq >/dev/null 2>&1; then
    for key in system/release/version system/version version; do
      line="$(ndmq -p "$key" 2>/dev/null | head -n 1 | tr -d '\000
')"
      [ -n "$line" ] && { printf '%s' "$line"; return 0; }
    done
  fi

  if command -v ubus >/dev/null 2>&1; then
    line="$(ubus call system board 2>/dev/null | sed -n 's/.*"release"[[:space:]]*:[[:space:]]*{.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*//p' | head -n 1 | tr -d '\000
')"
    [ -n "$line" ] && { printf '%s' "$line"; return 0; }
  fi

  if command -v xkeen >/dev/null 2>&1; then
    line="$(xkeen -v 2>/dev/null | head -n 1 | tr -d '\000
')"
    [ -n "$line" ] || line="$(xkeen --version 2>/dev/null | head -n 1 | tr -d '\000
')"
    [ -n "$line" ] && { printf '%s' "$line"; return 0; }
  fi

  return 1
}

firmware_check_json() {
  force_q="$1"
  echo "Content-Type: application/json"
  echo "Access-Control-Allow-Origin: *"
  echo "Access-Control-Allow-Methods: GET, POST, OPTIONS"
  echo "Access-Control-Allow-Headers: Content-Type, Authorization"
  echo "Access-Control-Allow-Private-Network: true"
  echo "Cache-Control: no-store"
  echo

  current="$(detect_router_firmware_text 2>/dev/null || true)"
  checked_at="$(date -u '+%Y-%m-%dT%H:%M:%SZ' 2>/dev/null || date '+%Y-%m-%dT%H:%M:%S' 2>/dev/null || echo '')"

  main_url="https://support.netcraze.ru/ultra/nc-1812/ru/46907-latest-main-release.html"
  preview_url="https://support.netcraze.ru/ultra/nc-1812/ru/46988-latest-preview-release.html"
  dev_url="https://support.netcraze.ru/ultra/nc-1812/ru/46620-latest-development-release.html"

  main_page="$(firmware_fetch_url "$main_url" 2>/dev/null || true)"
  preview_page="$(firmware_fetch_url "$preview_url" 2>/dev/null || true)"
  dev_page="$(firmware_fetch_url "$dev_url" 2>/dev/null || true)"

  main_latest="$(firmware_extract_latest_version "$main_page")"
  preview_latest="$(firmware_extract_latest_version "$preview_page")"
  dev_latest="$(firmware_extract_latest_version "$dev_page")"

  chosen_channel="main"
  latest=""
  source_url="$main_url"

  if [ -n "$current" ]; then
    chosen_channel="$(firmware_detect_channel "$current" "$main_latest" "$preview_latest" "$dev_latest")"
  fi

  case "$chosen_channel" in
    dev)
      latest="$dev_latest"
      source_url="$dev_url"
      ;;
    preview)
      latest="$preview_latest"
      source_url="$preview_url"
      ;;
    *)
      latest="$main_latest"
      source_url="$main_url"
      chosen_channel="main"
      ;;
  esac

  update=false
  if [ -n "$current" ] && [ -n "$latest" ] && [ "$(firmware_cmp "$current" "$latest")" = "-1" ]; then
    update=true
  fi

  printf '{"ok":true,"currentVersion":"%s","latestVersion":"%s","updateAvailable":%s,"checkedAt":"%s","cached":false,"stale":false,"sourceUrl":"%s","channel":"%s","mainLatestVersion":"%s","previewLatestVersion":"%s","devLatestVersion":"%s"}' \
    "$(jesc "$current")" "$(jesc "$latest")" "$update" "$(jesc "$checked_at")" "$(jesc "$source_url")" "$(jesc "$chosen_channel")" \
    "$(jesc "$main_latest")" "$(jesc "$preview_latest")" "$(jesc "$dev_latest")"
}

agent_log() {
  # Best-effort command log for troubleshooting.
  # Stored locally on router, can be viewed via cmd=logs&type=agent.
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true
  printf '%s cmd=%s ip=%s mac=%s ports=%s type=%s\n' "$(date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo 'date')" "$cmd" "$ip" "$mac" "$ports" "$type" >> /opt/zash-agent/var/agent.log 2>/dev/null || true
}

find_mihomo_log() {
  # Try to discover Mihomo/Clash log file.
  # Priority: explicit MIHOMO_LOG env -> config log-file -> common paths.
  if [ -n "$MIHOMO_LOG" ] && [ -f "$MIHOMO_LOG" ]; then
    echo "$MIHOMO_LOG"
    return 0
  fi

  cfg="$MIHOMO_CONFIG"
  if [ -f "$cfg" ]; then
    lf="$(awk -F: 'BEGIN{IGNORECASE=1} $1 ~ /^[[:space:]]*log[-_]?file[[:space:]]*$/ {sub(/^[[:space:]]+/,"",$2); sub(/[[:space:]]+$/,"",$2); gsub(/^"|"$/,"",$2); gsub(/^\x27|\x27$/,"",$2); print $2; exit}' "$cfg" 2>/dev/null)"
    if [ -n "$lf" ] && [ -f "$lf" ]; then
      echo "$lf"
      return 0
    fi
  fi

  for p in \
    /opt/var/log/mihomo.log \
    /opt/var/log/mihomo/mihomo.log \
    /opt/var/log/clash.log \
    /opt/var/log/clash/clash.log \
    /opt/etc/mihomo/mihomo.log \
    /opt/etc/mihomo/clash.log \
    /tmp/mihomo.log \
    /tmp/clash.log \
    /tmp/syslog.log \
    /var/log/mihomo.log \
    /var/log/clash.log \
    /var/log/messages \
    /var/log/syslog
  do
    [ -f "$p" ] && { echo "$p"; return 0; }
  done

  echo ""
  return 0
}

config_b64() {
  # Return Mihomo YAML config (best-effort).
  path="$MIHOMO_CONFIG"
  txt=""
  if [ -f "$path" ]; then
    txt="$(cat "$path" 2>/dev/null)"
  fi
  txt="$(printf '%s' "$txt" | tail -c 204800 2>/dev/null || printf '%s' "$txt")"
  b64="$(printf '%s' "$txt" | b64enc)"
  esc_path="$(printf '%s' "$path" | sed 's/"/\\\"/g')"
  reply_ok "$(printf '{"ok":true,"kind":"config","path":"%s","contentB64":"%s"}' "$esc_path" "$b64")"
}

tail_b64() {
  kind="$1"
  n="$2"
  echo "$n" | grep -qE '^[0-9]+$' || n=200
  [ "$n" -gt 2000 ] && n=2000

  path=""
  txt=""

  if [ "$kind" = "agent" ]; then
    path="/opt/zash-agent/var/agent.log"
    [ -f "$path" ] && txt="$(tail -n "$n" "$path" 2>/dev/null)"
  else
    path="$(find_mihomo_log)"
    if [ -n "$path" ] && [ -f "$path" ]; then
      txt="$(tail -n "$n" "$path" 2>/dev/null)"
    elif command -v logread >/dev/null 2>&1; then
      txt="$(logread 2>/dev/null | tail -n "$n" 2>/dev/null)"
      path="logread"
    fi
  fi

  if [ "$kind" != "agent" ] && [ -z "$path" ] && [ -z "$txt" ]; then
    txt="No Mihomo log found. Set 'log-file:' in $MIHOMO_CONFIG, or set MIHOMO_LOG in /opt/zash-agent/agent.env. You can also view the config via cmd=logs&type=config."
    path="$MIHOMO_CONFIG"
  fi

  # cap to ~200KB
  txt="$(printf '%s' "$txt" | tail -c 204800 2>/dev/null || printf '%s' "$txt")"
  b64="$(printf '%s' "$txt" | b64enc)"
  esc_path="$(printf '%s' "$path" | sed 's/"/\\"/g')"
  reply_ok "$(printf '{"ok":true,"kind":"%s","path":"%s","contentB64":"%s"}' "$kind" "$esc_path" "$b64")"
tail_follow_b64() {
  kind="$1"
  n="$2"
  off="$3"
  echo "$n" | grep -qE '^[0-9]+$' || n=200
  [ "$n" -gt 2000 ] && n=2000
  echo "$off" | grep -qE '^[0-9]+$' || off=0

  path=""
  txt=""
  mode="delta"
  truncated=false

  if [ "$kind" = "agent" ]; then
    path="/opt/zash-agent/var/agent.log"
  else
    path="$(find_mihomo_log)"
    if [ -z "$path" ] || [ ! -f "$path" ]; then
      if command -v logread >/dev/null 2>&1; then
        # logread cannot be tailed incrementally reliably; fall back to full snapshot
        txt="$(logread 2>/dev/null | tail -n "$n" 2>/dev/null)"
        path="logread"
        mode="full"
        off=0
      else
        path=""
      fi
    fi
  fi

  if [ -n "$path" ] && [ -f "$path" ]; then
    sz="$(wc -c < "$path" 2>/dev/null | tr -d ' ')"
    echo "$sz" | grep -qE '^[0-9]+$' || sz=0

    if [ "$off" -le 0 ] || [ "$off" -gt "$sz" ]; then
      txt="$(tail -n "$n" "$path" 2>/dev/null)"
      mode="full"
    else
      delta=$((sz-off))
      # cap per response
      if [ "$delta" -gt 204800 ]; then
        delta=204800
        truncated=true
      fi
      [ "$delta" -gt 0 ] && txt="$(tail -c "$delta" "$path" 2>/dev/null)" || txt=""
      mode="delta"
    fi
    off="$sz"
  fi

  if [ "$kind" != "agent" ] && [ -z "$path" ] && [ -z "$txt" ]; then
    txt="No Mihomo log found. Set 'log-file:' in $MIHOMO_CONFIG, or set MIHOMO_LOG in /opt/zash-agent/agent.env. You can also view the config via cmd=logs&type=config."
    path="$MIHOMO_CONFIG"
    mode="full"
    off=0
  fi

  # cap to ~200KB
  txt="$(printf '%s' "$txt" | tail -c 204800 2>/dev/null || printf '%s' "$txt")"
  b64="$(printf '%s' "$txt" | b64enc)"
  esc_path="$(printf '%s' "$path" | sed 's/"/\\"/g')"
  reply_ok "$(printf '{"ok":true,"kind":"%s","path":"%s","contentB64":"%s","offset":%s,"mode":"%s","truncated":%s}' "$kind" "$esc_path" "$b64" "$off" "$mode" "$truncated")"
}


}


rclone_configured_remotes() {
  src="$RCLONE_REMOTES"
  if [ -z "$src" ]; then
    src="$RCLONE_REMOTE"
  fi
  # BusyBox tr does not reliably interpret '\n' in all builds, so split with sed.
  printf '%s' "$src" \
    | sed 's/[;,[:space:]]\+/\n/g' \
    | sed 's/:$//; s/^ *//; s/ *$//' \
    | awk 'NF && !seen[$0]++ {print $0}'
}

rclone_list_remotes() {
  if ! command -v rclone >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "$RCLONE_CONFIG" ]; then
    rclone listremotes --config "$RCLONE_CONFIG" 2>/dev/null || true
  else
    rclone listremotes 2>/dev/null || true
  fi
}

rclone_known_remotes() {
  cfg_path="$1"
  known="$(rclone_list_remotes)"
  if [ -n "$known" ]; then
    printf '%s\n' "$known"
    return 0
  fi
  [ -n "$cfg_path" ] || cfg_path="$RCLONE_CONFIG"
  if [ -n "$cfg_path" ] && [ -f "$cfg_path" ]; then
    awk '
      /^[[:space:]]*\[[^]]+\][[:space:]]*$/ {
        name=$0
        sub(/^[[:space:]]*\[/, "", name)
        sub(/\][[:space:]]*$/, "", name)
        if (name != "") print name ":"
      }
    ' "$cfg_path" | awk '!seen[$0]++'
  fi
}

rclone_known_remote_names() {
  cfg_path="$1"
  rclone_known_remotes "$cfg_path" | sed 's/:$//' | awk 'NF && !seen[$0]++ {print $0}'
}

rclone_resolved_remotes() {
  req_remote="$1"
  test_path="$2"
  cfg_path="$3"
  if [ -n "$req_remote" ]; then
    printf '%s\n' "$req_remote" | sed 's/:$//' | awk 'NF && !seen[$0]++ {print $0}'
    return 0
  fi

  configured="$(rclone_configured_remotes)"
  valid=""
  known="$(rclone_known_remotes "$cfg_path")"
  if [ -n "$configured" ]; then
    oldIFS="$IFS"
    IFS='
'
    for remote in $configured; do
      [ -n "$remote" ] || continue
      exists=false
      if printf '%s\n' "$known" | grep -Fxq "$remote:"; then
        exists=true
      elif rclone_remote_accessible "$remote" "$test_path"; then
        exists=true
      fi
      if [ "$exists" = true ]; then
        valid="$valid
$remote"
      fi
    done
    IFS="$oldIFS"
  fi

  if [ -n "$(printf '%s' "$valid" | awk 'NF{print $0; exit}')" ]; then
    printf '%s\n' "$valid" | awk 'NF && !seen[$0]++ {print $0}'
    return 0
  fi

  rclone_known_remote_names "$cfg_path"
}

rclone_json_bool() {
  [ "$1" = "true" ] && printf true || printf false
}

rclone_remote_accessible() {
  remote="$1"
  test_path="$2"
  [ -n "$remote" ] || return 1
  if ! command -v rclone >/dev/null 2>&1; then
    return 1
  fi
  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi
  root_target="$remote:"
  # shellcheck disable=SC2086
  if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$root_target" --max-depth 1 >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "$test_path" ]; then
    path_target="$remote:$test_path"
    # shellcheck disable=SC2086
    if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$path_target" --max-depth 1 >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

rclone_find_file_remote() {
  name="$1"
  path="$2"
  req_remote="$3"
  [ -n "$name" ] || return 1
  rems="$(rclone_resolved_remotes "$req_remote" "$path" "")"
  [ -n "$rems" ] || return 1
  oldIFS="$IFS"
  IFS=$(printf '\n_'); IFS=${IFS%_}
  for remote in $rems; do
    [ -n "$remote" ] || continue
    src="$remote:$name"
    [ -n "$path" ] && src="$remote:$path/$name"
    rcfg=""
    if [ -n "$RCLONE_CONFIG" ]; then
      rcfg="--config $RCLONE_CONFIG"
    fi
    # shellcheck disable=SC2086
    if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$src" --max-depth 1 >/dev/null 2>&1; then
      printf '%s' "$remote"
      IFS="$oldIFS"
      return 0
    fi
  done
  IFS="$oldIFS"
  return 1
}

rclone_latest_remote_name() {
  path="$1"
  req_remote="$2"
  rems="$(rclone_resolved_remotes "$req_remote" "$path" "")"
  [ -n "$rems" ] || return 1
  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi
  best_remote=""
  best_name=""
  best_key=""
  oldIFS="$IFS"
  IFS=$(printf '\n_'); IFS=${IFS%_}
  for remote in $rems; do
    [ -n "$remote" ] || continue
    remote_dir="$remote:"
    [ -n "$path" ] && remote_dir="$remote:$path"
    # shellcheck disable=SC2086
    line="$(RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsl "$remote_dir" --include 'zash-backup-*.tar.gz' 2>/dev/null | sort -k2,3 | tail -n1)"
    [ -n "$line" ] || continue
    name="$(printf '%s' "$line" | awk '{print $4}')"
    key="$(printf '%s' "$line" | awk '{print $2" "$3}')"
    [ -n "$name" ] || continue
    if [ -z "$best_key" ] || [ "$key" \> "$best_key" ]; then
      best_key="$key"
      best_name="$name"
      best_remote="$remote"
    fi
  done
  IFS="$oldIFS"
  [ -n "$best_name" ] || return 1
  printf '%s	%s' "$best_remote" "$best_name"
}

backup_cloud_status_json() {
  path="$(normalize_rclone_path "$RCLONE_PATH")"
  cfg="$RCLONE_CONFIG"
  if [ -z "$cfg" ] && command -v rclone >/dev/null 2>&1; then
    cfg="$(rclone config file 2>/dev/null | awk 'NR==2{print $0}' | tail -n1)"
  fi

  rclone_installed=false
  cloud_ready=false
  remotes_json='[]'
  primary_remote=""
  primary_exists=false
  configured_remote_names="$(rclone_configured_remotes)"
  remote_names="$(rclone_resolved_remotes "" "$path" "$cfg")"

  if command -v rclone >/dev/null 2>&1; then
    rclone_installed=true
    known="$(rclone_known_remotes "$cfg")"
    if [ -n "$configured_remote_names" ] && [ -n "$remote_names" ]; then
      has_ready_configured=false
      oldIFS="$IFS"
      IFS='
'
      for configured_remote in $configured_remote_names; do
        [ -n "$configured_remote" ] || continue
        if printf '%s\n' "$remote_names" | grep -Fxq "$configured_remote"; then
          has_ready_configured=true
          break
        fi
      done
      IFS="$oldIFS"
      if [ "$has_ready_configured" = true ]; then
        remote_names="$configured_remote_names"
      fi
    fi
    items=""
    oldIFS="$IFS"
    IFS='
'
    for remote in $remote_names; do
      [ -n "$remote" ] || continue
      [ -z "$primary_remote" ] && primary_remote="$remote"
      exists=false
      if printf '%s\n' "$known" | grep -Fxq "$remote:"; then
        exists=true
      elif rclone_remote_accessible "$remote" "$path"; then
        exists=true
      fi
      if [ "$exists" = true ]; then
        cloud_ready=true
      fi
      [ "$remote" = "$primary_remote" ] && primary_exists="$exists"
      [ -n "$items" ] && items="$items,"
      items="$items$(printf '{"name":"%s","exists":%s}' "$(jesc "$remote")" "$(rclone_json_bool "$exists")")"
    done
    IFS="$oldIFS"
    remotes_json="[$items]"
  fi

  [ -n "$primary_remote" ] || primary_remote="$RCLONE_REMOTE"

  reply_ok "$(printf '{"ok":true,"rcloneInstalled":%s,"configPath":"%s","remote":"%s","remoteExists":%s,"path":"%s","cloudReady":%s,"keepDays":"%s","localKeepDays":"%s","uiZipEnabled":%s,"remotes":%s}'     "$rclone_installed" "$(jesc "$cfg")" "$(jesc "$primary_remote")" "$(rclone_json_bool "$primary_exists")" "$(jesc "$path")" "$(rclone_json_bool "$cloud_ready")" "$(jesc "$RCLONE_KEEP_DAYS")" "$(jesc "$BACKUP_KEEP_DAYS")" "$( [ -n "$UI_ZIP_URL" ] && echo true || echo false )" "$remotes_json")"
}


backup_cloud_list_json() {
  path="$(normalize_rclone_path "$RCLONE_PATH")"

  if ! command -v rclone >/dev/null 2>&1; then
    reply_ok '{"ok":true,"remote":"","path":"","dir":"","items":[]}'
    return
  fi

  remotes="$(rclone_resolved_remotes "" "$path" "")"
  if [ -z "$remotes" ]; then
    reply_ok "$(printf '{"ok":true,"remote":"%s","path":"%s","dir":"","items":[]}' "$(jesc "$RCLONE_REMOTE")" "$(jesc "$path")")"
    return
  fi

  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi

  items=""
  first=1
  oldIFS="$IFS"
  IFS='
'
  for remote in $remotes; do
    [ -n "$remote" ] || continue
    dst="$remote:"
    [ -n "$path" ] && dst="$remote:$path"
    # shellcheck disable=SC2086
    json="$(RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsjson "$dst" --files-only --max-depth 1 2>/dev/null || printf '[]')"
    [ -n "$json" ] || json='[]'
    tmp_json="/tmp/zash-cloud-list.$$"
    printf '%s\n' "$json" | sed 's/},{/}\n{/g' > "$tmp_json"
    while IFS= read -r line; do
      [ -n "$line" ] || continue
      [ "$line" = '[' ] && continue
      [ "$line" = ']' ] && continue
      line="$(printf '%s' "$line" | sed 's/^ *,*//; s/, *$//')"
      [ -n "$line" ] || continue
      item="$(printf '%s' "$line" | sed 's/^{//; s/}$//')"
      [ -n "$item" ] || continue
      [ $first -eq 1 ] || items="$items,"
      first=0
      items="$items$(printf '{"Remote":"%s","RemotePath":"%s",%s}' "$(jesc "$remote")" "$(jesc "$path")" "$item")"
    done < "$tmp_json"
    rm -f "$tmp_json" >/dev/null 2>&1 || true
  done
  IFS="$oldIFS"

  reply_ok "$(printf '{"ok":true,"remote":"%s","path":"%s","dir":"%s","items":[%s]}' "$(jesc "$RCLONE_REMOTE")" "$(jesc "$path")" "$(jesc "$path")" "$items")"
}

backup_status_json() {
  sf="/opt/zash-agent/var/backup.last.json"
  if [ -f "$sf" ]; then
    payload="$(cat "$sf" 2>/dev/null | tail -c 8192 2>/dev/null)"
    [ -n "$payload" ] || payload='{"ok":true,"running":false}'
    reply_ok "$payload"
  else
    reply_ok '{"ok":true,"running":false}'
  fi
}

backup_start_json() {
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true
  sf="/opt/zash-agent/var/backup.last.json"
  started="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"
  req_remotes="${remotes_q:-}"
  esc_started="$(jesc "$started")"
  esc_req_remotes="$(jesc "$req_remotes")"
  if [ -n "$req_remotes" ]; then
    printf '{"ok":true,"running":true,"startedAt":"%s","requestedRemotes":"%s"}' "$esc_started" "$esc_req_remotes" > "$sf" 2>/dev/null || true
  else
    printf '{"ok":true,"running":true,"startedAt":"%s"}' "$esc_started" > "$sf" 2>/dev/null || true
  fi
  # Run in background so CGI returns immediately.
  ( /opt/zash-agent/backup.sh "$req_remotes" > /opt/zash-agent/var/backup.last.log 2>&1 & ) >/dev/null 2>&1 || true
  if [ -n "$req_remotes" ]; then
    reply_ok "$(printf '{"ok":true,"running":true,"requestedRemotes":"%s"}' "$(jesc "$req_remotes")")"
  else
    reply_ok '{"ok":true,"running":true}'
  fi
}

backup_log_json() {
  lf="/opt/zash-agent/var/backup.last.log"
  n="$lines"
  echo "$n" | grep -qE '^[0-9]+$' || n=200
  [ "$n" -gt 2000 ] && n=2000
  txt=""
  [ -f "$lf" ] && txt="$(tail -n "$n" "$lf" 2>/dev/null)"
  txt="$(printf '%s' "$txt" | tail -c 204800 2>/dev/null || printf '%s' "$txt")"
  b64="$(printf '%s' "$txt" | b64enc)"
  esc_path="$(printf '%s' "$lf" | sed 's/"/\\"/g')"
  reply_ok "$(printf '{"ok":true,"path":"%s","contentB64":"%s"}' "$esc_path" "$b64")"
}

backup_list_json() {
  dir="$BACKUP_TMP_DIR"
  [ -n "$dir" ] || dir="/opt/zash-agent/var/backups"
  mkdir -p "$dir" >/dev/null 2>&1 || true

  items=""
  first=1
  # List up to 50 most recent backups (best-effort).
  for f in $(ls -1t "$dir"/zash-backup-*.tar.gz 2>/dev/null | head -n 50); do
    [ -f "$f" ] || continue
    name="$(basename "$f" 2>/dev/null || echo "$f")"
    size="$(wc -c < "$f" 2>/dev/null || echo 0)"
    mtime="$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)"
    esc_name="$(printf '%s' "$name" | sed 's/"/\\\\"/g')"
    [ -n "$items" ] && items="$items,"
    items="$items$(printf '{"name":"%s","size":%s,"mtime":%s}' "$esc_name" "$size" "$mtime")"
  done

  esc_dir="$(printf '%s' "$dir" | sed 's/"/\\\\"/g')"
  reply_ok "$(printf '{"ok":true,"dir":"%s","items":[%s]}' "$esc_dir" "$items")"
}

backup_delete_json() {
  dir="$BACKUP_TMP_DIR"
  [ -n "$dir" ] || dir="/opt/zash-agent/var/backups"
  mkdir -p "$dir" >/dev/null 2>&1 || true

  req="${file_q:-}"
  name="$(basename "$req" 2>/dev/null || printf '%s' "$req")"
  case "$name" in
    zash-backup-*.tar.gz|ui-dist-*.zip) ;;
    *)
      reply_err 'invalid backup file'
      return
      ;;
  esac

  target="$dir/$name"
  if [ ! -f "$target" ]; then
    reply_ok "$(printf '{"ok":true,"deleted":false,"name":"%s"}' "$(jesc "$name")")"
    return
  fi

  rm -f "$target" >/dev/null 2>&1 || {
    reply_err 'delete failed'
    return
  }

  reply_ok "$(printf '{"ok":true,"deleted":true,"name":"%s"}' "$(jesc "$name")")"
}

backup_cloud_delete_json() {
  path="$(normalize_rclone_path "$RCLONE_PATH")"
  req_remote="${remote_q:-}"
  req="${file_q:-}"
  name="$(basename "$req" 2>/dev/null || printf '%s' "$req")"
  case "$name" in
    zash-backup-*.tar.gz|ui-dist-*.zip) ;;
    *)
      reply_err 'invalid backup file'
      return
      ;;
  esac

  if ! command -v rclone >/dev/null 2>&1; then
    reply_err 'rclone is not installed'
    return
  fi

  remotes=""
  if [ -n "$req_remote" ]; then
    remotes="$req_remote"
  else
    remotes="$(rclone_configured_remotes)"
  fi
  if [ -z "$remotes" ]; then
    reply_err 'cloud backup is not configured'
    return
  fi

  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi

  deleted=false
  oldIFS="$IFS"
  IFS='
'
  for remote in $remotes; do
    [ -n "$remote" ] || continue
    dst="$remote:$name"
    [ -n "$path" ] && dst="$remote:$path/$name"
    # shellcheck disable=SC2086
    if RCLONE_CONFIG="$RCLONE_CONFIG" rclone deletefile "$dst" >/dev/null 2>&1; then
      deleted=true
      [ -n "$req_remote" ] && break
    fi
  done
  IFS="$oldIFS"

  if [ "$deleted" != true ]; then
    reply_err 'cloud delete failed'
    return
  fi

  reply_ok "$(printf '{"ok":true,"deleted":true,"name":"%s","remote":"%s"}' "$(jesc "$name")" "$(jesc "$req_remote")")"
}

backup_cloud_download_json() {
  path="$(normalize_rclone_path "$RCLONE_PATH")"
  req_remote="${remote_q:-}"
  req="${file_q:-}"
  name="$(basename "$req" 2>/dev/null || printf '%s' "$req")"
  case "$name" in
    zash-backup-*.tar.gz|ui-dist-*.zip) ;;
    *)
      reply_err 'invalid backup file'
      return
      ;;
  esac

  if ! command -v rclone >/dev/null 2>&1; then
    reply_err 'rclone is not installed'
    return
  fi

  dir="$BACKUP_TMP_DIR"
  [ -n "$dir" ] || dir="/opt/zash-agent/var/backups"
  mkdir -p "$dir" >/dev/null 2>&1 || true

  local_file="$dir/$name"
  if [ -f "$local_file" ]; then
    size="$(wc -c < "$local_file" 2>/dev/null || echo 0)"
    mtime="$(stat -c %Y "$local_file" 2>/dev/null || stat -f %m "$local_file" 2>/dev/null || echo 0)"
    reply_ok "$(printf '{"ok":true,"downloaded":true,"existed":true,"name":"%s","path":"%s","size":%s,"mtime":%s,"remote":"%s"}' "$(jesc "$name")" "$(jesc "$local_file")" "$size" "$mtime" "$(jesc "$req_remote")")"
    return
  fi

  remote="$(rclone_find_file_remote "$name" "$path" "$req_remote")"
  if [ -z "$remote" ]; then
    reply_err 'cloud backup is not configured'
    return
  fi

  src="$remote:$name"
  [ -n "$path" ] && src="$remote:$path/$name"

  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi

  # shellcheck disable=SC2086
  if ! RCLONE_CONFIG="$RCLONE_CONFIG" rclone copyto "$src" "$local_file" >/dev/null 2>&1; then
    rm -f "$local_file" >/dev/null 2>&1 || true
    reply_err 'cloud download failed'
    return
  fi

  size="$(wc -c < "$local_file" 2>/dev/null || echo 0)"
  mtime="$(stat -c %Y "$local_file" 2>/dev/null || stat -f %m "$local_file" 2>/dev/null || echo 0)"
  reply_ok "$(printf '{"ok":true,"downloaded":true,"existed":false,"name":"%s","path":"%s","size":%s,"mtime":%s,"remote":"%s"}' "$(jesc "$name")" "$(jesc "$local_file")" "$size" "$mtime" "$(jesc "$remote")")"
}

restore_status_json() {
  sf="/opt/zash-agent/var/restore.last.json"
  if [ -f "$sf" ]; then
    payload="$(cat "$sf" 2>/dev/null | tail -c 8192 2>/dev/null)"
    [ -n "$payload" ] || payload='{"ok":true,"running":false}'
    reply_ok "$payload"
  else
    reply_ok '{"ok":true,"running":false}'
  fi
}

restore_start_json() {
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true
  sf="/opt/zash-agent/var/restore.last.json"
  started="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"
  esc_started="$(jesc "$started")"

  f="${file_q:-}"
  scope="${scope_q:-all}"
  env="${env_q:-0}"
  source="${source_q:-local}"
  remote="${remote_q:-}"
  runner="/opt/zash-agent/restore.sh"
  case "$source" in
    cloud) runner="/opt/zash-agent/restore-cloud.sh" ;;
    *) source="local" ;;
  esac

  printf '{"ok":true,"running":true,"startedAt":"%s","source":"%s","stage":"queued","progressPct":0}' "$esc_started" "$source" > "$sf" 2>/dev/null || true

  # Run in background so CGI returns immediately.
  if [ "$source" = "cloud" ]; then
    ( "$runner" "$f" "$scope" "$env" "$remote" > /opt/zash-agent/var/restore.last.log 2>&1 & ) >/dev/null 2>&1 || true
  else
    ( "$runner" "$f" "$scope" "$env" > /opt/zash-agent/var/restore.last.log 2>&1 & ) >/dev/null 2>&1 || true
  fi
  reply_ok '{"ok":true,"running":true}'
}

restore_log_json() {
  lf="/opt/zash-agent/var/restore.last.log"
  n="$lines"
  echo "$n" | grep -qE '^[0-9]+$' || n=200
  [ "$n" -gt 2000 ] && n=2000
  txt=""
  [ -f "$lf" ] && txt="$(tail -n "$n" "$lf" 2>/dev/null)"
  txt="$(printf '%s' "$txt" | tail -c 204800 2>/dev/null || printf '%s' "$txt")"
  b64="$(printf '%s' "$txt" | b64enc)"
  esc_path="$(printf '%s' "$lf" | sed 's/"/\\\\"/g')"
  reply_ok "$(printf '{"ok":true,"path":"%s","contentB64":"%s"}' "$esc_path" "$b64")"
}


cron_tab_path() {
  if [ -f /opt/etc/crontabs/root ] || [ -d /opt/etc/crontabs ]; then
    echo "/opt/etc/crontabs/root"
    return 0
  fi
  if [ -f /opt/var/spool/cron/crontabs/root ] || [ -d /opt/var/spool/cron/crontabs ]; then
    echo "/opt/var/spool/cron/crontabs/root"
    return 0
  fi
  if [ -f /etc/crontabs/root ] || [ -d /etc/crontabs ]; then
    echo "/etc/crontabs/root"
    return 0
  fi
  if [ -f /var/spool/cron/crontabs/root ] || [ -d /var/spool/cron/crontabs ]; then
    echo "/var/spool/cron/crontabs/root"
    return 0
  fi
  echo ""
  return 0
}

cron_reload_best_effort() {
  if command -v crontab >/dev/null 2>&1; then
    crontab "$tab" >/dev/null 2>&1 || true
  fi

  for init in /opt/etc/init.d/S10cron /opt/etc/init.d/S10crond /etc/init.d/cron /etc/init.d/crond; do
    [ -x "$init" ] || continue
    "$init" restart >/dev/null 2>&1 || "$init" start >/dev/null 2>&1 || true
    return 0
  done

  if command -v service >/dev/null 2>&1; then
    service cron restart >/dev/null 2>&1 || service crond restart >/dev/null 2>&1 || true
  fi

  if command -v pidof >/dev/null 2>&1; then
    pid="$(pidof crond 2>/dev/null | awk '{print $1}')"
    if [ -n "$pid" ]; then
      kill -HUP "$pid" >/dev/null 2>&1 || true
      return 0
    fi
  fi

  if command -v crond >/dev/null 2>&1; then
    crond >/dev/null 2>&1 || true
  fi
}

backup_cron_get_json() {
  tab="$(cron_tab_path)"
  if [ -z "$tab" ]; then
    reply_ok '{"ok":false,"error":"cron-not-found"}'
    return
  fi

  if [ ! -f "$tab" ]; then
    reply_ok "$(printf '{"ok":true,"enabled":false,"path":"%s"}' "$(jesc "$tab")")"
    return
  fi

  line="$(grep -E 'zash-backup' "$tab" 2>/dev/null | tail -n 1 2>/dev/null)"
  if [ -n "$line" ]; then
    sched="$(printf '%s' "$line" | awk '{print $1" "$2" "$3" "$4" "$5}' 2>/dev/null)"
    reply_ok "$(printf '{"ok":true,"enabled":true,"schedule":"%s","line":"%s","path":"%s"}' "$(jesc "$sched")" "$(jesc "$line")" "$(jesc "$tab")")"
  else
    reply_ok "$(printf '{"ok":true,"enabled":false,"path":"%s"}' "$(jesc "$tab")")"
  fi
}

backup_cron_set_json() {
  tab="$(cron_tab_path)"
  if [ -z "$tab" ]; then
    reply_ok '{"ok":false,"error":"cron-not-found"}'
    return
  fi

  mkdir -p "$(dirname "$tab")" >/dev/null 2>&1 || true
  mkdir -p /opt/zash-agent/var >/dev/null 2>&1 || true

  enabled="$enabled_q"
  case "$enabled" in
    1|true|yes|on) enabled=1 ;;
    *) enabled=0 ;;
  esac

  sched="$schedule_q"
  sched="$(printf '%s' "$sched" | tr -d '\r\n')"
  [ -n "$sched" ] || sched="0 4 * * *"

  # Basic validation: 5 fields with safe chars.
  echo "$sched" | grep -qE '^[0-9A-Za-z*/,-]+[[:space:]]+[0-9A-Za-z*/,-]+[[:space:]]+[0-9A-Za-z*/,-]+[[:space:]]+[0-9A-Za-z*/,-]+[[:space:]]+[0-9A-Za-z*/,-]+$' || {
    reply_ok '{"ok":false,"error":"bad-schedule"}'
    return
  }

  line="$sched /opt/zash-agent/backup.sh >/opt/zash-agent/var/backup.cron.log 2>&1 # zash-backup"

  tmp="${tab}.tmp.$$"
  if [ -f "$tab" ]; then
    grep -v 'zash-backup' "$tab" > "$tmp" 2>/dev/null || true
  else
    : > "$tmp" 2>/dev/null || true
  fi

  if [ "$enabled" -eq 1 ]; then
    printf '%s\n' "$line" >> "$tmp" 2>/dev/null || true
  fi

  mv -f "$tmp" "$tab" 2>/dev/null || {
    rm -f "$tmp" 2>/dev/null || true
    reply_ok '{"ok":false,"error":"write-failed"}'
    return
  }

  cron_reload_best_effort >/dev/null 2>&1 || true

  if [ "$enabled" -eq 1 ]; then
    reply_ok "$(printf '{"ok":true,"enabled":true,"schedule":"%s","path":"%s"}' "$(jesc "$sched")" "$(jesc "$tab")")"
  else
    reply_ok "$(printf '{"ok":true,"enabled":false,"schedule":"%s","path":"%s"}' "$(jesc "$sched")" "$(jesc "$tab")")"
  fi
}

# Save a lightweight trace of requests (best effort).
agent_log

case "$cmd" in
  status|"") status ;;
  neighbors) neighbors ;;
  lan_hosts) lan_hosts_json ;;
  host_traffic_live) host_traffic_live_json ;;
  host_remote_targets)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    host_remote_targets_json
    ;;
  qos_status) qos_status ;;
  qos_set)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    set_host_qos "$ip" "$profile"
    ;;
  qos_remove)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    remove_host_qos "$ip"
    ;;
  ip2mac)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    ip2mac "$ip"
    ;;
  shape)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    [ -n "$up" ] || up="0"
    [ -n "$down" ] || down="$up"
    shape_ip "$ip" "$up" "$down"
    ;;
  unshape)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    unshape_ip "$ip"
    ;;
  rehydrate)
    rehydrate
    ;;
  logs)
    [ -n "$type" ] || type="mihomo"
    [ -n "$lines" ] || lines="200"
    if [ "$type" = "agent" ]; then
      tail_b64 agent "$lines"
    elif [ "$type" = "config" ]; then
      config_b64
    else
      tail_b64 mihomo "$lines"
    fi
    ;;
  logs_follow)
    [ -n "$type" ] || type="mihomo"
    [ -n "$lines" ] || lines="200"
    [ -n "$offset" ] || offset="0"
    # Fallback for older/partial agent installs: if tail_follow_b64 is missing, return full tail.
    type tail_follow_b64 >/dev/null 2>&1 || {
      if [ "$type" = "agent" ]; then
        tail_b64 agent "$lines"
      elif [ "$type" = "config" ]; then
        config_b64
      else
        tail_b64 mihomo "$lines"
      fi
      exit 0
    }
    if [ "$type" = "agent" ]; then
      tail_follow_b64 agent "$lines" "$offset"
    elif [ "$type" = "config" ]; then
      config_b64
    else
      tail_follow_b64 mihomo "$lines" "$offset"
    fi
    ;;
  blockmac)
    block_mac_ports "$mac" "$ports"
    ;;
  unblockmac)
    unblock_mac_ports "$mac"
    ;;
  blockip)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    block_ip "$ip"
    ;;
  unblockip)
    [ -n "$ip" ] || { reply_ok '{"ok":false,"error":"missing-ip"}'; exit 0; }
    unblock_ip "$ip"
    ;;
  mihomo_config)
    mihomo_config_json
    ;;
  mihomo_cfg_state)
    mihomo_cfg_state_json
    ;;
  mihomo_cfg_get)
    mihomo_cfg_get_json "$kind_q"
    ;;
  mihomo_cfg_put)
    mihomo_cfg_put_json "$kind_q"
    ;;
  mihomo_cfg_copy)
    mihomo_cfg_copy_json "$from_q" "$to_q"
    ;;
  mihomo_cfg_validate)
    mihomo_cfg_validate_json "$kind_q"
    ;;
  mihomo_cfg_apply)
    mihomo_cfg_apply_json
    ;;
  mihomo_cfg_set_baseline_from_active)
    mihomo_cfg_set_baseline_from_active_json
    ;;
  mihomo_cfg_restore_baseline)
    mihomo_cfg_restore_baseline_json
    ;;
  mihomo_cfg_history)
    mihomo_cfg_history_json
    ;;
  mihomo_cfg_get_rev)
    mihomo_cfg_get_rev_json "$rev_q"
    ;;
  mihomo_cfg_restore_rev)
    mihomo_cfg_restore_rev_json "$rev_q"
    ;;
  mihomo_providers)
    mihomo_providers_json
    ;;
  ssl_cache_refresh)
    ssl_cache_refresh_json
    ;;
  ssl_probe_batch)
    ssl_probe_batch_json
    ;;
  subscription)
    subscriptions_export_text "$format_q" "$providers_q" "$name_q"
    ;;
  geo_info)
    geo_info_json
    ;;
  geo_update)
    geo_update_json
    ;;
  rules_info)
    rules_info_json
    ;;
  users_db_get)
    users_db_get_json
    ;;
  users_db_put)
    users_db_put_json "$rev_q"
    ;;
  provider_traffic_get)
    provider_traffic_get_json
    ;;
  provider_traffic_put)
    provider_traffic_put_json "$rev_q"
    ;;
  firmware_check)
    firmware_check_json "$force_q"
    ;;
  traffic_live)
    traffic_live_json
    ;;
  backup_start)
    backup_start_json
    ;;
  backup_status)
    backup_status_json
    ;;
  backup_cloud_status)
    backup_cloud_status_json
    ;;
  backup_cloud_list)
    backup_cloud_list_json
    ;;
  backup_log)
    backup_log_json
    ;;
  backup_list)
    backup_list_json
    ;;
  backup_delete)
    backup_delete_json
    ;;
  backup_cloud_delete)
    backup_cloud_delete_json
    ;;
  backup_cloud_download)
    backup_cloud_download_json
    ;;
  restore_start)
    restore_start_json
    ;;
  restore_status)
    restore_status_json
    ;;
  restore_log)
    restore_log_json
    ;;
  backup_cron_get)
    backup_cron_get_json
    ;;
  backup_cron_set)
    backup_cron_set_json
    ;;
  *) reply_ok '{"ok":false,"error":"unknown-cmd"}' ;;
esac
EOF

chmod +x "$AGENT_DIR/www/cgi-bin/api.sh"

cat > "$AGENT_DIR/backup.sh" <<'EOF'
#!/bin/sh
# Simple router backup helper (Mihomo config + zash-agent state) with optional cloud upload via rclone.
set -e

ENV_FILE="/opt/zash-agent/agent.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

BACKUP_TMP_DIR="${BACKUP_TMP_DIR:-/opt/zash-agent/var/backups}"
BACKUP_STATUS_FILE="${BACKUP_STATUS_FILE:-/opt/zash-agent/var/backup.last.json}"
BACKUP_LOG_FILE="${BACKUP_LOG_FILE:-/opt/zash-agent/var/backup.last.log}"
BACKUP_STATE_DIR="${BACKUP_STATE_DIR:-/opt/zash-agent/var}"

RCLONE_CONFIG="${RCLONE_CONFIG:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_REMOTES="${RCLONE_REMOTES:-}"
RCLONE_PATH="${RCLONE_PATH:-NetcrazeBackups/zash-agent}"
RCLONE_KEEP_DAYS="${RCLONE_KEEP_DAYS:-30}"
REQUESTED_REMOTES="${1:-}"

normalize_rclone_path() {
  p="$1"
  p="$(printf '%s' "$p" | sed 's#^/*##; s#//*#/#g; s#/$##')"
  printf '%s' "$p"
}

rclone_configured_remotes() {
  src="$RCLONE_REMOTES"
  if [ -z "$src" ]; then
    src="$RCLONE_REMOTE"
  fi
  printf '%s' "$src" \
    | sed 's/[;,[:space:]]\+/\n/g' \
    | sed 's/:$//; s/^ *//; s/ *$//' \
    | awk 'NF && !seen[$0]++ {print $0}'
}

rclone_list_remotes() {
  if ! command -v rclone >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "$RCLONE_CONFIG" ]; then
    rclone listremotes --config "$RCLONE_CONFIG" 2>/dev/null || true
  else
    rclone listremotes 2>/dev/null || true
  fi
}

rclone_known_remotes() {
  cfg_path="$1"
  known="$(rclone_list_remotes)"
  if [ -n "$known" ]; then
    printf '%s\n' "$known"
    return 0
  fi
  [ -n "$cfg_path" ] || cfg_path="$RCLONE_CONFIG"
  if [ -n "$cfg_path" ] && [ -f "$cfg_path" ]; then
    awk '
      /^[[:space:]]*\[[^]]+\][[:space:]]*$/ {
        name=$0
        sub(/^[[:space:]]*\[/, "", name)
        sub(/\][[:space:]]*$/, "", name)
        if (name != "") print name ":"
      }
    ' "$cfg_path" | awk '!seen[$0]++'
  fi
}

rclone_known_remote_names() {
  cfg_path="$1"
  rclone_known_remotes "$cfg_path" | sed 's/:$//' | awk 'NF && !seen[$0]++ {print $0}'
}

rclone_remote_accessible() {
  remote="$1"
  test_path="$2"
  [ -n "$remote" ] || return 1
  if ! command -v rclone >/dev/null 2>&1; then
    return 1
  fi
  root_target="$remote:"
  if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$root_target" --max-depth 1 >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "$test_path" ]; then
    path_target="$remote:$test_path"
    if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$path_target" --max-depth 1 >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

rclone_resolved_remotes() {
  req_remote="$1"
  test_path="$2"
  cfg_path="$3"
  if [ -n "$req_remote" ]; then
    printf '%s\n' "$req_remote" | sed 's/:$//' | awk 'NF && !seen[$0]++ {print $0}'
    return 0
  fi

  configured="$(rclone_configured_remotes)"
  valid=""
  known="$(rclone_known_remotes "$cfg_path")"
  if [ -n "$configured" ]; then
    oldIFS="$IFS"
    IFS='
'
    for remote in $configured; do
      [ -n "$remote" ] || continue
      exists=false
      if printf '%s\n' "$known" | grep -Fxq "$remote:"; then
        exists=true
      elif rclone_remote_accessible "$remote" "$test_path"; then
        exists=true
      fi
      if [ "$exists" = true ]; then
        valid="$valid
$remote"
      fi
    done
    IFS="$oldIFS"
  fi

  if [ -n "$(printf '%s' "$valid" | awk 'NF{print $0; exit}')" ]; then
    printf '%s\n' "$valid" | awk 'NF && !seen[$0]++ {print $0}'
    return 0
  fi

  rclone_known_remote_names "$cfg_path"
}

RCLONE_PATH="$(normalize_rclone_path "$RCLONE_PATH")"

BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-${RCLONE_KEEP_DAYS:-30}}"

# Optional: include current UI build (dist.zip) into the backup.
# NOTE: BusyBox wget may not support https; prefer /opt/bin/wget.
UI_ZIP_URL="${UI_ZIP_URL:-}"

MIHOMO_CONFIG="${MIHOMO_CONFIG:-/opt/etc/mihomo/config.yaml}"

ts="$(date '+%Y%m%d-%H%M%S' 2>/dev/null || echo now)"
host="$(uname -n 2>/dev/null || echo router)"
started_at="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"

mkdir -p "$BACKUP_TMP_DIR" /opt/zash-agent/var >/dev/null 2>&1 || true

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g'
}

write_status() {
  printf '%s' "$1" > "$BACKUP_STATUS_FILE" 2>/dev/null || true
}

append_upload_result() {
  remote_name="$1"
  remote_ok="$2"
  remote_error="$3"
  item="$(printf '{\"remote\":\"%s\",\"ok\":%s' "$(json_escape "$remote_name")" "$remote_ok")"
  if [ -n "$remote_error" ]; then
    item="$item$(printf ' ,"error":"%s" ' "$(json_escape "$remote_error")")"
  fi
  item="$item}"
  if [ -n "$upload_results" ]; then
    upload_results="$upload_results,$item"
  else
    upload_results="$item"
  fi
  if [ "$remote_ok" = "true" ]; then
    upload_ok_count=$((upload_ok_count + 1))
  else
    upload_fail_count=$((upload_fail_count + 1))
  fi
}

# Mark as running
if [ -n "$REQUESTED_REMOTES" ]; then
  write_status "$(printf '{"ok":true,"running":true,"startedAt":"%s","requestedRemotes":"%s"}' "$(json_escape "$started_at")" "$(json_escape "$REQUESTED_REMOTES")")"
else
  write_status "$(printf '{"ok":true,"running":true,"startedAt":"%s"}' "$(json_escape "$started_at")")"
fi

success=0
uploaded=false
out=""
err=""
upload_results=""
upload_ok_count=0
upload_fail_count=0

finish() {
  code=$?
  trap - EXIT
  finished_at="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"
  if [ $code -ne 0 ] || [ $success -ne 1 ]; then
    e="${err:-exit $code}"
    write_status "$(printf '{"ok":true,"running":false,"startedAt":"%s","finishedAt":"%s","success":false,"error":"%s","uploadOkCount":%s,"uploadFailCount":%s,"uploadResults":[%s],"requestedRemotes":"%s"}' \
      "$(json_escape "$started_at")" "$(json_escape "$finished_at")" "$(json_escape "$e")" "$upload_ok_count" "$upload_fail_count" "$upload_results" "$(json_escape "$REQUESTED_REMOTES")")"
    exit $code
  fi

  write_status "$(printf '{"ok":true,"running":false,"startedAt":"%s","finishedAt":"%s","success":true,"file":"%s","uploaded":%s,"uploadOkCount":%s,"uploadFailCount":%s,"uploadResults":[%s],"requestedRemotes":"%s"}' \
    "$(json_escape "$started_at")" "$(json_escape "$finished_at")" "$(json_escape "$out")" "$uploaded" "$upload_ok_count" "$upload_fail_count" "$upload_results" "$(json_escape "$REQUESTED_REMOTES")")"
}
trap finish EXIT

list="$BACKUP_TMP_DIR/.backup.list.$$"
rm -f "$list" 2>/dev/null || true

add() {
  p="$1"
  [ -e "$p" ] && echo "$p" >> "$list"
}

# Mihomo
add "$MIHOMO_CONFIG"
add "/opt/etc/mihomo/GeoIP.dat"
add "/opt/etc/mihomo/GeoSite.dat"
add "/opt/etc/mihomo/ASN.mmdb"
add "/opt/etc/mihomo/rules"

# zash-agent
add "/opt/zash-agent/agent.env"
add "/opt/zash-agent/var/users-db.json"
add "/opt/zash-agent/var/users-db.meta.json"
add "/opt/zash-agent/var/users-db.revs"
add "/opt/zash-agent/var/shapers.db"
add "/opt/zash-agent/var/blocks.db"
add "/opt/zash-agent/var/agent.log"

# Optional UI dist.zip
if [ -n "$UI_ZIP_URL" ]; then
  ui="$BACKUP_TMP_DIR/ui-dist-${host}-${ts}.zip"
  rm -f "$ui" 2>/dev/null || true
  set +e
  if [ -x /opt/bin/wget ]; then
    /opt/bin/wget -qO "$ui" "$UI_ZIP_URL"
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$ui" "$UI_ZIP_URL"
  elif command -v curl >/dev/null 2>&1; then
    curl -fsSL "$UI_ZIP_URL" -o "$ui"
  fi
  rc=$?
  set -e
  if [ $rc -eq 0 ] && [ -s "$ui" ]; then
    add "$ui"
  else
    rm -f "$ui" 2>/dev/null || true
  fi
fi

out="$BACKUP_TMP_DIR/zash-backup-${host}-${ts}.tar.gz"

# BusyBox tar may not support -z; fall back to gzip pipeline.
if tar -czf "$out" -T "$list" >/dev/null 2>&1; then
  :
else
  tar -cf - -T "$list" 2>/dev/null | gzip -c > "$out"
fi

rm -f "$list" 2>/dev/null || true

echo "[backup] created: $out" | tee -a "$BACKUP_LOG_FILE" >/dev/null 2>&1 || true

# local retention (best-effort)
if echo "$BACKUP_KEEP_DAYS" | grep -qE '^[0-9]+$' && [ "$BACKUP_KEEP_DAYS" -gt 0 ]; then
  find "$BACKUP_TMP_DIR" -maxdepth 1 -type f \( -name "zash-backup-*.tar.gz" -o -name "ui-dist-*.zip" \) -mtime +"$BACKUP_KEEP_DAYS" -print -delete 2>/dev/null || true
fi

rems="$(rclone_resolved_remotes "$REQUESTED_REMOTES" "$RCLONE_PATH" "$RCLONE_CONFIG")"
if [ -n "$rems" ] && command -v rclone >/dev/null 2>&1; then
  configured_rems="$(rclone_configured_remotes)"
  if [ -z "$REQUESTED_REMOTES" ] && [ -n "$configured_rems" ]; then
    configured_first="$(printf '%s\n' "$configured_rems" | awk 'NF{print $0; exit}')"
    resolved_first="$(printf '%s\n' "$rems" | awk 'NF{print $0; exit}')"
    if [ -n "$resolved_first" ] && [ "$configured_first" != "$resolved_first" ] && ! printf '%s\n' "$configured_rems" | grep -Fxq "$resolved_first"; then
      resolved_csv="$(printf '%s\n' "$rems" | awk 'NF{if(out) out=out ","; out=out $0} END{printf "%s", out}')"
      echo "[backup] configured remotes are stale; falling back to remotes from rclone.conf: $resolved_csv" | tee -a "$BACKUP_LOG_FILE" >/dev/null 2>&1 || true
    fi
  fi
  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi
  upload_ok=0
  oldIFS="$IFS"
  IFS=$(printf '\n_'); IFS=${IFS%_}
  for remote in $rems; do
    [ -n "$remote" ] || continue
    dst="$remote:"
    [ -n "$RCLONE_PATH" ] && dst="$remote:$RCLONE_PATH"
    echo "[backup] uploading to: $dst" | tee -a "$BACKUP_LOG_FILE" >/dev/null 2>&1 || true
    copy_log="$BACKUP_STATE_DIR/rclone-upload-${remote}.log"
    rm -f "$copy_log" 2>/dev/null || true
    set +e
    # shellcheck disable=SC2086
    RCLONE_CONFIG="$RCLONE_CONFIG" rclone mkdir "$dst" >/dev/null 2>&1
    # shellcheck disable=SC2086
    RCLONE_CONFIG="$RCLONE_CONFIG" rclone copy "$out" "$dst" --transfers 1 --checkers 1 --retries 2 > "$copy_log" 2>&1
    rc=$?
    set -e
    if [ $rc -eq 0 ]; then
      upload_ok=1
      append_upload_result "$remote" true ""
      echo "[backup] uploaded to: $dst" | tee -a "$BACKUP_LOG_FILE" >/dev/null 2>&1 || true
      if echo "$RCLONE_KEEP_DAYS" | grep -qE '^[0-9]+$' && [ "$RCLONE_KEEP_DAYS" -gt 0 ]; then
        set +e
        # shellcheck disable=SC2086
        RCLONE_CONFIG="$RCLONE_CONFIG" rclone delete "$dst" --min-age "${RCLONE_KEEP_DAYS}d" --include "zash-backup-*.tar.gz" >/dev/null 2>&1
        set -e
      fi
    else
      upload_err="$(tail -n 2 "$copy_log" 2>/dev/null | tr '
' ' ' | sed 's/[[:space:]]\+/ /g; s/^ //; s/ $//')"
      [ -n "$upload_err" ] || upload_err='upload failed'
      append_upload_result "$remote" false "$upload_err"
      echo "[backup] upload failed: $dst" | tee -a "$BACKUP_LOG_FILE" >/dev/null 2>&1 || true
      [ -s "$copy_log" ] && tail -n 20 "$copy_log" >> "$BACKUP_LOG_FILE" 2>/dev/null || true
    fi
  done
  IFS="$oldIFS"
  [ $upload_ok -eq 1 ] && uploaded=true || uploaded=false
else
  if [ -n "$rems" ] && ! command -v rclone >/dev/null 2>&1; then
    oldIFS="$IFS"
    IFS=$(printf '\n_'); IFS=${IFS%_}
    for remote in $rems; do
      [ -n "$remote" ] || continue
      append_upload_result "$remote" false "rclone missing"
    done
    IFS="$oldIFS"
  fi
  echo "[backup] rclone is not configured; set RCLONE_REMOTES (or RCLONE_REMOTE) in $ENV_FILE to enable cloud upload" | tee -a "$BACKUP_LOG_FILE" >/dev/null 2>&1 || true
fi

success=1

EOF

chmod +x "$AGENT_DIR/backup.sh"


cat > "$AGENT_DIR/restore-cloud.sh" <<'EOF'
#!/bin/sh
# Download a backup from cloud (rclone) and restore from it.
# Usage: restore-cloud.sh [file|latest] [scope=all|mihomo|agent] [include_env=0|1]
set -e

ENV_FILE="/opt/zash-agent/agent.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

BACKUP_TMP_DIR="${BACKUP_TMP_DIR:-/opt/zash-agent/var/backups}"
RESTORE_STATUS_FILE="${RESTORE_STATUS_FILE:-/opt/zash-agent/var/restore.last.json}"
RCLONE_CONFIG="${RCLONE_CONFIG:-}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
RCLONE_REMOTES="${RCLONE_REMOTES:-}"
RCLONE_PATH="${RCLONE_PATH:-NetcrazeBackups/zash-agent}"

file_arg="${1:-latest}"
scope="${2:-all}"
include_env="${3:-0}"
remote_req="${4:-}"

normalize_rclone_path() {
  p="$1"
  p="$(printf '%s' "$p" | sed 's#^/*##; s#//*#/#g; s#/$##')"
  printf '%s' "$p"
}

rclone_configured_remotes() {
  src="$RCLONE_REMOTES"
  if [ -z "$src" ]; then
    src="$RCLONE_REMOTE"
  fi
  printf '%s' "$src" \
    | sed 's/[;,[:space:]]\+/\n/g' \
    | sed 's/:$//; s/^ *//; s/ *$//' \
    | awk 'NF && !seen[$0]++ {print $0}'
}

rclone_known_remotes() {
  if ! command -v rclone >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "$RCLONE_CONFIG" ]; then
    rclone listremotes --config "$RCLONE_CONFIG" 2>/dev/null || true
  else
    rclone listremotes 2>/dev/null || true
  fi
}

rclone_known_remote_names() {
  rclone_known_remotes | sed 's/:$//' | awk 'NF && !seen[$0]++ {print $0}'
}

rclone_remote_accessible() {
  remote="$1"
  test_path="$2"
  [ -n "$remote" ] || return 1
  if ! command -v rclone >/dev/null 2>&1; then
    return 1
  fi
  root_target="$remote:"
  if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$root_target" --max-depth 1 >/dev/null 2>&1; then
    return 0
  fi
  if [ -n "$test_path" ]; then
    path_target="$remote:$test_path"
    if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$path_target" --max-depth 1 >/dev/null 2>&1; then
      return 0
    fi
  fi
  return 1
}

rclone_resolved_remotes() {
  req_remote="$1"
  test_path="$2"
  if [ -n "$req_remote" ]; then
    printf '%s\n' "$req_remote" | sed 's/:$//' | awk 'NF && !seen[$0]++ {print $0}'
    return 0
  fi

  configured="$(rclone_configured_remotes)"
  valid=""
  known="$(rclone_known_remotes)"
  if [ -n "$configured" ]; then
    oldIFS="$IFS"
    IFS='
'
    for remote in $configured; do
      [ -n "$remote" ] || continue
      exists=false
      if printf '%s\n' "$known" | grep -Fxq "$remote:"; then
        exists=true
      elif rclone_remote_accessible "$remote" "$test_path"; then
        exists=true
      fi
      if [ "$exists" = true ]; then
        valid="$valid
$remote"
      fi
    done
    IFS="$oldIFS"
  fi

  if [ -n "$(printf '%s' "$valid" | awk 'NF{print $0; exit}')" ]; then
    printf '%s\n' "$valid" | awk 'NF && !seen[$0]++ {print $0}'
    return 0
  fi

  rclone_known_remote_names
}

rclone_find_file_remote() {
  name="$1"
  path="$2"
  req_remote="$3"
  [ -n "$name" ] || return 1
  rems="$(rclone_resolved_remotes "$req_remote" "$path")"
  [ -n "$rems" ] || return 1
  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi
  oldIFS="$IFS"
  IFS=$(printf '\n_'); IFS=${IFS%_}
  for remote in $rems; do
    [ -n "$remote" ] || continue
    src="$remote:$name"
    [ -n "$path" ] && src="$remote:$path/$name"
    # shellcheck disable=SC2086
    if RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsf "$src" --max-depth 1 >/dev/null 2>&1; then
      printf '%s' "$remote"
      IFS="$oldIFS"
      return 0
    fi
  done
  IFS="$oldIFS"
  return 1
}

rclone_latest_remote_name() {
  path="$1"
  req_remote="$2"
  rems="$(rclone_resolved_remotes "$req_remote" "$path")"
  [ -n "$rems" ] || return 1
  rcfg=""
  if [ -n "$RCLONE_CONFIG" ]; then
    rcfg="--config $RCLONE_CONFIG"
  fi
  best_remote=""
  best_name=""
  best_key=""
  oldIFS="$IFS"
  IFS=$(printf '\n_'); IFS=${IFS%_}
  for remote in $rems; do
    [ -n "$remote" ] || continue
    remote_dir="$remote:"
    [ -n "$path" ] && remote_dir="$remote:$path"
    # shellcheck disable=SC2086
    line="$(RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsl "$remote_dir" --include 'zash-backup-*.tar.gz' 2>/dev/null | sort -k2,3 | tail -n1)"
    [ -n "$line" ] || continue
    name="$(printf '%s' "$line" | awk '{print $4}')"
    key="$(printf '%s' "$line" | awk '{print $2" "$3}')"
    [ -n "$name" ] || continue
    if [ -z "$best_key" ] || [ "$key" \> "$best_key" ]; then
      best_key="$key"
      best_name="$name"
      best_remote="$remote"
    fi
  done
  IFS="$oldIFS"
  [ -n "$best_name" ] || return 1
  printf '%s\t%s' "$best_remote" "$best_name"
}

RCLONE_PATH="$(normalize_rclone_path "$RCLONE_PATH")"

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g'
}

write_status() {
  printf '%s' "$1" > "$RESTORE_STATUS_FILE" 2>/dev/null || true
}

write_running_status() {
  stage="$1"
  pct="$2"
  detail="$3"
  bytes_done="$4"
  bytes_total="$5"
  file_name="$6"
  printf '%s' "$pct" | grep -qE '^[0-9]+$' || pct=0
  printf '%s' "$bytes_done" | grep -qE '^[0-9]+$' || bytes_done=0
  printf '%s' "$bytes_total" | grep -qE '^[0-9]+$' || bytes_total=0
  write_status "$(printf '{"ok":true,"running":true,"startedAt":"%s","file":"%s","source":"cloud","stage":"%s","progressPct":%s,"bytesDone":%s,"bytesTotal":%s,"detail":"%s"}' \
    "$(json_escape "$started_at")" "$(json_escape "$file_name")" "$(json_escape "$stage")" "$pct" "$bytes_done" "$bytes_total" "$(json_escape "$detail")")"
}

file_size() {
  f="$1"
  [ -f "$f" ] || {
    echo 0
    return 0
  }
  stat -c %s "$f" 2>/dev/null || stat -f %z "$f" 2>/dev/null || wc -c < "$f" 2>/dev/null || echo 0
}

log() {
  echo "$@"
}

started_at="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"
used_file=""
success=0
err=""

finish() {
  code=$?
  trap - EXIT
  finished_at="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"
  if [ $code -ne 0 ] || [ $success -ne 1 ]; then
    e="${err:-exit $code}"
    write_status "$(printf '{"ok":true,"running":false,"startedAt":"%s","finishedAt":"%s","success":false,"file":"%s","source":"cloud","stage":"failed","error":"%s"}' \
      "$(json_escape "$started_at")" "$(json_escape "$finished_at")" "$(json_escape "$used_file")" "$(json_escape "$e")")"
    exit $code
  fi
}
trap finish EXIT

rems="$(rclone_resolved_remotes "" "$RCLONE_PATH")"
if [ -z "$rems" ] || ! command -v rclone >/dev/null 2>&1; then
  err="cloud-not-ready"
  log "[restore-cloud] ERROR: rclone/remote is not configured"
  exit 1
fi

rcfg=""
if [ -n "$RCLONE_CONFIG" ]; then
  rcfg="--config $RCLONE_CONFIG"
fi

write_running_status "resolve-cloud" 2 "Resolving cloud backup" 0 0 "$file_arg"

selected_remote=""
remote_name=""
if [ -z "$file_arg" ] || [ "$file_arg" = "latest" ]; then
  if [ -n "$remote_req" ]; then
    remote_dir="$remote_req:"
    [ -n "$RCLONE_PATH" ] && remote_dir="$remote_req:$RCLONE_PATH"
    # shellcheck disable=SC2086
    remote_name="$(RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsl "$remote_dir" --include 'zash-backup-*.tar.gz' 2>/dev/null | sort -k2,3 | tail -n1 | awk '{print $4}')"
    selected_remote="$remote_req"
  else
    best_line="$(rclone_latest_remote_name "$RCLONE_PATH" "")"
    selected_remote="$(printf '%s' "$best_line" | awk -F '	' '{print $1}')"
    remote_name="$(printf '%s' "$best_line" | awk -F '	' '{print $2}')"
  fi
else
  remote_name="$(basename "$file_arg")"
  if [ -n "$remote_req" ]; then
    selected_remote="$remote_req"
  else
    selected_remote="$(rclone_find_file_remote "$remote_name" "$RCLONE_PATH" "")"
  fi
fi

if [ -z "$remote_name" ] || [ -z "$selected_remote" ]; then
  err="cloud-backup-not-found"
  log "[restore-cloud] ERROR: backup file not found in cloud (arg='$file_arg', remote='$remote_req')"
  exit 1
fi

used_file="$remote_name"
remote_file="$selected_remote:$remote_name"
[ -n "$RCLONE_PATH" ] && remote_file="$selected_remote:$RCLONE_PATH/$remote_name"
mkdir -p "$BACKUP_TMP_DIR" >/dev/null 2>&1 || true
local_file="$BACKUP_TMP_DIR/$remote_name"
tmp_file="$local_file.part.$$"
rm -f "$tmp_file" >/dev/null 2>&1 || true

remote_size=0
# shellcheck disable=SC2086
remote_size="$(RCLONE_CONFIG="$RCLONE_CONFIG" rclone lsl "$remote_file" 2>/dev/null | awk 'NR==1{print $1}' | tr -d '\r')"
printf '%s' "$remote_size" | grep -qE '^[0-9]+$' || remote_size=0

log "[restore-cloud] remote: $remote_file"
log "[restore-cloud] selected remote: $selected_remote"
log "[restore-cloud] local:  $local_file"
write_running_status "downloading" 5 "Downloading from cloud" 0 "$remote_size" "$remote_name"

copy_log="/opt/zash-agent/var/restore-cloud.copy.log"
: > "$copy_log" 2>/dev/null || true
# shellcheck disable=SC2086
RCLONE_CONFIG="$RCLONE_CONFIG" rclone copyto "$remote_file" "$tmp_file" --transfers 1 --checkers 1 --retries 2 > "$copy_log" 2>&1 &
copy_pid=$!

while kill -0 "$copy_pid" 2>/dev/null; do
  done_bytes="$(file_size "$tmp_file")"
  pct=5
  if [ "$remote_size" -gt 0 ]; then
    pct=$(( done_bytes * 100 / remote_size ))
    [ "$pct" -lt 5 ] && pct=5
    [ "$pct" -gt 95 ] && pct=95
  fi
  write_running_status "downloading" "$pct" "Downloading from cloud" "$done_bytes" "$remote_size" "$remote_name"
  sleep 1
done

if ! wait "$copy_pid"; then
  err="cloud-download-failed"
  tail_line="$(tail -n 1 "$copy_log" 2>/dev/null || true)"
  [ -n "$tail_line" ] && err="$err: $tail_line"
  log "[restore-cloud] ERROR: download failed"
  exit 1
fi

mv -f "$tmp_file" "$local_file"
done_bytes="$(file_size "$local_file")"
log "[restore-cloud] downloaded: $local_file"
write_running_status "downloaded" 100 "Archive downloaded" "$done_bytes" "$remote_size" "$remote_name"

success=1
trap - EXIT
exec /opt/zash-agent/restore.sh "$remote_name" "$scope" "$include_env" "cloud"

EOF

chmod +x "$AGENT_DIR/restore-cloud.sh"

cat > "$AGENT_DIR/restore.sh" <<'EOF'
#!/bin/sh
# Restore from a zash-backup-*.tar.gz archive created by /opt/zash-agent/backup.sh
# Usage: restore.sh [file|latest] [scope=all|mihomo|agent] [include_env=0|1] [source=local|cloud]
set -e

ENV_FILE="/opt/zash-agent/agent.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

BACKUP_TMP_DIR="${BACKUP_TMP_DIR:-/opt/zash-agent/var/backups}"
RESTORE_STATUS_FILE="${RESTORE_STATUS_FILE:-/opt/zash-agent/var/restore.last.json}"
RESTORE_LOG_FILE="${RESTORE_LOG_FILE:-/opt/zash-agent/var/restore.last.log}"

MIHOMO_CONFIG="${MIHOMO_CONFIG:-/opt/etc/mihomo/config.yaml}"

file_arg="${1:-}"
scope="${2:-all}"
include_env="${3:-0}"
source="${4:-local}"

ts="$(date '+%Y%m%d-%H%M%S' 2>/dev/null || echo now)"
host="$(uname -n 2>/dev/null || echo router)"
started_at="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"

mkdir -p "$BACKUP_TMP_DIR" /opt/zash-agent/var >/dev/null 2>&1 || true

json_escape() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g; s/\r//g'
}

write_status() {
  printf '%s' "$1" > "$RESTORE_STATUS_FILE" 2>/dev/null || true
}

write_running_status() {
  stage="$1"
  pct="$2"
  detail="$3"
  printf '%s' "$pct" | grep -qE '^[0-9]+$' || pct=0
  write_status "$(printf '{"ok":true,"running":true,"startedAt":"%s","file":"%s","scope":"%s","source":"%s","includeEnv":%s,"stage":"%s","progressPct":%s,"detail":"%s"}' \
    "$(json_escape "$started_at")" "$(json_escape "$used_file")" "$(json_escape "$scope")" "$(json_escape "$source")" "$include_env" "$(json_escape "$stage")" "$pct" "$(json_escape "$detail")")"
}

log() {
  echo "$@" | tee -a "$RESTORE_LOG_FILE" >/dev/null 2>&1 || true
}

success=0
used_file=""
err=""

finish() {
  code=$?
  trap - EXIT
  finished_at="$(date -Iseconds 2>/dev/null || date '+%Y-%m-%d %H:%M:%S' 2>/dev/null || echo now)"
  if [ $code -ne 0 ] || [ $success -ne 1 ]; then
    e="${err:-exit $code}"
    write_status "$(printf '{"ok":true,"running":false,"startedAt":"%s","finishedAt":"%s","success":false,"file":"%s","scope":"%s","source":"%s","includeEnv":%s,"stage":"failed","progressPct":100,"error":"%s"}' \
      "$(json_escape "$started_at")" "$(json_escape "$finished_at")" "$(json_escape "$used_file")" "$(json_escape "$scope")" "$(json_escape "$source")" "$include_env" "$(json_escape "$e")")"
    exit $code
  fi
  write_status "$(printf '{"ok":true,"running":false,"startedAt":"%s","finishedAt":"%s","success":true,"file":"%s","scope":"%s","source":"%s","includeEnv":%s,"stage":"done","progressPct":100}' \
    "$(json_escape "$started_at")" "$(json_escape "$finished_at")" "$(json_escape "$used_file")" "$(json_escape "$scope")" "$(json_escape "$source")" "$include_env")"
}
trap finish EXIT

pick_latest() {
  ls -1t "$BACKUP_TMP_DIR"/zash-backup-*.tar.gz 2>/dev/null | head -n 1
}

# Decide archive file
if [ -z "$file_arg" ] || [ "$file_arg" = "latest" ]; then
  archive="$(pick_latest || true)"
else
  # sanitize: only basename inside BACKUP_TMP_DIR
  bn="$(basename "$file_arg")"
  archive="$BACKUP_TMP_DIR/$bn"
fi

if [ -z "$archive" ] || [ ! -f "$archive" ]; then
  err="backup-not-found"
  log "[restore] ERROR: backup file not found (arg='$file_arg')"
  exit 1
fi

used_file="$archive"
log "[restore] using backup: $archive"
log "[restore] scope=$scope include_env=$include_env source=$source"
write_running_status "preparing" 96 "Preparing restore"

tmp="/opt/zash-agent/var/restore.tmp.$$"
rm -rf "$tmp" >/dev/null 2>&1 || true
mkdir -p "$tmp" >/dev/null 2>&1 || true

# Extract (best effort)
if tar -xzf "$archive" -C "$tmp" >/dev/null 2>&1; then
  :
else
  gzip -dc "$archive" 2>/dev/null | tar -xf - -C "$tmp" 2>/dev/null
fi

# Determine extracted root
root="$tmp"
[ -d "$root/opt" ] || [ -d "$root/opt" ] || true

src_of() {
  dest="$1"           # absolute like /opt/...
  rel="${dest#/}"     # opt/...
  echo "$root/$rel"
}

ensure_parent() {
  d="$(dirname "$1")"
  mkdir -p "$d" >/dev/null 2>&1 || true
}

restore_file() {
  src="$1"
  dst="$2"
  if [ -f "$src" ]; then
    ensure_parent "$dst"
    cp -af "$src" "$dst" >/dev/null 2>&1 || cp -f "$src" "$dst"
    log "[restore] file: $dst"
  else
    log "[restore] skip (missing in backup): $dst"
  fi
}

restore_dir_replace() {
  src="$1"
  dst="$2"
  if [ -d "$src" ]; then
    rm -rf "$dst" >/dev/null 2>&1 || true
    ensure_parent "$dst"
    cp -a "$src" "$dst" >/dev/null 2>&1 || cp -r "$src" "$dst"
    log "[restore] dir:  $dst"
  else
    log "[restore] skip (missing in backup): $dst"
  fi
}

# Safety snapshot before overwriting (best effort)
pre="/opt/zash-agent/var/restore.pre-${host}-${ts}.tar.gz"
list="$tmp/.pre.list.$$"
rm -f "$list" >/dev/null 2>&1 || true

add_pre() { [ -e "$1" ] && echo "$1" >> "$list"; }

# Build list according to scope
want_mihomo=0
want_agent=0

case "$scope" in
  mihomo) want_mihomo=1 ;;
  agent) want_agent=1 ;;
  all|*) want_mihomo=1; want_agent=1 ;;
esac

if [ $want_mihomo -eq 1 ]; then
  add_pre "$MIHOMO_CONFIG"
  add_pre "/opt/etc/mihomo/GeoIP.dat"
  add_pre "/opt/etc/mihomo/GeoSite.dat"
  add_pre "/opt/etc/mihomo/ASN.mmdb"
  add_pre "/opt/etc/mihomo/rules"
fi

if [ $want_agent -eq 1 ]; then
  add_pre "/opt/zash-agent/var/users-db.json"
  add_pre "/opt/zash-agent/var/users-db.meta.json"
  add_pre "/opt/zash-agent/var/users-db.revs"
  add_pre "/opt/zash-agent/var/shapers.db"
  add_pre "/opt/zash-agent/var/blocks.db"
  if [ "$include_env" = "1" ]; then
    add_pre "/opt/zash-agent/agent.env"
  fi
fi

if [ -s "$list" ]; then
  if tar -czf "$pre" -T "$list" >/dev/null 2>&1; then
    log "[restore] pre-snapshot: $pre"
  else
    tar -cf - -T "$list" 2>/dev/null | gzip -c > "$pre" || true
    [ -s "$pre" ] && log "[restore] pre-snapshot: $pre"
  fi
fi
rm -f "$list" >/dev/null 2>&1 || true

# Apply restore
write_running_status "restoring" 98 "Applying files"
if [ $want_mihomo -eq 1 ]; then
  restore_file "$(src_of "$MIHOMO_CONFIG")" "$MIHOMO_CONFIG"
  restore_file "$(src_of "/opt/etc/mihomo/GeoIP.dat")" "/opt/etc/mihomo/GeoIP.dat"
  restore_file "$(src_of "/opt/etc/mihomo/GeoSite.dat")" "/opt/etc/mihomo/GeoSite.dat"
  restore_file "$(src_of "/opt/etc/mihomo/ASN.mmdb")" "/opt/etc/mihomo/ASN.mmdb"
  restore_dir_replace "$(src_of "/opt/etc/mihomo/rules")" "/opt/etc/mihomo/rules"
  log "[restore] NOTE: restart Mihomo manually if needed."
fi

if [ $want_agent -eq 1 ]; then
  restore_file "$(src_of "/opt/zash-agent/var/users-db.json")" "/opt/zash-agent/var/users-db.json"
  restore_file "$(src_of "/opt/zash-agent/var/users-db.meta.json")" "/opt/zash-agent/var/users-db.meta.json"
  restore_dir_replace "$(src_of "/opt/zash-agent/var/users-db.revs")" "/opt/zash-agent/var/users-db.revs"
  restore_file "$(src_of "/opt/zash-agent/var/shapers.db")" "/opt/zash-agent/var/shapers.db"
  restore_file "$(src_of "/opt/zash-agent/var/blocks.db")" "/opt/zash-agent/var/blocks.db"
  if [ "$include_env" = "1" ]; then
    restore_file "$(src_of "/opt/zash-agent/agent.env")" "/opt/zash-agent/agent.env"
  fi
  log "[restore] NOTE: restart zash-agent manually if needed."
fi

rm -rf "$tmp" >/dev/null 2>&1 || true
success=1
log "[restore] done"

EOF

chmod +x "$AGENT_DIR/restore.sh"

cat > "$AGENT_DIR/ssl-refresh.sh" <<'EOF'
#!/bin/sh
set -eu

ENV_FILE="/opt/zash-agent/agent.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

PORT="${PORT:-9099}"
BIND_IP="${BIND_IP:-127.0.0.1}"
HOST="$BIND_IP"
[ "$HOST" = "0.0.0.0" ] && HOST="127.0.0.1"

WGET_BIN="$(command -v wget 2>/dev/null || true)"
[ -n "$WGET_BIN" ] || WGET_BIN="/opt/bin/wget"
URL="http://$HOST:$PORT/cgi-bin/api.sh?cmd=ssl_cache_refresh&keep=1&cron=1"

"$WGET_BIN" -qO- "$URL" >/dev/null 2>&1 \
  || busybox wget -qO- "$URL" >/dev/null 2>&1 \
  || true
EOF

chmod +x "$AGENT_DIR/ssl-refresh.sh"

cat > "$AGENT_DIR/start.sh" <<'EOF'
#!/bin/sh
set -e

ENV_FILE="/opt/zash-agent/agent.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"

PORT="${PORT:-9099}"
BIND_IP="${BIND_IP:-0.0.0.0}"
LAN_IF="${LAN_IF:-br0}"

PID_FILE="/opt/zash-agent/var/httpd.pid"

if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
  echo "[zash-agent] already running (pid $(cat "$PID_FILE"))"
  exit 0
fi

echo "[zash-agent] starting uhttpd on $BIND_IP:$PORT"

# Allow LAN access to agent port (best effort)
if command -v iptables >/dev/null 2>&1; then
  iptables -C INPUT -i "$LAN_IF" -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null ||     iptables -I INPUT 1 -i "$LAN_IF" -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
fi


UHTTPD_BIN="$(command -v uhttpd 2>/dev/null || true)"
[ -n "$UHTTPD_BIN" ] || UHTTPD_BIN="/opt/sbin/uhttpd"

LOG_DIR="/opt/var/log/zash-agent"
LOG_FILE="$LOG_DIR/uhttpd.log"
mkdir -p "$LOG_DIR" || true
# Prevent huge log growth (keep last ~2000 lines if >1 MiB)
if [ -f "$LOG_FILE" ] && [ "$(wc -c < "$LOG_FILE" 2>/dev/null || echo 0)" -gt 1048576 ]; then
  tail -n 2000 "$LOG_FILE" > "$LOG_FILE.tmp" 2>/dev/null && mv "$LOG_FILE.tmp" "$LOG_FILE" || true
fi

"$UHTTPD_BIN" -f -p "$BIND_IP:$PORT" -h /opt/zash-agent/www -x /cgi-bin -t 15 -T 15 >>"$LOG_FILE" 2>&1 </dev/null &
echo $! > "$PID_FILE"

# Re-apply saved shaping rules
HOST="$BIND_IP"
[ "$HOST" = "0.0.0.0" ] && HOST="127.0.0.1"
sleep 1
(
  wget -T 5 -qO- "http://$HOST:$PORT/cgi-bin/api.sh?cmd=rehydrate" >/dev/null 2>&1 ||   busybox wget -T 5 -qO- "http://$HOST:$PORT/cgi-bin/api.sh?cmd=rehydrate" >/dev/null 2>&1 ||   true
) &

EOF

chmod +x "$AGENT_DIR/start.sh"

mkdir -p /opt/etc/init.d
cat > /opt/etc/init.d/S99zash-agent <<'EOF'
#!/bin/sh

case "$1" in
  start)
    /opt/zash-agent/start.sh
    ;;
  stop)
    PID_FILE="/opt/zash-agent/var/httpd.pid"
    if [ -f "$PID_FILE" ]; then
      pid="$(cat "$PID_FILE")"
      kill "$pid" 2>/dev/null || true
      rm -f "$PID_FILE"
    fi
    killall uhttpd 2>/dev/null || true
    ps w | grep '/opt/zash-agent/www/cgi-bin/api.sh' | grep -v grep | awk '{print $1}' | while read p; do
      kill "$p" 2>/dev/null || true
    done
    # Remove firewall allow rule (best effort)
    ENV_FILE="/opt/zash-agent/agent.env"
    [ -f "$ENV_FILE" ] && . "$ENV_FILE"
    PORT="${PORT:-9099}"
    LAN_IF="${LAN_IF:-br0}"
    if command -v iptables >/dev/null 2>&1; then
      iptables -D INPUT -i "$LAN_IF" -p tcp --dport "$PORT" -j ACCEPT 2>/dev/null || true
    fi
    ;;
  restart)
    "$0" stop
    "$0" start
    ;;
  *)
    echo "Usage: $0 {start|stop|restart}"
    exit 1
    ;;
esac

EOF

chmod +x /opt/etc/init.d/S99zash-agent

# Install/refresh background SSL cache cron (every 6 hours by default).
SSL_CRON_SCHEDULE="17 */6 * * *"
if [ -f "$AGENT_DIR/agent.env" ]; then
  custom_ssl_secs="$(sed -n 's/^SSL_CACHE_AUTO_REFRESH_SECS="\([0-9][0-9]*\)"$/\1/p' "$AGENT_DIR/agent.env" | head -n1)"
  if [ -n "$custom_ssl_secs" ] && echo "$custom_ssl_secs" | grep -qE '^[0-9]+$' && [ "$custom_ssl_secs" -gt 0 ]; then
    if [ $((custom_ssl_secs % 3600)) -eq 0 ]; then
      every_hours=$((custom_ssl_secs / 3600))
      [ "$every_hours" -lt 1 ] && every_hours=1
      [ "$every_hours" -gt 24 ] && every_hours=24
      SSL_CRON_SCHEDULE="17 */${every_hours} * * *"
    fi
  fi
fi
cron_tab=""
for f in /opt/etc/crontabs/root /opt/var/spool/cron/crontabs/root /etc/crontabs/root /var/spool/cron/crontabs/root; do
  d="$(dirname "$f")"
  if [ -d "$d" ] || [ -f "$f" ]; then
    cron_tab="$f"
    break
  fi
done
if [ -n "$cron_tab" ]; then
  mkdir -p "$(dirname "$cron_tab")" >/dev/null 2>&1 || true
  touch "$cron_tab" >/dev/null 2>&1 || true
  tmp_cron="${cron_tab}.tmp.$$"
  grep -v 'zash-ssl-cache-refresh' "$cron_tab" 2>/dev/null > "$tmp_cron" || true
  printf '%s %s >/dev/null 2>&1 # zash-ssl-cache-refresh\n' "$SSL_CRON_SCHEDULE" "$AGENT_DIR/ssl-refresh.sh" >> "$tmp_cron"
  mv "$tmp_cron" "$cron_tab"
  if command -v crontab >/dev/null 2>&1; then
    crontab "$cron_tab" >/dev/null 2>&1 || true
  fi
  for init in /opt/etc/init.d/S10cron /opt/etc/init.d/S10crond /etc/init.d/cron /etc/init.d/crond; do
    [ -x "$init" ] || continue
    "$init" restart >/dev/null 2>&1 || "$init" start >/dev/null 2>&1 || true
    break
  done
fi

echo "[zash-agent] installing: done"

"$AGENT_DIR/start.sh"

echo "[zash-agent] test: curl http://$BIND_IP:$PORT/cgi-bin/api.sh?cmd=status"
