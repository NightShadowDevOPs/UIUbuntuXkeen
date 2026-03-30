# router-agent (helper for UltraUIXkeen)

This is an **optional** helper agent that runs on the router and enables "adult" features that are not available via Mihomo API:

- Per-client **bandwidth shaping** (Mbps) via `tc` (recommended)
- Per-host **QoS priority** (High / Normal / Low) via `tc` HTB class priority + guaranteed minimum share
- Fallback policing via `iptables` (optional)

Дашборд **UltraUIXkeen** может вызывать этот агент для применения/удаления shaping‑правил по IP.

## Install (Entware)

On the router:

```sh
opkg update
opkg install tc ip-full

sh /opt/zash-agent/install.sh
```

Инсталлятор поднимает простой HTTP сервер на **9099** (LAN / br0).

## UI config

В UI: Router → **Router agent**:

- Enable agent
- Agent URL: `http://<router_lan_ip>:9099`
- Enable "Enforce bandwidth"

## Endpoints

- `GET /cgi-bin/api.sh?cmd=status`
- `GET /cgi-bin/api.sh?cmd=ip2mac&ip=192.168.1.2`
- `GET /cgi-bin/api.sh?cmd=shape&ip=192.168.1.2&up=10&down=30`
- `GET /cgi-bin/api.sh?cmd=unshape&ip=192.168.1.2`
- `GET /cgi-bin/api.sh?cmd=neighbors`
- `GET /cgi-bin/api.sh?cmd=qos_status`
- `GET /cgi-bin/api.sh?cmd=qos_set&ip=192.168.1.2&profile=high|normal|low`
- `GET /cgi-bin/api.sh?cmd=qos_remove&ip=192.168.1.2`
- `GET /cgi-bin/api.sh?cmd=backup_start`
- `GET /cgi-bin/api.sh?cmd=backup_status`
- `GET /cgi-bin/api.sh?cmd=backup_cloud_status`
- `GET /cgi-bin/api.sh?cmd=backup_cloud_list`
- `GET /cgi-bin/api.sh?cmd=backup_log`
- `GET /cgi-bin/api.sh?cmd=backup_list`
- `GET /cgi-bin/api.sh?cmd=backup_cron_get`
- `GET /cgi-bin/api.sh?cmd=backup_cron_set&enabled=1&schedule=0%204%20*%20*%20*`
- `GET /cgi-bin/api.sh?cmd=restore_start&file=latest&scope=all&env=0&source=local|cloud`
- `GET /cgi-bin/api.sh?cmd=restore_status`
- `GET /cgi-bin/api.sh?cmd=restore_log`
- `GET /cgi-bin/api.sh?cmd=subscription&format=mihomo`
- `GET /cgi-bin/api.sh?cmd=subscription&format=b64`
- `GET /cgi-bin/api.sh?cmd=subscription&format=plain`
- `GET /cgi-bin/api.sh?cmd=subscription&format=json` *(preview groundwork for future HTTPS / Xray-style flows)*

`format=mihomo` now emits an explicit top-level `proxy-groups:` section, so generated YAML keeps `Manual / Auto / Failover / Balance` in the correct Clash/Mihomo structure.

Host QoS priority is best-effort: it helps under congestion, but if the same IP also has a hard shaping rule (`cmd=shape`), the hard shaping rule wins.

Если в `/opt/zash-agent/agent.env` задан `TOKEN=...`, UI будет слать `Authorization: Bearer <token>`.

### status payload

In addition to capability flags (tc/iptables/hashlimit), `status` also reports basic system metrics (best-effort):

- `cpuPct` (0..100)
- `load1` (1-minute load average)
- `uptimeSec`
- `memUsedPct` (0..100)
- `memUsed`, `memTotal` (bytes)

## Backups (Google Drive / Yandex Disk)

Подробная инструкция: `../docs/backup.md`.

The installer also creates `/opt/zash-agent/backup.sh` — it archives Mihomo config + zash-agent state (including `users-db.json`) and can optionally upload it to a cloud drive via **rclone**.

### 1) Install & configure rclone (Entware)

```sh
opkg update
opkg install rclone
rclone config
```

**Yandex Disk**: easiest is WebDAV (`type = webdav`, URL `https://webdav.yandex.ru`, user = Yandex login, pass = app password).

### 2) Enable upload in agent.env

Edit `/opt/zash-agent/agent.env` and set:

