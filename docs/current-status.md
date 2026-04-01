- v0.6.65: ubuntu-service now proxies missing provider action routes, and provider SSL payload keeps the latest successful certificate snapshot so UI can still show cert data after timeout-heavy checks.
# Current status — v0.6.65

- Active contour: `ubuntu-service` backend on Ubuntu host.
- 3x-ui host inventory is stored in backend SQLite and reused by SSL checks.
- Latest hotfix: provider cards/details now keep the last successful certificate visible while the newest failed attempt still shows the TLS timeout.

## Update v0.6.65
- Added missing passthrough routes for provider update/health-check and nested proxy delay actions.
- Provider SSL payload now includes `panelSslLastSuccess*` fields for UI fallback.
- `Хосты 3x-ui` badges switched to compact outlined statuses with readable tooltip-based error text.

- v0.6.64: fixed two regressions around 3x-ui hosts: stale saved backend kind no longer blocks ubuntu-service actions, and users-db sync no longer wipes provider panel URLs when remote payload returns without providerPanelUrls after restart.
# Current status — v0.6.64

- Active contour: `ubuntu-service` backend on Ubuntu host.
- 3x-ui host inventory is stored in backend SQLite and reused by SSL checks.
- Latest hotfix: the `Хосты 3x-ui` page now reads provider endpoints from same-origin `/api/*` even if the browser still has an old compatibility backend profile saved.

## Update v0.6.64

- Added same-origin fallback for provider inventory and SSL actions (`/api/providers`, `/api/providers/checks`, `/api/providers/checks/history`, `/api/providers/checks/run`, `/api/providers/ssl-cache/refresh`).
- Removed the early guard in `XuiHostsPage`, so the page still tries backend loading instead of dropping straight into an empty local fallback.
- Goal: survive clean/update scenarios where the backend profile in browser storage is stale, but server-side backend and SQLite data are already healthy.
