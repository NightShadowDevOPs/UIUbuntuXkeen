Prepared release: v0.6.45. This release makes the current backend contour actually usable: the UI no longer dies on missing `/api/capabilities`, and instead falls back to the real `api.sh` contour already present on the Mihomo host.

Актуальный релиз для переноса: **v0.6.45**

Что сделано в `v0.6.45`

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

[Update v0.6.45]
