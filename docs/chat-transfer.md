Prepared release: v0.6.66. The active contour stays on `ubuntu-service`; this hotfix pins the real Mihomo controller URL into backend env during install/update and turns upstream controller failures into structured `502` JSON instead of ASGI tracebacks.
Актуальный релиз для переноса: **v0.6.66**

## Update v0.6.66
- `backend/scripts/install.sh` now reads `external-controller` from `/etc/mihomo/config.yaml` and writes `MIHOMO_CONTROLLER_URL` to `/etc/ultra-ui-ubuntu/agent.env`.
- ubuntu-service proxy routes stop falling back to a dead local `127.0.0.1:9090` when Mihomo actually listens only on `192.168.5.23:9090`.
- Mihomo bridge connection failures now return structured `502` JSON with `mihomo-controller-connect-failed` instead of crashing the request with a traceback.

## Quick verification

```bash
clear
grep -E '^(MIHOMO_ACTIVE_CONFIG|MIHOMO_CONTROLLER_URL|MIHOMO_CONTROLLER_SECRET)=' /etc/ultra-ui-ubuntu/agent.env || true
echo
curl -s http://127.0.0.1:18090/api/version
echo
curl -s http://127.0.0.1:18090/api/providers/proxies | head -c 400
echo
```

