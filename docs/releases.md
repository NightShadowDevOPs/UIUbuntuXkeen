## v0.6.69
- provider TLS probe now records multiple handshake attempts (verify, insecure with SNI, insecure without SNI, TLS 1.2 fallback) before declaring `_ssl.c:983: The handshake operation timed out`.
- Xui Hosts and provider SSL workspace now use readable dark-theme status pills instead of low-contrast default badges.

## v0.6.68
- backend Mihomo bridge now retries transient connect-refused/timeouts for controller API calls right after controller restart, reducing false 502 on `/api/providers/proxies`.
- 502 payload keeps per-attempt diagnostics so startup races are visible instead of looking random.

## v0.6.67
- fixed ubuntu-service Mihomo bridge controller resolution: backend now loads both the env-pinned controller URL and the current `/etc/mihomo/config.yaml` `external-controller`, prefers the config address when a stale loopback value is left behind, and retries proxy HTTP requests across controller candidates before returning `502`.
- improved failed bridge diagnostics: `mihomo-controller-connect-failed` responses now include attempted controller URLs/errors instead of only the final dead endpoint, which makes stale `127.0.0.1:9090` leftovers obvious during smoke checks.
- fixed backend install helper parsing for `MIHOMO_ACTIVE_CONFIG`: `backend/scripts/install.sh` now reads env-style `KEY=VALUE` entries correctly before resolving the Mihomo config path.

## v0.6.66
- fixed ubuntu-service Mihomo bridge install/update flow so `backend/scripts/install.sh` now writes `MIHOMO_CONTROLLER_URL` from `/etc/mihomo/config.yaml` into `/etc/ultra-ui-ubuntu/agent.env`; this keeps backend proxy routes pointed at the real controller even when Mihomo binds only to the host LAN IP (`192.168.5.23:9090`) and `127.0.0.1:9090` is closed.
- fixed standalone backend proxy error handling: failed connections to the Mihomo controller now return structured `502` JSON instead of raising an unhandled ASGI traceback.
- runtime goal of the hotfix: stop `ConnectionRefusedError` on `/api/providers/proxies` while keeping the active contour on `ubuntu-service`.

## v0.6.65
- fixed ubuntu-service passthrough gaps for provider actions (`providers/proxies/{name}`, `providers/proxies/{name}/healthcheck`, `providers/rules/{name}`, `proxies/{name}/delay`) so cards stop hitting local 404s for update/health-check operations.
- provider SSL state now keeps the latest successful certificate snapshot next to the latest failed attempt, so cards can still show the last valid certificate when remote 3x-ui panels stall during TLS handshake.
- improved dark-theme readability on `Хосты 3x-ui`: compact outlined badges replace raw exception text inside pills, and details now show a dedicated "Последний успешный сертификат" block.

## v0.6.64
- fixed stale backend kind detection for ubuntu-service profiles that still carried compatibility mode in saved settings; host /api contour is now treated as ubuntu-service even if the old explicit kind remained in storage
- fixed users-db startup sync so provider panel URLs are not wiped locally when the remote payload comes back without providerPanelUrls after restart/reset
- preserved 3x-ui host actions availability for the ubuntu-service contour so certificate checks and SSL cache refresh stay reachable after restart

