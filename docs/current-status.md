Current prepared release: v0.6.44. This is a stability/audit step after the recovered v0.6.41 baseline and the cleanup release v0.6.42. The distribution no longer carries `router-agent/` baggage, the root UI route is now `Overview`, and the actual runtime contour is explicitly documented: Mihomo serves the UI and can redownload it after the UI directory is removed.

What is true right now
- runtime UI serving is tied to `mihomo.service` and the `/etc/mihomo/uiubuntu` directory;
- root `/ui/` should land on `Overview` first for a safer startup path;
- `Xui Hosts` and `Users` are UI sections already present in the app;
- no bundled standalone Ubuntu service is present in the distribution.

What is not claimed anymore
- no claim that a separate server-side service is already installed on the host;
- no claim that provider SSL checks and users inventory storage are already fully wired into the live backend contour.


## Обновление v0.6.44
- `Хосты 3x-ui` и `Пользователи` теперь привязаны к существующему contour `api.sh` через compatibility bridge.
- Источники данных: `mihomo_providers`, `ssl_cache_refresh`, `users_db_get`, `users_db_put`.
- Новый standalone backend/service не добавлялся.
