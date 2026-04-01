# Current status — v0.6.60

- Main runtime stays on **`ubuntu-service`**.
- Server deploy workflow stays on **`git fetch origin --prune && git reset --hard origin/main`**.
- `3x-ui Hosts` now restore provider rows into backend storage automatically when `/api/providers` comes back empty but local/users-db fallback still has known hosts.
- Legacy status polling for pages that still called `agentStatusAPI()` is bridged to `/api/status` while `ubuntu-service` is active, instead of treating `:9099/cgi-bin/api.sh?cmd=status` as the primary route.

Current prepared release: v0.6.59. The standalone Ubuntu backend stays on `ubuntu-service`; this hotfix removes the stale provider SSL gating in `Хосты 3x-ui` and sends SSL actions directly to the backend action endpoints from the page runtime.

## Обновление v0.6.59
- после live-проверки `v0.6.58` подтверждено, что кнопки `Проверить сейчас` / `Обновить SSL-кэш` так и не доходили до backend: в `journalctl` были только `GET /api/capabilities`, `GET /api/configs`, `GET /api/proxies`, `GET /api/providers/proxies`, `GET /api/rules`, но не было `POST /api/providers/checks/run` или `POST /api/providers/ssl-cache/refresh`;
- `Хосты 3x-ui` теперь не полагаются на застрявший `providerHealth` gating для активного `ubuntu-service`: page runtime сам обновляет capabilities, запускает backend action endpoint и потом опрашивает provider state до завершения job;
- ложный badge `capability-missing` для активного `ubuntu-service` скрыт, если backend capabilities уже отвечают `200 OK`;
- после завершения SSL action UI перечитывает строки хостов и `SSL-детали` без ручного перезахода на экран.

Current prepared release: v0.6.58. The standalone Ubuntu backend is already confirmed on the live host: `ultra-ui-ubuntu-backend.service` is running, `GET /api/health` responds, and the backend is selected in `Setup` as `ubuntu-service`.

## Обновление v0.6.58
- после live-проверки `v0.6.57` подтверждено, что блок `Хосты 3x-ui` всё ещё не запускал реальные SSL actions: в логах backend не было `POST /api/providers/checks/run` и `POST /api/providers/ssl-cache/refresh`, а кнопки фактически упирались в ложный `capability-missing`;
- причина зафиксирована: frontend-клиент `ubuntuService` ходил по относительным `/api/...` путям и попадал в origin Mihomo UI, а не в standalone backend `ubuntu-service`;
- `v0.6.58` переводит provider SSL REST calls на полный backend origin `http(s)://host:port/api/...`, форсирует свежий capability probe при открытии страницы и убирает самоблокировку `Хосты 3x-ui` для активного `ubuntu-service`.

## Обновление v0.6.56
- для `ubuntu-service` включён реальный SSL poller по 3x-ui host: после сохранения списка хостов UI сразу инициирует обновление SSL-кеша, а scheduler backend теперь считает проверку обязательной не только по интервалу, но и при отсутствии state/изменении panel URL;
- порог предупреждения по SSL закреплён по умолчанию как **2 дня** (`ULTRA_UI_SSL_WARN_DAYS=2`), что соответствует короткоживущим IP-сертификатам на 6 дней и даёт ранний сигнал до потери подписки;
- backend теперь сохраняет и отдаёт больше информации о сертификате: `valid_from`, `expires_at`, `days_left`, `issuer`, `subject`, `SAN`, `fingerprint_sha256`, `verify_error`;
- на экране `Хосты 3x-ui` карточка деталей сертификата расширена: окно действия сертификата, SHA-256 fingerprint и диагностика TLS-проверки цепочки;

