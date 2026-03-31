Current prepared release: v0.6.45. The current project backend contour is now actually enabled for the UI: Mihomo serves the UI, `api.sh` is the real existing server-side bridge, and capability detection no longer depends on a phantom standalone `/api/capabilities` service.

## Что реально есть сейчас

- UI обслуживается `mihomo`;
- рабочая папка UI на хосте: `/etc/mihomo/uiubuntu`;
- recovery/update-механизм: остановить `mihomo`, удалить UI-папку, запустить `mihomo`, после чего он сам скачивает UI из репозитория;
- серверный bridge текущей линии: `api.sh`;
- shared storage для `Хосты 3x-ui` и `Пользователи`: shared users DB.

## Обновление v0.6.45

- включён fallback capability-detection через `cgi-bin/api.sh?cmd=capabilities`;
- добавлена команда `capabilities` в `api.sh`;
- screens `Хосты 3x-ui` и `Пользователи` теперь описывают и используют реальный contour `Mihomo + api.sh + shared users DB`;
- `api.sh` поднят до `0.6.24`.
