# v0.6.68 — Mihomo bridge startup-race retry

## What changed
- Added short retry/backoff for transient `Connection refused` and timeout errors in `backend/app/mihomo_bridge.py`.
- The retry targets the same resolved controller candidates from v0.6.67.
- Failure payload keeps all attempts so the UI/logs show whether the bridge raced Mihomo startup.

## Why
On the target Ubuntu host, direct probes to `http://192.168.5.23:9090/providers/proxies` succeeded, but requests that landed immediately after `systemctl restart mihomo` could still catch a short connect-refused window and surface as false 502 in the UI.
