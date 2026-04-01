- v0.6.67: ubuntu-service Mihomo bridge now retries against controller candidates from both env and config, so stale loopback values stop breaking `/api/providers/proxies`.
# Current status — v0.6.67

- Active contour: `ubuntu-service` backend on Ubuntu host.
- 3x-ui host inventory and SSL checks stay on backend SQLite / server-side runtime.
- Latest hotfix: Mihomo bridge no longer trusts a stale `MIHOMO_CONTROLLER_URL` blindly; it compares env and config controller addresses, prefers the live config bind when needed, and returns richer `502` diagnostics if every controller candidate fails.

## Update v0.6.67
- backend bridge now tries multiple controller candidates (`agent.env` + `config.yaml`) before giving up.
- stale `127.0.0.1:9090` leftovers no longer outrank the live `192.168.5.23:9090` bind from `external-controller`.
- install/update flow now reads `MIHOMO_ACTIVE_CONFIG` from env files correctly before resolving Mihomo YAML values.
