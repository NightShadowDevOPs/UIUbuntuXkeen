# UIUbuntuXkeen — Ubuntu backend contract

Актуальная версия документа: **v0.6.40**  
Дата актуализации: **2026-03-31**

## 1. Назначение

Этот документ описывает целевой backend/service слой для Ubuntu-линии **UIUbuntuXkeen**.

Главная идея простая:
- **прямой Mihomo API** используем там, где Mihomo уже умеет отдавать данные сам;
- **Ubuntu service** делаем для системных, scheduled и stateful задач;
- раздел **Хосты 3x-ui** работает только со **списком панелей 3x-ui**, а не с общим списком proxy providers из Mihomo-конфига.

Важно: любые упоминания `router-agent` в старых файлах репозитория считаются историческим переходным хвостом и не должны использоваться как каноничное описание backend-а для UIUbuntuXkeen.

## 2. Режимы backend-а

### `compatibility-bridge`
Переходный режим для текущей UI-базы.

Подходит для:
- статуса Mihomo;
- прокси и групп;
- правил и rule-providers;
- соединений;
- части runtime-данных.

### `ubuntu-service`
Целевой режим нового продукта.

Должен обеспечивать:
- host resources;
- логи и сервисы Ubuntu;
- SSL/TLS проверки **панелей 3x-ui** по их panel URL;
- scheduled jobs;
- GEO updates;
- QoS / shaping;
- хранение результатов в SQLite/DB;
- таблицу пользователей `IP / MAC / hostname / proxyAccess`;
- в будущем safe config flow.

## 3. Каноничные пути

- `MIHOMO_ACTIVE_CONFIG=/etc/mihomo/config.yaml`
- `ULTRA_UI_HOME=/var/lib/ultra-ui-ubuntu`
- `ULTRA_UI_RUNTIME=/var/lib/ultra-ui-ubuntu/runtime`
- `ULTRA_UI_CONFIG_STATE=/var/lib/ultra-ui-ubuntu/config`
- `ULTRA_UI_LOG_DIR=/var/log/ultra-ui-ubuntu`
- `MIHOMO_LOG_FILE=/var/log/mihomo/mihomo.log`
- `ULTRA_UI_AGENT_ENV=/etc/ultra-ui-ubuntu/agent.env`

## 4. Базовый endpoint set

### Базовые
- `GET /api/status`
- `GET /api/health`
- `GET /api/version`
- `GET /api/capabilities`

### Провайдеры / 3x-ui hosts
- `GET /api/providers`
- `PUT /api/providers`
- `GET /api/providers/checks`
- `POST /api/providers/checks/run`
- `POST /api/providers/refresh`
- `POST /api/providers/ssl-cache/refresh`
- `GET /api/providers/ssl-cache/status`

### Пользователи
- `GET /api/users/inventory`
- `PUT /api/users/inventory`

### Jobs
- `GET /api/jobs`

## 5. Scheduler / automation model

Service должен уметь выполнять плановые проверки без участия UI.

Минимум нужны фоновые задачи:
- проверка SSL/TLS **панелей 3x-ui** по расписанию;
- refresh SSL cache/state;
- housekeeping старых записей.

Предпочтительный вариант для MVP: **встроенный scheduler + systemd unit для service**.

## 6. Модель хранения данных

Предпочтительная база на первом этапе: **SQLite**.

Минимальные таблицы:
- `provider_hosts`
- `provider_ssl_checks`
- `provider_ssl_state`
- `users_inventory`
- `service_settings`
- `jobs`
- `document_events`

### Что хранить в `provider_ssl_checks`
- provider id / name
- panel_url
- checked_at
- status
- expires_at
- days_left
- issuer
- subject
- san
- error_text
- raw_payload

### Что хранить в `users_inventory`
- ip
- mac
- display_name
- hostname
- source
- proxy_access
- updated_at

## 7. Capability flags

UI должен запрашивать capabilities и не рисовать фальшивую готовность. Для MVP `v0.6.39` минимальный набор:
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

## 8. UX-правило для UI

Если capability нет, UI не должен делать вид, что функция работает. Он должен честно показывать одно из состояний:
- функция доступна и данные живые;
- функция будет доступна после подключения Ubuntu service;
- функция в проекте запланирована, но backend capability пока отсутствует.