## Обновление v0.6.55
- после стабилизации `ubuntu-service` на живом хосте следующий практический шаг перенесён в блок Providers / SSL: на экран `Хосты 3x-ui` добавлены фильтр, режим `только проблемные`, панель детальной диагностики и история последних SSL-проверок по каждому провайдеру;
- standalone backend теперь отдаёт `/api/providers/checks/history` из SQLite истории `provider_ssl_checks`, а также расширяет основной payload полями `panelSslDaysLeft` и `panelSslStatus`;
- серверный workflow обновления закреплён как `git fetch origin --prune && git reset --hard origin/main` для deploy-checkout в `/opt/UIUbuntu/app`, без возврата к `git pull --ff-only`;

## Обновление v0.6.52
- подтверждено, что backend `ubuntu-service` остаётся рабочим активным режимом в `Setup`
- подтверждено, что `capabilities` и `3x-ui Hosts` больше не падают в fallback после live-подключения backend
- на экран `Хосты 3x-ui` добавлены отдельные действия `Проверить сейчас` и `Обновить SSL-кэш`
- `backend/scripts/install.sh` теперь явно перезапускает сервис после обновления файлов, чтобы новая версия backend сразу отвечала без ручного `systemctl restart`


## Обновление v0.6.53
- подтверждён следующий реальный хвост backend-контура: на `ubuntu-service` UI терял realtime-каналы (`traffic`, `memory`, `connections`, `logs`) и диаграммы уходили в пустоту из-за `403` на WebSocket-маршрутах
- в standalone backend добавлены WebSocket endpoints `/api/traffic`, `/api/memory`, `/api/connections`, `/api/logs` и совместимые alias-пути
- backend теперь отдаёт базовую live-телеметрию хоста: память из `/proc/meminfo`, суммарный трафик из `/proc/net/dev`, best-effort список активных соединений через `ss -tunH`
- режим `ubuntu-service` сохраняется как основной; следующий live-check — подтвердить, что диаграмма трафика и overview-виджеты снова двигаются без возврата на `direct`


## Обновление v0.6.54
- подтверждён следующий реальный хвост `ubuntu-service`: realtime websocket-каналы уже открывались, но `Обзор / Топология соединений` всё ещё не видел реальные клиенты и прокси-цепочки, потому что backend не проксировал базовые Mihomo endpoints (`/configs`, `/proxies`, `/providers/proxies`, `/rules`) и отдавал только локальный host-side snapshot;
- в standalone backend добавлен bridge к локальному Mihomo controller: `GET /api/configs`, `GET /api/proxies`, `GET /api/providers/proxies`, `GET /api/providers/rules`, `GET /api/rules`;
- websocket `/api/connections` на `ubuntu-service` теперь пытается relay-ить настоящий поток Mihomo connections, чтобы `Обзор` и диаграммы видели реальные хосты, правила и прокси-цепочки, а не только сам Ubuntu-хост;
- backend автоматически читает `external-controller` и `secret` из `MIHOMO_ACTIVE_CONFIG` (`/etc/mihomo/config.yaml`) или использует env overrides `MIHOMO_CONTROLLER_URL` / `MIHOMO_CONTROLLER_SECRET`;

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
- следующий live-check: подтвердить realtime-диаграммы и поведение websocket-каналов на `ubuntu-service`
- после этого идти в backend-блок `Host / resources / services / logs` глубже, уже без возврата к setup/runtime-fix этапу

## Обновление v0.6.57
- после `v0.6.56` подтвержден живой дефект: на `Хосты 3x-ui` кнопка `Проверить сейчас` не давала рабочего server-side опроса, `Обновить SSL-кэш` блокировалась ложным `capability-missing`, а при длинном SSL обходе backend action упирался в HTTP timeout;
- `v0.6.57` переводит server-side SSL actions в асинхронный запуск job, а фронт теперь ждёт завершения проверки опросом статуса backend вместо ожидания одного длинного ответа;
- на `ubuntu-service` capability gating для provider SSL действий ослаблен: если выбран standalone backend, экран больше не должен сам себя блокировать ошибкой `capability-missing`.
