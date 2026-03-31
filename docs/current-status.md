Current prepared release: v0.6.46. The UI still runs inside Mihomo, and the current fix finally bridges 3x-ui Hosts to the real Mihomo provider list instead of showing an empty page when only saved panel URLs exist in Proxy Providers.

## Что реально есть сейчас

- UI обслуживается `mihomo`;
- рабочая папка UI на хосте: `/etc/mihomo/uiubuntu`;
- recovery/update-механизм: остановить `mihomo`, удалить UI-папку, запустить `mihomo`, после чего он сам скачивает UI из репозитория;
- серверный bridge текущей линии: `api.sh`;
- shared storage для `Хосты 3x-ui` и `Пользователи`: shared users DB.

## Обновление v0.6.46

- включён fallback capability-detection через `cgi-bin/api.sh?cmd=capabilities`;
- добавлена команда `capabilities` в `api.sh`;
- screens `Хосты 3x-ui` и `Пользователи` теперь описывают и используют реальный contour `Mihomo + api.sh + shared users DB`;
- `api.sh` поднят до `0.6.24`.

- `Хосты 3x-ui` больше не должны быть пустыми только из-за пустого `providerPanelUrls`: имена провайдеров берутся из `mihomo_providers`, URL панелей подмешиваются из shared users DB и local settings.
