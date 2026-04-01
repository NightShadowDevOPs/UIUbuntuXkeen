# Current status — v0.6.62

The active contour stays on `ubuntu-service`. `Хосты 3x-ui` now survive a dead or missing router-agent `users_db_get`: the page asks backend `/api/providers` first and treats users-db fallback as optional, so a broken fallback source no longer prevents backend rows from rendering.

- Main runtime stays on **`ubuntu-service`**.
- Server deploy workflow stays on **`git fetch origin --prune && git reset --hard origin/main`**.
- `3x-ui Hosts` no longer require a healthy `users_db_get` path just to render backend provider rows.
- Backend provider storage remains the source of truth; local/users-db rows are only best-effort fallback/reseed sources.
- UI is still served by **`mihomo`** from `/etc/mihomo/uiubuntu`.
- Backend service remains **`ultra-ui-ubuntu-backend.service`** on port `18090`.
- Backend install path: `/opt/ultra-ui-ubuntu-backend`.
- Backend SQLite path: `/var/lib/ultra-ui-ubuntu/runtime/backend.sqlite3`.

## Update v0.6.62
- fixed `Хосты 3x-ui` provider loading order for `ubuntu-service`;
- backend `/api/providers` is now queried even if users-db fallback is unavailable;
- users-db fallback is treated as best-effort and no longer aborts page hydration;
- transfer docs/runtime notes were cleaned up so install path and runtime DB path are not mixed together.

## What is confirmed right now
- main backend mode is `ubuntu-service`;
- `direct` stays fallback/diagnostics only;
- automatic SSL certificate checks of proxy providers are untouched;
- canonical Mihomo log path remains `/var/log/mihomo/mihomo.log`;
- canonical recovery flow for UI still stays: stop `mihomo` → remove UI folder → start `mihomo` → UI is downloaded again.

## What to verify after deploy
- `Хосты 3x-ui` renders the saved providers again;
- `curl -s http://127.0.0.1:18090/api/providers` returns rows on the host;
- SSL action buttons still operate on the same live provider list after the page is repopulated.
