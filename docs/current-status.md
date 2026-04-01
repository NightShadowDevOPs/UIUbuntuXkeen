- v0.6.71: backend Mihomo proxy paths now re-encode Unicode/spaces per segment before forwarding upstream, so proxy/rule groups with Cyrillic names (for example `Остальной трафик`) stop crashing ubuntu-service with `InvalidURL`.
- v0.6.70: ubuntu-service backend now proxies additional Mihomo UI routes, SSL status pills are readable in dark theme, and provider checks explicitly show `system route` from the current host.
- v0.6.69: provider TLS probe now retries SNI / no-SNI / TLS 1.2 fallback paths and dark-theme SSL pills are readable again.
- v0.6.68: ubuntu-service Mihomo bridge now retries transient post-restart controller connect failures, reducing false 502 on `/api/providers/proxies`.
# Current status — v0.6.71

## Focus now
- keep `ubuntu-service` as the primary backend contour for Mihomo UI actions
- stabilize provider SSL checks / 3x-ui host cards without confusing route-level TLS timeouts with universal certificate failures
- continue backend/UI hardening around proxy/rule action flows and dark-theme readability

## Update v0.6.71
- fixed upstream Mihomo path encoding inside `ubuntu-service`: decoded FastAPI route params are now percent-encoded per segment before `urllib` forwards them, so proxy/group/rule names with spaces, Cyrillic, and emoji no longer explode with `InvalidURL`.
- same path-encoding helper now covers both HTTP and WebSocket upstream URLs, keeping proxy actions aligned with future realtime/detail routes.

## Update v0.6.70
- backend now proxies additional Mihomo UI endpoints (`/group/*`, `/cache/*`, `/restart`, `/upgrade/ui`, `/configs/*`) so backend contour actions stop tripping over missing routes
- empty `PUT/POST/PATCH` bridge calls are normalized before they go to Mihomo, reducing backend-side `Network Error` on action buttons
- `Хосты 3x-ui` and provider SSL workspace now use readable dark-theme status pills and clearly label checks as `system route` from the current Ubuntu host
