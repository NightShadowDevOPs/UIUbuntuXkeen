- v0.6.66: ubuntu-service now pins the real Mihomo controller URL into backend env during install/update and returns structured `502` JSON when the upstream controller is unavailable.
# Current status — v0.6.66

- Active contour: `ubuntu-service` backend on Ubuntu host.
- 3x-ui host inventory and SSL checks stay on backend SQLite / server-side runtime.
- Latest hotfix: Mihomo bridge routes stop falling back to a dead local controller address when the real controller listens only on the host LAN IP.

## Update v0.6.66
- `backend/scripts/install.sh` now syncs `MIHOMO_CONTROLLER_URL` from `/etc/mihomo/config.yaml` into `/etc/ultra-ui-ubuntu/agent.env`.
- Failed bridge connections now return structured `502` JSON (`mihomo-controller-connect-failed`) instead of ASGI tracebacks.
- Goal: keep `/api/providers/proxies`, `/api/proxies`, and related ubuntu-service bridge routes alive against the real Mihomo controller bind.
