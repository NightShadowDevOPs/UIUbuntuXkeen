Current prepared release: v0.6.52. The standalone Ubuntu backend is already confirmed on the live host: `ultra-ui-ubuntu-backend.service` is running, `GET /api/health` responds, and the backend is selected in `Setup` as `ubuntu-service`.

## Обновление v0.6.52
- подтверждено, что backend `ubuntu-service` остаётся рабочим активным режимом в `Setup`
- подтверждено, что `capabilities` и `3x-ui Hosts` больше не падают в fallback после live-подключения backend
- на экран `Хосты 3x-ui` добавлены отдельные действия `Проверить сейчас` и `Обновить SSL-кэш`
- `backend/scripts/install.sh` теперь явно перезапускает сервис после обновления файлов, чтобы новая версия backend сразу отвечала без ручного `systemctl restart`

## Что сейчас точно есть
- UI по-прежнему раздаётся самим `mihomo`
- папка UI на сервере: `/etc/mihomo/uiubuntu`
- recovery UI: остановить `mihomo` -> удалить папку UI -> запустить `mihomo` -> UI снова скачивается
- на Ubuntu-хосте уже работает `ultra-ui-ubuntu-backend.service`
- backend слушает `0.0.0.0:18090` и использует SQLite: `/var/lib/ultra-ui-ubuntu/runtime/backend.sqlite3`
- экран `Хосты 3x-ui` использует живой backend-контур, а не fallback

## Что проверяется следующим шагом
- ручной запуск SSL-check и refresh кэша из UI на живых 3x-ui хостах
- сохранение `Users inventory` через SQLite backend
- следующий backend-блок: `Host / resources / services / logs`
