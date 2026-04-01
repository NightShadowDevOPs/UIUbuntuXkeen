## Шаги v0.6.58
1. После live-проверки `v0.6.57` подтверждено, что `Хосты 3x-ui` не отправляют backend POST actions: в `journalctl` есть только `GET /api/providers/checks`, но нет `POST /api/providers/checks/run` / `POST /api/providers/ssl-cache/refresh`.
2. Зафиксирована корневая причина: frontend helper `ubuntuEndpoint()` возвращал относительный путь `/api/...`, поэтому axios на `ubuntu-service` бился в origin Mihomo UI вместо standalone backend `http://host:18090/api/...`.
3. Для `ubuntu-service` `ubuntuEndpoint()` переведён на `getUrlFromBackendEndpoint()`, а `Хосты 3x-ui` теперь сразу считает выбранный standalone backend provider-capable и делает свежий capability probe при открытии страницы.
4. Версии и release docs обновлены до `v0.6.58`, архивы будут упакованы без `.git/`.

## 2026-04-01 — v0.6.56 provider SSL poller
- закреплён рабочий SSL warning threshold по умолчанию: 2 дня;
- backend poller теперь запускается не только по TTL, но и при отсутствии SSL state / смене panel URL;
- `Хосты 3x-ui` после сохранения списка хостов теперь сразу инициирует SSL refresh, чтобы информация о сертификате появлялась без ручного ожидания;
- в backend и UI добавлены поля `valid_from`, `fingerprint_sha256`, `verify_error`.

- 2026-04-01 — v0.6.55: added provider SSL history/details for `ubuntu-service`, including `/api/providers/checks/history`, days-left/status fields, and richer `Хосты 3x-ui` diagnostics in UI.
# Журнал шагов

Актуально для релиза: **v0.6.53**

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

## Шаги v0.6.51
1. После живого подключения backend в `Setup` выявлен фронтовой дефект сборки адресов для standalone backend с `secondaryPath=/api`.
2. По экрану `Хосты 3x-ui` подтверждено, что capabilities-запрос и часть Ubuntu API-вызовов уходили в `capabilities-http-404`, хотя backend уже был живой и выбран активным.
3. Добавлена нормализация endpoint-ов: если secondary path уже равен `/api`, фронт больше не дублирует этот префикс при обращении к Ubuntu backend.
4. Исправлены `capabilities`, `providers`, `providerChecks`, `providerSslCacheStatus`, `providerSslCacheRefresh`, `usersInventory`, `status`, `resources`, `services`, `logs`.
5. Обновлены README, transfer-файлы, release log, current-status, change-requests и отдельная заметка hotfix `docs/backend-route-hotfix-v0.6.51.md`.
6. Выполнена локальная проверка логики нормализации endpoint-ов на сценариях `secondaryPath=/api` и `secondaryPath=''`; собран новый релизный архив.

## Шаги v0.6.52
1. После подтверждения живого backend-контура пользователь закрепил, что рабочий режим — именно `ubuntu-service`, и следующий шаг — не переключение назад, а развитие server-side действий прямо из UI.
2. На экране `Хосты 3x-ui` кнопка одного общего действия разделена на два явных сценария: `Проверить сейчас` и `Обновить SSL-кэш`.
3. Те же два действия вынесены и в карточку SSL-провайдеров, чтобы server-side операции были доступны не только с одного экрана.
4. В статусные бейджи `Хосты 3x-ui` добавлены ближайшая проверка и состояние последнего job.
5. `backend/scripts/install.sh` изменён так, чтобы обновление backend не оставляло в памяти старый процесс: если сервис уже запущен, скрипт теперь делает явный `systemctl restart`.
6. Обновлены README, current-status, transfer-файлы, changelog, request log и отдельная заметка `docs/backend-ssl-actions-v0.6.52.md`.

## Шаги v0.6.53
1. После живого переключения на `ubuntu-service` пользователь подтвердил, что диаграмма трафика в UI перестаёт работать, хотя backend для settings/providers уже подключён.
2. По live-логам backend установлено, что UI пытается открыть WebSocket-маршруты `/api/traffic`, `/api/memory`, `/api/connections`, `/api/logs`, а backend отвечает `403`, потому что realtime-контур ещё не реализован.
3. В standalone backend добавлен модуль realtime sampler: чтение памяти из `/proc/meminfo`, суммарного трафика из `/proc/net/dev` и best-effort списка активных соединений через `ss -tunH`.
4. В `backend/app/main.py` добавлены WebSocket endpoints и совместимые alias-пути для `traffic`, `memory`, `connections`, `logs`.
5. В capability payload backend добавлены `connections` и `logs`, чтобы live Ubuntu contour честно заявлял эти возможности.
6. Выполнен локальный smoke-check: `python -m uvicorn app.main:app`, HTTP `/api/version`, `/api/capabilities`, WebSocket-подключения к `/api/traffic`, `/api/memory`, `/api/connections` подтвердили, что backend теперь отдаёт live payload вместо `403`.
7. Обновлены CHANGELOG, current-status, releases, transfer-файлы, request log и отдельная заметка `docs/backend-realtime-v0.6.53.md`.

- 2026-04-01 — v0.6.54: added Mihomo bridge routes for configs/proxies/providers/rules and switched ubuntu-service `/api/connections` to relay the real Mihomo WebSocket when available.

## Шаги v0.6.57
1. После live-проверки `v0.6.56` подтверждено, что список 3x-ui host загружается, но кнопка `Проверить сейчас` не доводит SSL flow до результата, а `Обновить SSL-кэш` блокируется ложным `capability-missing`.
2. По коду и поведению экрана установлено две причины: фронт слишком жёстко блокировал действия capability-флагами, а backend action `run_provider_checks` выполнялся как один длинный HTTP request и мог упираться в timeout на обходе нескольких 3x-ui host.
3. В backend добавлен неблокирующий запуск SSL job через `start_provider_checks`, который стартует проверку в фоне и сразу возвращает payload текущего состояния job/cache.
4. В frontend store provider health ослаблен capability gating для активного `ubuntu-service`, чтобы экран не уходил в ложный `capability-missing`, если standalone backend уже выбран и жив.
5. Добавлен polling завершения provider SSL refresh job: после запуска `Проверить сейчас` и `Обновить SSL-кэш` экран сам опрашивает backend до завершения job и затем обновляет строки/детали.
