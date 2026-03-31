Prepared release: v0.6.51. The standalone Ubuntu backend is now confirmed on the live host, and this hotfix fixes the frontend route composition bug that produced `/api/api/...` requests after selecting the backend in `Setup`.

Актуальный релиз для переноса: **v0.6.51**

Что сделано в `v0.6.51`
- на живом Ubuntu-хосте подтверждён запуск `ultra-ui-ubuntu-backend.service` и ответы `/api/health`, `/api/version`, `/api/capabilities`, `/api/status`
- подтверждено подключение backend в `Setup` как `ubuntu-service` через `host:port + /api`
- исправлена фронтовая сборка URL для standalone backend: больше нет битого маршрута `/api/api/...`
- исправлены вызовы `capabilities`, `providers`, `provider checks`, `provider SSL cache`, `users inventory`, `status/resources/services/logs`
- документация `docs/*`, `TRANSFER_CHAT` и журнал запросов/шагов обновлены под live-backend и hotfix маршрутов

Что важно понимать
- UI по-прежнему раздаётся самим `mihomo`
- новый backend запускается отдельно как `ultra-ui-ubuntu-backend.service`
- backend `ubuntu-service` в `Setup` остаётся правильным активным режимом; назад на `direct` уходить не нужно
- secondary path `/api` — это нормальная настройка, проблема была именно в фронтовой сборке endpoint-ов

Что делать дальше на сервере
1. Залить релиз в репозиторий.
2. На Ubuntu-хосте выполнить `git pull --ff-only` в `/opt/UIUbuntu/app`.
3. Повторно запустить `backend/scripts/install.sh`, чтобы backend версия и файлы были синхронизированы с релизом.
4. В UI оставить выбранным backend `ubuntu-service`.
5. Проверить экран `Хосты 3x-ui` уже без `capabilities-http-404` и без fallback-плашки.

Что следующим шагом после `v0.6.51`
- подтвердить сохранение `3x-ui Hosts` через backend;
- подтвердить сохранение `Users inventory`;
- добавить следующий backend-блок: `Host / resources / services / logs`.

[Update v0.6.51]
