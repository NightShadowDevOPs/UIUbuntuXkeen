# Журнал шагов

Актуально для релиза: **v0.6.50**

## Шаги v0.6.49
1. Зафиксирован новый запрос пользователя: начать backend-этап релизами, по ходу объяснять действия на сервере, постоянно актуализировать документацию и фиксировать каждый шаг.
2. На базе `v0.6.47` принято решение не оживлять `/cgi-bin/api.sh`, а запускать отдельный Ubuntu backend как самостоятельный service.
3. В проект добавлен каталог `backend/` с FastAPI-приложением и SQLite-хранилищем.
4. Реализованы таблицы `provider_hosts`, `provider_ssl_checks`, `provider_ssl_state`, `users_inventory`, `service_settings`, `jobs`, `document_events`.
5. Реализованы endpoints `health`, `version`, `capabilities`, `status`, `providers`, `providers/checks`, `providers/ssl-cache/refresh`, `users/inventory`, `jobs`.
6. Реализована реальная SSL/TLS-проверка panel URL провайдеров через Python `ssl/socket` с сохранением истории и последнего состояния в SQLite.
7. Добавлены `backend/scripts/run-dev.sh`, `backend/scripts/install.sh` и systemd unit template `backend/deploy/ultra-ui-ubuntu-backend.service`.
8. Выполнен локальный синтаксический smoke-check backend-кода через `python3 -m compileall backend/app`.
9. Документация `README`, `CHANGELOG`, `docs/current-status.md`, `docs/next-step.md`, `docs/backend-contract.md`, `docs/project-spec.md`, `TRANSFER_CHAT` и `docs/chat-transfer.md` обновлены под новый backend-контур.

## Шаги v0.6.49 install hotfix
1. Выявлен сбой `backend/scripts/install.sh` на живом сервере: `ULTRA_UI_HOST: unbound variable`.
2. Установлено, что install-flow падал до создания systemd unit, поэтому `ultra-ui-ubuntu-backend.service` не появлялся.
3. Исправлен install-скрипт: unit теперь копируется из `backend/deploy/ultra-ui-ubuntu-backend.service`, а не генерируется через сломанный heredoc.
4. По умолчанию backend теперь публикуется на `0.0.0.0:18090`, чтобы UI видел его по LAN.
5. Добавлена автокоррекция старого env со значением `ULTRA_UI_HOST=127.0.0.1`.
6. Выполнен synthetic install-test: подтверждено создание env, создание service file и отсутствие падения на `set -u`.
7. На живом Ubuntu-хосте подтвержден успешный запуск `ultra-ui-ubuntu-backend.service` и ответы `/api/health`, `/api/version`, `/api/capabilities`, `/api/status`.

## Шаги v0.6.50
1. После живого подключения backend в `Setup` выявлен фронтовой дефект сборки адресов для standalone backend с `secondaryPath=/api`.
2. По экрану `Хосты 3x-ui` подтверждено, что capabilities-запрос и часть Ubuntu API-вызовов уходили в `capabilities-http-404`, хотя backend уже был живой и выбран активным.
3. Добавлена нормализация endpoint-ов: если secondary path уже равен `/api`, фронт больше не дублирует этот префикс при обращении к Ubuntu backend.
4. Исправлены `capabilities`, `providers`, `providerChecks`, `providerSslCacheStatus`, `providerSslCacheRefresh`, `usersInventory`, `status`, `resources`, `services`, `logs`.
5. Обновлены README, transfer-файлы, release log, current-status, change-requests и отдельная заметка hotfix `docs/backend-route-hotfix-v0.6.50.md`.
6. Выполнена локальная проверка логики нормализации endpoint-ов на сценариях `secondaryPath=/api` и `secondaryPath=''`; собран новый релизный архив.
