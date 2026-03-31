# UIUbuntuXkeen

- Текущая версия линии: **v0.6.46**
- Runtime contour: **Mihomo + api.sh + shared users DB**
- Подтверждённый recovery/update-механизм: остановить `mihomo`, удалить папку UI, запустить `mihomo` снова — UI скачивается из репозитория автоматически.

## Что в v0.6.46

- backend-capability probe больше не упирается в несуществующий `/api/capabilities`;
- текущий contour `Mihomo + api.sh + shared users DB` объявляется как рабочий backend для экранов `Хосты 3x-ui` и `Пользователи`;
- в `api.sh` добавлена команда `capabilities`;
- `api.sh` поднят до `0.6.24`;
- страницы больше не описываются как «готовые к backend потом» — они работают через существующий backend-контур проекта.

[Update v0.6.46]
