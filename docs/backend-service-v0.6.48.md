# v0.6.48 — standalone Ubuntu backend service MVP

## Что добавлено

В релизе `v0.6.48` проект получает **реальный отдельный backend/service**, лежащий в каталоге `backend/`.

Стек MVP:
- FastAPI
- SQLite
- встроенный scheduler loop
- stdlib TLS probe через `ssl` / `socket`
- systemd service deployment

## Что backend уже умеет

- хранить `3x-ui Hosts`
- хранить `Users inventory`
- хранить `jobs`
- выполнять SSL/TLS-проверку panel URL провайдеров
- возвращать capabilities для UI

## Реализованные endpoints

- `GET /api/health`
- `GET /api/status`
- `GET /api/version`
- `GET /api/capabilities`
- `GET /api/providers`
- `PUT /api/providers`
- `GET /api/providers/checks`
- `POST /api/providers/checks/run`
- `POST /api/providers/refresh`
- `POST /api/providers/ssl-cache/refresh`
- `GET /api/providers/ssl-cache/status`
- `GET /api/users/inventory`
- `PUT /api/users/inventory`
- `GET /api/jobs`

## Как ставится

Backend ставится **отдельно от UI**:
- UI остаётся под `mihomo`
- backend запускается как `ultra-ui-ubuntu-backend.service`
- UI подключается к нему через `Setup`, например `http://192.168.5.23:18090`

## Что ещё не закрыто этим MVP

- host metrics/resources/services/logs
- traffic endpoints
- qos/shaping endpoints
- server-side policy enforcement beyond inventory storage
