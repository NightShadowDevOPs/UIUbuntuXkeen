## v0.6.45

- включён рабочий capability-fallback на существующий `api.sh`, чтобы `Хосты 3x-ui` и `Пользователи` реально считались backend-доступными даже без отдельного `/api/capabilities`;
- добавлена серверная команда `cmd=capabilities` в `api.sh`;
- compatibility-bridge теперь честно объявляет `providerChecksRun`, `providerRefresh`, `usersInventory`, `usersInventoryPut`;
- уточнены тексты экранов `Хосты 3x-ui` и `Пользователи`: текущий backend-contour — `Mihomo + api.sh + shared users DB`;
- `api.sh` поднят до версии `0.6.24`.

## v0.6.44
- connected `Хосты 3x-ui` and `Пользователи` to the existing Mihomo/api.sh backend contour through the compatibility bridge instead of a phantom standalone service;
- compatibility capabilities now expose the real commands already present in `api.sh`: `mihomo_providers`, `ssl_cache_refresh`, `users_db_get`, `users_db_put`;
- `3x-ui Hosts` now reads and saves `providerPanelUrls` through the shared users DB;
- `Users` inventory now reads and saves plain LAN host rows and `proxyAccessPolicyMode` through the same shared users DB while preserving non-host rules.

## v0.6.43
- stabilized root startup routing: `/ui/` now opens `Overview` first instead of `Proxies`, so the UI is less fragile during future route-level regressions;
- audited the actual runtime contour of the Ubuntu project: UI is served by Mihomo, recovery is done by deleting the UI directory and restarting Mihomo, no phantom standalone service is bundled;
- cleaned the visible wording on `Хосты 3x-ui` and `Пользователи` so these screens no longer imply that a separate invented service exists on the server;
- documented the current backend contour and the next safe implementation path for server-side storage and SSL polling.

## v0.6.42
- removed the legacy `router-agent/` directory from the distribution;
- removed root-level helper leftovers `_api*.sh`, `_backup_new.sh`, `extracted_api*.sh` from the release package;
- documented the confirmed recovery path: stop `mihomo`, remove the UI directory, start `mihomo` again, let it redownload the UI from the repository;
- kept the runtime/server contour unchanged: no new standalone service and no new backend layer in this release.

## v0.6.41
- removed the phantom standalone `ubuntu-service/` introduced in v0.6.39;
- removed separate-service deployment instructions from the current release path;
- decoupled **3x-ui Hosts** and **Users** pages from a hard requirement on `ubuntu-service` mode;
- updated docs to treat the existing project backend as the only valid direction for SSL checks and users DB.

## v0.6.39
- introduced a standalone `ubuntu-service/` backend MVP (later reverted by v0.6.41).