- v0.6.64 — fixed empty `Хосты 3x-ui` list when backend data exists but the UI still points to an old saved backend profile: provider endpoints now have same-origin ubuntu-service fallback, and the page no longer aborts backend loading just because the saved profile is not marked as `ubuntu-service`.
- v0.6.64 — fixed `Хосты 3x-ui` loading on `ubuntu-service`: frontend provider hydration now hits backend `/api/providers` even when router-agent `users_db_get` is unavailable, and users-db fallback became best-effort instead of blocking the page before the real backend request.
- v0.6.61 — restored 3x-ui host persistence on `ubuntu-service`: the UI now reseeds backend provider rows from local/users-db fallback when `/api/providers` is empty, backend storage no longer wipes existing hosts on accidental empty saves, provider hosts can recover from SSL state/history, and legacy `agentStatusAPI()` polling bridges to `/api/status` instead of hammering dead `:9099/cgi-bin/api.sh?cmd=status` while `ubuntu-service` is active.
- v0.6.59 — fixed `Хосты 3x-ui` provider SSL buttons on `ubuntu-service`: the page now calls backend SSL action endpoints directly, stops showing a stale `capability-missing` badge when backend capabilities are healthy, and refreshes rows/details after the background job settles.
- v0.6.58 — fixed provider SSL action routing for `ubuntu-service`: frontend REST calls now target the standalone backend origin instead of relative Mihomo UI paths, `Хосты 3x-ui` immediately treats `ubuntu-service` as a live provider runtime, and the page forces a fresh capabilities probe on mount to avoid stale `capability-missing` states.
- v0.6.56 — enabled the real provider SSL poller flow for `ubuntu-service`: 3x-ui hosts trigger checks immediately after save, the backend scheduler also reruns checks when state is missing or host URLs changed, the default SSL warning threshold is now 2 days, and host details show validity/fingerprint/TLS verification diagnostics.
- v0.6.55 — added provider SSL history/details for `ubuntu-service`: backend `/api/providers/checks/history`, days-left/status fields in provider payload, and a richer `Хосты 3x-ui` UI with issue filter and recent check history.
- v0.6.54 — added a Mihomo bridge to the standalone Ubuntu backend for `/api/configs`, `/api/proxies`, `/api/providers/proxies`, `/api/providers/rules`, `/api/rules`, and switched `/api/connections` to relay the real Mihomo WebSocket when the local controller is available.
- v0.6.53 — added realtime WebSocket endpoints for `traffic`, `memory`, `connections`, and `logs` to the standalone Ubuntu backend so overview charts can keep working on `ubuntu-service`, with lightweight host telemetry sourced from `/proc` and `ss`.
- v0.6.52 — added distinct UI actions for provider SSL checks (`Проверить сейчас` and `Обновить SSL-кэш`) and fixed backend install/update so `backend/scripts/install.sh` explicitly restarts a running `ultra-ui-ubuntu-backend.service`.
- v0.6.51 — fixed frontend route composition for the standalone Ubuntu backend when `secondaryPath=/api`; `capabilities`, `3x-ui Hosts`, provider SSL cache, `Users inventory`, and Ubuntu system API calls no longer hit broken `/api/api/...` paths.
- v0.6.49 — started the real standalone Ubuntu backend line: added `backend/` with FastAPI + SQLite, server-side `3x-ui Hosts`, `Users inventory`, `jobs`, provider SSL checks, install script, and systemd service template.
- v0.6.49 — fixed backend install/update flow: removed broken heredoc unit generation, switched install to service template copy, defaulted backend bind to `0.0.0.0`, and auto-migrated old `ULTRA_UI_HOST=127.0.0.1` env values.
- v0.6.47 — stopped faking backend capabilities when the current host returns `404` for `/api/capabilities` and `/cgi-bin/api.sh`; `3x-ui Hosts` and `Users` now switch to an honest local fallback mode and show a warning instead of a misleading backend state.
- v0.6.46 — fixed the 3x-ui Hosts bridge: the page now merges real Mihomo provider names with saved panel URLs, so hosts are visible even when the shared DB map is still empty and panel URLs already exist in Proxy Providers.
- v0.6.45 — enabled the real current backend contour for the UI: added `cmd=capabilities` to `api.sh`, added capability fallback through `cgi-bin/api.sh`, and made `Хосты 3x-ui` / `Пользователи` rely on `Mihomo + api.sh + shared users DB`.

- v0.6.57 — fixed provider SSL actions on `ubuntu-service`: backend SSL checks now start asynchronously, the UI polls until the job settles, and `Хосты 3x-ui` stop showing a false `capability-missing` state while the standalone backend is active.
