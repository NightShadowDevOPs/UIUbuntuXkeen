Current prepared release: v0.6.51. The standalone Ubuntu backend is already confirmed on the live host: `ultra-ui-ubuntu-backend.service` is running, `GET /api/health` responds, and the backend is selected in `Setup` as `ubuntu-service`.

## Обновление v0.6.51
- подтверждён живой запуск `ultra-ui-ubuntu-backend.service` на Ubuntu-хосте
- подтверждены ответы `/api/health`, `/api/version`, `/api/capabilities`, `/api/status`
- подтверждено подключение backend в `Setup` как `ubuntu-service` с `host:port + /api`
- выявлен фронтовой дефект сборки URL: часть экранов строила маршрут как `/api/api/...` и падала в `capabilities-http-404`
- в `v0.6.51` исправлена нормализация backend endpoint-ов для standalone Ubuntu backend

## Что сейчас точно есть
- UI по-прежнему раздаётся самим `mihomo`
- папка UI на сервере: `/etc/mihomo/uiubuntu`
- recovery UI: остановить `mihomo` -> удалить папку UI -> запустить `mihomo` -> UI снова скачивается
- на Ubuntu-хосте уже работает `ultra-ui-ubuntu-backend.service`
- backend слушает `0.0.0.0:18090` и использует SQLite: `/var/lib/ultra-ui-ubuntu/runtime/backend.sqlite3`

## Что проверяется следующим шагом
- сохранение `Хосты 3x-ui` через живой backend без fallback-плашки
- сохранение `Users inventory` через SQLite backend
- ручной запуск и отображение SSL-cache/SSL-check из UI без `capabilities-http-404`
