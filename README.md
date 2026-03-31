# UIUbuntuXkeen

- Текущая версия линии: **v0.6.48**
- Базовый runtime текущего хоста: `mihomo`
- Подтверждённый recovery-механизм UI: остановить `mihomo`, удалить папку UI, снова запустить `mihomo` — UI скачивается из репозитория автоматически
- Начиная с `v0.6.48`, в репозитории снова есть **отдельный Ubuntu backend**, но он запускается **как самостоятельный systemd service**, а не внутри `mihomo`

## Что в v0.6.48

- добавлен новый каталог `backend/` с реальным Ubuntu backend/service на **FastAPI + SQLite**
- backend поднимает endpoints `health`, `version`, `capabilities`, `status`, `providers`, `users inventory`, `jobs`
- для `Хосты 3x-ui` добавлена серверная база `provider_hosts` и реальная SSL/TLS-проверка panel URL через Python `ssl/socket`
- для `Пользователи` добавлена серверная база `users_inventory` и policy mode `allowAll / allowListOnly`
- добавлены install/run-скрипты и systemd unit template для Ubuntu
- документация, transfer-файлы и базы шагов/запросов обновлены под новый backend-этап

## Как это теперь запускается

- UI по-прежнему живёт отдельно и обслуживается `mihomo`
- backend ставится и запускается отдельно, как `ultra-ui-ubuntu-backend.service`
- UI подключается к нему через `Setup`, например на `http://192.168.5.23:18090`

## Важно

Этот релиз **не вшивает backend внутрь `mihomo`** и не пытается воскресить мёртвый `/cgi-bin/api.sh`.
Новая backend-линия запускается отдельно и может развиваться независимо, не ломая текущий UI runtime.

[Update v0.6.48]
