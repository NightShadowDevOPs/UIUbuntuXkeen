# UIUbuntuXkeen — Ubuntu backend contract

Актуальная версия документа: **v0.6.48**  
Дата актуализации: **2026-03-31**

## 1. Назначение

Этот документ описывает целевой и уже начатый backend/service слой для Ubuntu-линии **UIUbuntuXkeen**.

Главная идея:
- **прямой Mihomo API** используем там, где Mihomo уже умеет отдавать данные сам;
- **Ubuntu service** используем для системных, scheduled и stateful задач;
- раздел **Хосты 3x-ui** работает со списком панелей 3x-ui и SSL/TLS-статусом этих панелей;
- новый backend запускается **отдельным service**, а не через `/cgi-bin/api.sh`.

## 2. Режимы backend-а

### `compatibility-bridge`
Переходный режим для экранов, которые ещё живут на старом контуре или на прямом Mihomo API.

### `ubuntu-service`
Целевой режим нового продукта.

На `v0.6.48` в репозитории уже реализована первая рабочая версия такого сервиса.

## 3. Каноничные пути

- `MIHOMO_ACTIVE_CONFIG=/etc/mihomo/config.yaml`
- `ULTRA_UI_HOME=/var/lib/ultra-ui-ubuntu`
- `ULTRA_UI_RUNTIME=/var/lib/ultra-ui-ubuntu/runtime`
- `ULTRA_UI_CONFIG_STATE=/var/lib/ultra-ui-ubuntu/config`
- `ULTRA_UI_LOG_DIR=/var/log/ultra-ui-ubuntu`
- `MIHOMO_LOG_FILE=/var/log/mihomo/mihomo.log`
- `ULTRA_UI_AGENT_ENV=/etc/ultra-ui-ubuntu/agent.env`
- default backend listen: `127.0.0.1:18090`

## 4. Базовый endpoint set

### Реализовано в `v0.6.48`
- `GET /api/status`
- `GET /api/health`
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

### Следующие backend-блоки
- `GET /api/system/metrics`
- `GET /api/system/resources`
- `GET /api/system/services`
- `GET /api/system/network`
- `GET /api/system/logs`
- `GET /api/traffic/*`
- `GET /api/qos/*`

## 5. Scheduler / automation model

Service выполняет плановые проверки без участия UI.

Минимум на `v0.6.48`:
- встроенный scheduler loop;
- периодическая проверка SSL/TLS panel URL провайдеров;
- ручной форс-перезапуск проверок через API;
- сохранение job state в SQLite.

Интервал по умолчанию: `14400` секунд.

## 6. Модель хранения данных

Основная база первого этапа: **SQLite**.

Реализованные таблицы:
- `provider_hosts`
- `provider_ssl_checks`
- `provider_ssl_state`
- `users_inventory`
- `service_settings`
- `jobs`
- `document_events`

## 7. Capability flags

Минимальный набор `v0.6.48`:
- `status`
- `health`
- `version`
- `capabilities`
- `providers`
- `providerChecks`
- `providerChecksRun`
- `providerRefresh`
- `providerSslCacheRefresh`
- `providerSslCacheStatus`
- `usersInventory`
- `usersInventoryPut`
- `jobs`

## 8. UX-правило для UI

Если capability нет, UI не должен делать вид, что функция работает.

Если capability есть и backend выбран в `Setup`, UI должен работать с живым server-side state.

Если backend ещё не установлен на сервере, UI остаётся в честном fallback-режиме.
