Prepared release: v0.6.46. This release fixes the 3x-ui Hosts backend bridge so the page no longer stays empty when panel URLs already exist in Proxy Providers and the Mihomo provider list is already known.

Актуальный релиз для переноса: **v0.6.46**

Что сделано в `v0.6.46`

- добавлена серверная команда `cmd=capabilities` в `api.sh`;
- capability-store UI теперь проверяет `/api/capabilities`, затем `cgi-bin/api.sh?cmd=capabilities`, и только потом включает compatibility fallback;
- `Хосты 3x-ui` и `Пользователи` теперь могут реально работать через текущий contour `Mihomo + api.sh + shared users DB`;
- compatibility bridge теперь честно объявляет `providerChecksRun`, `providerRefresh`, `usersInventory`, `usersInventoryPut`;
- `api.sh` поднят до `0.6.24`.

Подтверждённый recovery-механизм UI

- остановить `mihomo`;
- удалить папку UI;
- запустить `mihomo`;
- `mihomo` сам заново скачает UI из репозитория.

Следующий шаг

- backend-only полировка server-side применения `proxyAccess`;
- при необходимости — отдельные точечные команды в `api.sh` под `3x-ui Hosts` / `Users`, но без нового отдельного сервиса.

[Update v0.6.46]

- `Хосты 3x-ui` теперь заполняются не только из `providerPanelUrls`, но и из реального списка Mihomo providers; сохранённые URL панелей накладываются сверху и могут быть сохранены обратно в shared users DB.
