
Latest hotfix: `v0.6.73` rolled back provider SSL probe default to `system-route` after blanket TLS timeouts seen with `v0.6.72 forced-direct`.
Prepared release: v0.6.72. The active contour stays on `ubuntu-service`; this hotfix adds missing backend proxy routes for standard Mihomo UI actions, keeps empty backend writes stable, and makes provider SSL status cards readable while explicitly marking checks as `system route` from the current Ubuntu host.
Актуальный релиз для переноса: **v0.6.72**

## Update v0.6.72
- fixed ubuntu-service Mihomo proxy path encoding for names with spaces/Cyrillic/emoji, so backend actions stop crashing on entries like `Остальной трафик`.
- path encoding is now shared between HTTP and WebSocket upstream URL builders.

## Update v0.6.72
- backend now proxies additional Mihomo UI endpoints (`/group/*`, `/cache/*`, `/restart`, `/upgrade/ui`, `/configs/*`) so backend contour actions stop tripping over missing routes
- empty `PUT/POST/PATCH` bridge calls are normalized before they go to Mihomo, reducing backend-side `Network Error` on action buttons
- `Хосты 3x-ui` and provider SSL workspace now use readable dark-theme status pills and clearly label checks as `system route` from the current Ubuntu host


## Update v0.6.72
- provider SSL checks now support `forced-direct`: backend binds probes to the detected default interface/source IP so certificate reads stop inheriting the current tunnel/provider route of the host
- install/update seeds `ULTRA_UI_SSL_PROBE_ROUTE_MODE`, `ULTRA_UI_SSL_PROBE_DIRECT_INTERFACE`, and `ULTRA_UI_SSL_PROBE_DIRECT_SOURCE_IP` into `agent.env`
- Xui Hosts and provider SSL workspace now show the active probe route and use high-contrast dark-theme pills with short TLS labels
