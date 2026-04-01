## v0.6.58
- fixed the standalone Ubuntu frontend API client so provider SSL actions call the real `ubuntu-service` origin (`http://host:18090/api/...`) instead of accidentally posting to the Mihomo UI origin with relative `/api/...` URLs;
- `Хосты 3x-ui` now treats the selected `ubuntu-service` backend as a real provider runtime immediately, so the page no longer self-blocks its SSL actions behind stale capability state;
- forced a fresh backend capability probe when the page mounts, reducing false `capability-missing` badges after switching or updating the active backend;
- updated release docs, transfer docs, worklog, and change-request log for the live SSL-action hotfix.

## v0.6.56
- added a real provider SSL poller flow for `ubuntu-service`: scheduler now re-runs checks not only by interval, but also when provider state is missing or panel URLs changed;
- `Хосты 3x-ui` now triggers an immediate SSL refresh after saving providers, so certificate data appears without waiting for the next long cache TTL;
- changed the default near-expiry threshold for 3x-ui host diagnostics to 2 days (matching the short-lived 6-day IP certificate workflow), and exposed `ULTRA_UI_SSL_WARN_DAYS=2` in backend env/install defaults;
- improved SSL probe payload with `valid_from`, SHA-256 fingerprint, and verification diagnostics, while still extracting certificate dates even when the verified TLS handshake fails;
- expanded the 3x-ui host details panel with certificate validity window, fingerprint, and TLS verification diagnostics.

## v0.6.55
- added provider SSL history endpoint `/api/providers/checks/history` with per-check rows from SQLite history;
- extended provider payload with panel SSL days-left and probe status fields, so UI can show richer per-host diagnostics;
- enhanced `Хосты 3x-ui` with filter, issue-only toggle, per-host details panel, issuer/subject/SAN/error view, and recent SSL check history;
- server update workflow remains `git fetch origin --prune && git reset --hard origin/main` for deploy checkout.

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

## v0.6.57
- fixed provider SSL action flow on `ubuntu-service`: `Проверить сейчас` and `Обновить SSL-кэш` now trigger backend SSL checks asynchronously instead of waiting for a long blocking HTTP response;
- relaxed provider capability gating for the standalone Ubuntu backend so `Хосты 3x-ui` no longer show a false `capability-missing` state while the active backend is already `ubuntu-service`;
- added provider refresh polling on the frontend so the screen waits for the running SSL job and updates details/history after the check finishes;
- updated release docs, transfer docs, worklog, and request log for the confirmed SSL-action hotfix.
