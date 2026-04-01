- v0.6.64: fixed two regressions around 3x-ui hosts: stale saved backend kind no longer blocks ubuntu-service actions, and users-db sync no longer wipes provider panel URLs when remote payload returns without providerPanelUrls after restart.
# Current status — v0.6.64

- Active contour: `ubuntu-service` backend on Ubuntu host.
- 3x-ui host inventory is stored in backend SQLite and reused by SSL checks.
- Latest hotfix: the `Хосты 3x-ui` page now reads provider endpoints from same-origin `/api/*` even if the browser still has an old compatibility backend profile saved.

## Update v0.6.64

- Added same-origin fallback for provider inventory and SSL actions (`/api/providers`, `/api/providers/checks`, `/api/providers/checks/history`, `/api/providers/checks/run`, `/api/providers/ssl-cache/refresh`).
- Removed the early guard in `XuiHostsPage`, so the page still tries backend loading instead of dropping straight into an empty local fallback.
- Goal: survive clean/update scenarios where the backend profile in browser storage is stale, but server-side backend and SQLite data are already healthy.
