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