```sh
# optional, to include UI dist.zip in the archive
UI_ZIP_URL="https://github.com/NightShadowDevOPs/UltraUIXkeen/releases/download/rolling/dist.zip"

# local retention (days)
BACKUP_KEEP_DAYS="30"

# cloud upload via rclone
RCLONE_CONFIG="/opt/etc/rclone.config"   # shared rclone config
RCLONE_REMOTE="gdrive"     # legacy single remote
RCLONE_REMOTES="gdrive-crypt,yandex-crypt"   # preferred: upload to both if available
RCLONE_PATH="NetcrazeBackups/zash-agent"
RCLONE_KEEP_DAYS="30"      # remote retention (best-effort)
```

### 3) Run once

```sh
/opt/zash-agent/backup.sh
```

### 4) Schedule (cron)

В UI (Router → Router agent → **Backup schedule**) можно задать время (по умолчанию **04:00**) и нажать **Apply** — UI установит cron-строку на роутере (помечается комментарием `# zash-backup`).

Если хочешь вручную:

```sh
crontab -e
```

Example: daily at 04:00

```cron
0 4 * * * /opt/zash-agent/backup.sh >/opt/zash-agent/var/backup.cron.log 2>&1 # zash-backup
```


## Restore

Restore works with local archives from `/opt/zash-agent/var/backups` (created by `backup.sh`).

- `file=latest` (default) or a specific filename from `backup_list`
- `scope=all|mihomo|agent`
- `env=1` to also restore `/opt/zash-agent/agent.env` (disabled by default)

**Note:** after restoring Mihomo config, you may need to restart Mihomo; after restoring agent settings/state — restart `zash-agent`.


В UI карточка **Router agent** показывает и локальные, и облачные архивы. Облачный список строится через `rclone lsjson` для всех remotes из `RCLONE_REMOTES` (или для `RCLONE_REMOTE`, если список не задан).


The installer also creates `/opt/zash-agent/restore-cloud.sh` — it downloads the selected archive from `RCLONE_REMOTE:RCLONE_PATH` and then starts the usual restore flow.
If `RCLONE_REMOTE` / `RCLONE_REMOTES` still contain stale remote names, the agent now falls back to actual remotes discovered in `rclone.conf` — not only for cloud history and restore, but also for new uploads triggered by `backup.sh` / cron.



## Host QoS priority (groundwork)

The router page can now apply per-host QoS priority profiles:

- `high`
- `normal`
- `low`

Under the hood the agent uses `tc` HTB classes with:

- different class `prio` values;
- a guaranteed minimum share derived from `WAN_RATE` / `LAN_RATE`;
- full `ceil` at the line rate, so this is priority, not a hard per-host cap.

Optional tuning in `/opt/zash-agent/agent.env`:

```sh
QOS_HIGH_PCT="25"
QOS_NORMAL_PCT="10"
QOS_LOW_PCT="3"
QOS_HIGH_PRIO="0"
QOS_NORMAL_PRIO="3"
QOS_LOW_PRIO="6"
```

Nothing must be changed manually for the default profiles to work. If the same IP also has a hard shaping rule (`cmd=shape`), that shaping rule intentionally wins over QoS priority.

## HTTPS publication for subscriptions

`cmd=subscription` works locally over HTTP and that is enough for a normal router-only LAN setup. Publish it behind a normal HTTPS reverse proxy only when you really need external/public client access or want to test future V2RayTun/Xray flows over HTTPS.

Recommended public pattern:

```text
https://sub.example.com/cgi-bin/api.sh?cmd=subscription&format=b64
```

What to preserve in the proxy:
- the `/cgi-bin/api.sh` path;
- the original query string;
- `X-Forwarded-Proto`, `X-Forwarded-Host` and optionally `X-Forwarded-Prefix`.

Then `format=json` can include canonical public URLs in its response.

For live V2RayTun LAN testing the agent also keeps `format=v2raytun`. Current builds send `profile-title`, `profile-update-interval` and `update-always` both as normal HTTP headers and as `#`-prefixed body headers before the merged share-link list, because V2RayTun documents support for body headers too. Treat this as an experimental local import flow, not as a final published-subscription claim.

### Caddy example

```caddy
sub.example.com {
  reverse_proxy 192.168.0.1:9099 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
    header_up X-Forwarded-Prefix ""
  }
}
```

### Nginx example

```nginx
server {
    listen 443 ssl http2;
    server_name sub.example.com;

    location /cgi-bin/api.sh {
        proxy_pass http://192.168.0.1:9099/cgi-bin/api.sh;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Prefix "";
    }
}
```


## Host QoS profiles

Router-agent now supports six host QoS profiles via `qos_set`: `critical`, `high`, `elevated`, `normal`, `low`, `background`.

Optional `agent.env` overrides:

```bash
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
```
