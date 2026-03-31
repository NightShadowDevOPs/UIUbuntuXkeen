# Backend enable v0.6.45

## Что было сломано

UI ждал `/api/capabilities`, которого в текущем Mihomo-контуре нет. После 404 capability-store сбрасывался в пустое состояние, из-за чего экраны `Хосты 3x-ui` и `Пользователи` не считались backend-доступными и фактически работали как локальный UI-cache.

## Что сделано

- в `api.sh` добавлена команда `cmd=capabilities`;
- в `src/store/backendCapabilities.ts` добавлен fallback: сначала `/api/capabilities`, затем `cgi-bin/api.sh?cmd=capabilities`, и только после этого — compatibility fallback;
- compatibility bridge теперь честно объявляет рабочие capability-флаги для `providers`, `providerChecksRun`, `providerRefresh`, `usersInventory`, `usersInventoryPut`;
- экраны `Хосты 3x-ui` и `Пользователи` описывают реальный contour: `Mihomo + api.sh + shared users DB`.

## Что это даёт

- backend capability-store больше не пустой на реальном Ubuntu/Mihomo-хосте;
- страницы могут использовать существующий server-side contour, не ожидая фантомный отдельный сервис;
- список 3x-ui host panels и LAN users inventory теперь работают через текущий contour проекта.
