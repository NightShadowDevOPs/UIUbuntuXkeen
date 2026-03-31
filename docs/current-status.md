Current prepared release: v0.6.48. The project now contains a real standalone Ubuntu backend in `backend/`, but the current host will keep using the honest UI fallback mode until this backend is installed on Ubuntu and selected in `Setup`.

## Обновление v0.6.48
- после подтверждения пользователем backend-старта в репозиторий добавлен отдельный Ubuntu backend/service
- backend не привязан к `/cgi-bin/api.sh` и не встраивается в runtime `mihomo`
- новый backend хранит `3x-ui Hosts`, `Users inventory`, `jobs` и SSL state в SQLite
- install/run flow оформлен через `backend/scripts/install.sh`, `backend/scripts/run-dev.sh` и systemd unit `ultra-ui-ubuntu-backend.service`
- UI остаётся совместимым с fallback-режимом, пока backend не установлен и не выбран в `Setup`

## Что сейчас точно есть
- UI раздаётся самим `mihomo`
- папка UI на сервере: `/etc/mihomo/uiubuntu`
- recovery UI: остановить `mihomo` -> удалить папку UI -> запустить `mihomo` -> UI снова скачивается
- в репозитории есть новый каталог `backend/` с FastAPI + SQLite backend

## Чего ещё нет на текущем живом хосте до установки
- подтверждённого запущенного `ultra-ui-ubuntu-backend.service`
- подтверждённого `GET /api/health` на `127.0.0.1:18090`
- подтверждённого live-подключения UI к backend через `Setup`
