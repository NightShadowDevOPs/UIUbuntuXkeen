## v0.6.54
- added a Mihomo bridge layer to the standalone Ubuntu backend for `GET /api/configs`, `GET /api/proxies`, `GET /api/providers/proxies`, `GET /api/providers/rules`, and `GET /api/rules`, so `ubuntu-service` can fetch the same core model data that the overview and proxy topology expect;
- switched `/api/connections` on `ubuntu-service` from a host-local socket snapshot to a WebSocket relay into the real Mihomo controller when it is available, while keeping the lightweight local fallback only for bridge failures;
- added environment/config autodetection for the local Mihomo controller through `MIHOMO_ACTIVE_CONFIG` (default `/etc/mihomo/config.yaml`) plus optional overrides `MIHOMO_CONTROLLER_URL` and `MIHOMO_CONTROLLER_SECRET`;
- updated install/runtime docs, transfer docs, and step logs for the first Mihomo bridge release on the Ubuntu backend.

## v0.6.53
- added realtime WebSocket endpoints to the standalone Ubuntu backend for `/api/traffic`, `/api/memory`, `/api/connections`, and `/api/logs` (plus compatibility aliases) so `ubuntu-service` no longer loses the overview charts immediately with `403`;
- added lightweight host-side runtime samplers: memory usage from `/proc/meminfo`, aggregate traffic from `/proc/net/dev`, and best-effort active socket snapshots from `ss -tunH` for the connections store;
- expanded backend capability payload with `connections` and `logs` for the live Ubuntu contour;
- updated release docs, transfer docs, current status, and request/work logs for the first realtime telemetry step on `ubuntu-service`.

## v0.6.52
- added separate UI actions for provider SSL checks: `Проверить сейчас` and `Обновить SSL-кэш` on `Хосты 3x-ui` and the provider SSL workspace card;
- surfaced next-check and last-job status badges on `Хосты 3x-ui` so the screen shows whether backend work actually ran;
- fixed `backend/scripts/install.sh` so updating the backend now explicitly restarts an already running `ultra-ui-ubuntu-backend.service` instead of leaving the old process alive;
- updated release docs, transfer docs, request log, and worklog for the confirmed `ubuntu-service` runtime flow.

## v0.6.51
- fixed absolute ubuntu backend endpoint composition for capabilities probes when secondaryPath is set to `/api`;
- kept `/api` as the required recommended secondary path for ubuntu-service backend validation;
- updated backend/frontend version markers and transfer docs.

## v0.6.50
- fixed Ubuntu backend route composition in the UI when `secondaryPath=/api`: capability probing now targets `/api/capabilities` once instead of building a broken doubled path
- fixed Ubuntu backend API calls for `3x-ui Hosts`, provider SSL cache, `Users inventory`, `status/resources/services/logs` so the frontend no longer asks the backend for `/api/api/...`
- preserved the selected `ubuntu-service` backend in Setup as the correct runtime path; the hotfix only normalizes frontend endpoint building and does not change the deployment model
- updated release docs, transfer docs, worklog, and request log with the confirmed live-server install and the frontend route hotfix

## v0.6.48
- added a new standalone Ubuntu backend in `backend/` based on FastAPI + SQLite instead of reviving the dead `/cgi-bin/api.sh` contour
- implemented real backend endpoints for `health`, `version`, `capabilities`, `status`, `providers`, `users inventory`, and `jobs`
- implemented server-side storage for `3x-ui Hosts` (`provider_hosts`) and `Users inventory` (`users_inventory`)
- implemented real TLS/SSL checks for provider panel URLs using Python `ssl` + `socket`, with state/history persisted in SQLite
- added scheduler groundwork, install script, dev run script, and a systemd service template for Ubuntu deployment
- updated project docs, transfer docs, change-request log, and worklog so the backend step is fully recorded

## v0.6.47
- stopped faking backend capabilities when `/api/capabilities` and `/cgi-bin/api.sh?cmd=capabilities` are absent or return errors; the UI now switches to an honest local fallback mode instead of pretending that `api.sh` is available
- `Хосты 3x-ui` now show a clear warning when the server-side backend route is unavailable and keep working from local UI data without a fake live SSL state
- `Пользователи` now show the same warning and keep working with local UI data instead of claiming that shared users DB is already connected
- provider health error now surfaces the actual backend-route failure instead of a vague `capability-missing` placeholder
- removed stale `backend:dev` / `backend:smoke` scripts that still referenced the phantom `ubuntu-service`
