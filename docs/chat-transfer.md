Prepared release: v0.6.71. The active contour stays on `ubuntu-service`; this hotfix adds missing backend proxy routes for standard Mihomo UI actions, keeps empty backend writes stable, and makes provider SSL status cards readable while explicitly marking checks as `system route` from the current Ubuntu host.
Актуальный релиз для переноса: **v0.6.71**

## Update v0.6.71
- fixed ubuntu-service Mihomo proxy path encoding for names with spaces/Cyrillic/emoji, so backend actions stop crashing on entries like `Остальной трафик`.
- path encoding is now shared between HTTP and WebSocket upstream URL builders.

## Update v0.6.70
- backend now proxies additional Mihomo UI endpoints (`/group/*`, `/cache/*`, `/restart`, `/upgrade/ui`, `/configs/*`) so backend contour actions stop tripping over missing routes
- empty `PUT/POST/PATCH` bridge calls are normalized before they go to Mihomo, reducing backend-side `Network Error` on action buttons
- `Хосты 3x-ui` and provider SSL workspace now use readable dark-theme status pills and clearly label checks as `system route` from the current Ubuntu host
