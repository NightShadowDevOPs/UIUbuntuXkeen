# База шагов и хода работ

Актуально для релиза: **v0.6.46**

## Выполненные шаги
1. Проверен текущий contour `v0.6.44`: выяснено, что UI capability-store ломается на отсутствии `/api/capabilities`.
2. Добавлена server-side команда `cmd=capabilities` в существующий `api.sh`.
3. Добавлен UI fallback: `/api/capabilities` -> `cgi-bin/api.sh?cmd=capabilities` -> compatibility fallback.
4. Обновлены capability-флаги compatibility bridge (`providerChecksRun`, `providerRefresh`, `usersInventory`, `usersInventoryPut`).
5. Уточнены тексты экранов `Хосты 3x-ui` и `Пользователи` под реальный backend contour.

## Что сознательно не делалось
- не добавлялся новый standalone service;
- не ломался recovery/update path через `mihomo`;
- не вносились непроверенные server-side firewall/policy изменения для `proxyAccess`.

## Шаг v0.6.46
- Исправлена склейка источников для `Хосты 3x-ui`: страница теперь объединяет `mihomo providers`, shared users DB и локальную карту `proxyProviderPanelUrlMap`.
