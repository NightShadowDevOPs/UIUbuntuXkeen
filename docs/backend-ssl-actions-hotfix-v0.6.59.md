# UIUbuntuXkeen v0.6.59 — provider SSL actions hotfix

## Что сломано до фикса

После `v0.6.58` standalone Ubuntu backend уже отвечал на `GET /api/capabilities`, `GET /api/configs`, `GET /api/proxies`, `GET /api/providers/proxies`, `GET /api/rules`, а realtime/websocket contour тоже был жив. Но `Хосты 3x-ui` всё ещё не запускали backend SSL actions: в `journalctl` не было `POST /api/providers/checks/run` и `POST /api/providers/ssl-cache/refresh`.

## Причина

Экран всё ещё зависел от stale store-gating из provider health state. Из-за этого page runtime мог продолжать считать SSL actions недоступными даже при живом `ubuntu-service` и успешном `GET /api/capabilities`.

## Что изменено

- Для `ubuntu-service` page runtime теперь считает provider SSL actions доступными напрямую.
- Ложный badge `capability-missing` скрывается, если backend capabilities уже отвечают успешно.
- `Проверить сейчас` и `Обновить SSL-кэш` на странице сами:
  1. форсят refresh capabilities;
  2. вызывают backend action endpoint;
  3. ждут завершения job опросом provider state;
  4. обновляют строки хостов и SSL-детали.

## Что проверить после обновления

1. В `Setup` активен backend `ubuntu-service`.
2. На `Хосты 3x-ui` badge `capability-missing` больше не висит.
3. После нажатия **Проверить сейчас** в `journalctl -u ultra-ui-ubuntu-backend` появляются `POST /api/providers/checks/run`.
4. После нажатия **Обновить SSL-кэш** появляются `POST /api/providers/ssl-cache/refresh`.
5. После завершения action в строках и `SSL-детали` появляются реальные certificate fields вместо вечного `Нет данных`.
