Prepared release: v0.6.67. The active contour stays on `ubuntu-service`; this hotfix hardens Mihomo controller resolution so stale `MIHOMO_CONTROLLER_URL=http://127.0.0.1:9090` no longer overrides the live `external-controller` from `/etc/mihomo/config.yaml`.
Актуальный релиз для переноса: **v0.6.67**

## Update v0.6.67
- backend bridge now builds controller candidates from both `agent.env` and `/etc/mihomo/config.yaml`, preferring the live config address when env still contains an old loopback controller.
- proxy HTTP requests retry across controller candidates before returning `502`, and the error payload now includes every attempted URL/error pair.
- `backend/scripts/install.sh` now parses `MIHOMO_ACTIVE_CONFIG` from env files correctly before reading Mihomo YAML values.

## Quick verification

```bash
clear
grep -E '^(MIHOMO_ACTIVE_CONFIG|MIHOMO_CONTROLLER_URL|MIHOMO_CONTROLLER_SECRET)=' /etc/ultra-ui-ubuntu/agent.env || true
echo
curl -s http://127.0.0.1:18090/api/providers/proxies | head -c 800
echo
```
