Prepared release: v0.6.48. This release starts the real Ubuntu backend line for UIUbuntuXkeen as a standalone systemd service. The project no longer depends on reviving `/cgi-bin/api.sh`; instead, it now contains a separate `backend/` with FastAPI + SQLite for `3x-ui Hosts`, `Users inventory`, `jobs`, and provider SSL checks.

Актуальный релиз для переноса: **v0.6.48**

Что сделано в `v0.6.48`
- пользователь подтвердил старт backend-этапа отдельным релизом, с обязательной актуализацией документации и фиксацией всех шагов
- в проект добавлен каталог `backend/` с отдельным Ubuntu service на FastAPI + SQLite
- реализованы endpoints: `/api/health`, `/api/version`, `/api/capabilities`, `/api/status`, `/api/providers`, `/api/providers/checks`, `/api/providers/ssl-cache/refresh`, `/api/users/inventory`, `/api/jobs`
- backend хранит `3x-ui Hosts` и `Users inventory` в SQLite, а не только в локальном UI-state
- реализована серверная SSL/TLS-проверка panel URL провайдеров через Python `ssl/socket`
- добавлены `backend/scripts/install.sh`, `backend/scripts/run-dev.sh` и systemd unit template
- документация `docs/*`, `TRANSFER_CHAT` и журнал запросов/шагов обновлены под новый backend-контур

Что важно понимать
- UI по-прежнему раздаётся самим `mihomo`
- новый backend запускается отдельно как `ultra-ui-ubuntu-backend.service`
- backend не встроен в `mihomo` и не использует `/cgi-bin/api.sh` как каноничный runtime
- пока backend не установлен на хосте и не выбран в `Setup`, UI продолжит честный fallback-режим

Что делать дальше на сервере
1. Залить релиз в репозиторий.
2. На Ubuntu-хосте выполнить установку backend через `backend/scripts/install.sh`.
3. Проверить `http://127.0.0.1:18090/api/health`.
4. В UI открыть `Setup`, добавить backend `http://<IP_хоста>:18090` и выбрать его как `ubuntu-service`.
5. Проверить экраны `Хосты 3x-ui` и `Пользователи` уже через живой backend.

Что следующим шагом после `v0.6.48`
- подтвердить первый запуск backend на живом хосте;
- проверить сохранение `3x-ui Hosts` и `Users inventory` через UI;
- расширить backend на `Host`, `Traffic`, `QoS`, `logs`, `resources`.

[Update v0.6.48]
