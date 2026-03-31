# Backend contour audit v0.6.44

## Подтверждённые реальные команды текущего contour
- `mihomo_providers`
- `ssl_cache_refresh`
- `users_db_get`
- `users_db_put`

## Что подключено в UI
- `Хосты 3x-ui` используют `providerPanelUrls` из shared users DB и состояние SSL из `mihomo_providers` / `ssl_cache_refresh`.
- `Пользователи` используют plain LAN rows из shared users DB и сохраняют `proxyAccessPolicyMode` в тот же документ.

## Что не вводилось
- новый standalone backend/service;
- отдельное хранилище вне существующего contour `api.sh`.
