# UIUbuntuXkeen — Ubuntu backend contract

Актуальная версия документа: **v0.6.0**  
Дата актуализации: **2026-03-30**

## 1. Назначение

Этот документ описывает целевой backend/service слой для Ubuntu-линии **UIUbuntuXkeen**.

Главная идея простая:
- **прямой Mihomo API** используем там, где Mihomo уже умеет отдавать данные сам;
- **Ubuntu service** делаем для системных, scheduled и stateful задач, которые раньше были завязаны на `router-agent`.

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
- SSL/TLS проверки провайдеров;
- scheduled jobs;
- GEO updates;
- QoS / shaping;
- хранение результатов в SQLite/DB;
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

### Система / хост
- `GET /api/system/metrics`
- `GET /api/system/resources`
- `GET /api/system/services`
- `GET /api/system/logs?source=mihomo|service&tail=...`
- `GET /api/system/network`

### Провайдеры
- `GET /api/providers`
- `GET /api/providers/<built-in function id>`
- `GET /api/providers/checks`
- `POST /api/providers/checks/run`
- `POST /api/providers/refresh`
- `POST /api/providers/ssl-cache/refresh`
- `GET /api/providers/ssl-cache/status`

### GEO
- `GET /api/geo/info`
- `POST /api/geo/update`
- `GET /api/geo/history`

### Трафик / клиенты
- `GET /api/traffic/overview`
- `GET /api/traffic/clients`
- `GET /api/traffic/clients/<built-in function id>`
- `GET /api/traffic/topology`

### QoS / shaping
- `GET /api/qos/status`
- `POST /api/qos/set`
- `POST /api/qos/remove`
- `POST /api/shape/set`
- `POST /api/shape/remove`

### Jobs
- `GET /api/jobs`
- `GET /api/jobs/<built-in function id>`
- `POST /api/jobs/<built-in function id>/retry`

### Safe config flow (позже)
- `GET /api/mihomo/config/active`
- `GET /api/mihomo/config/draft`
- `GET /api/mihomo/config/history`
- `POST /api/mihomo/config/validate`
- `POST /api/mihomo/config/apply`
- `POST /api/mihomo/config/rollback`

## 5. Scheduler / automation model

Service должен уметь выполнять плановые проверки без участия UI.

Минимум нужны фоновые задачи:
- проверка SSL/TLS провайдеров по расписанию;
- refresh SSL cache;
- GEO update;
- host resource snapshots;
- сбор runtime snapshots по клиентам;
- housekeeping старых записей.

Scheduler может быть:
- встроенным в FastAPI service;
- либо поддерживаться через `systemd` timer как внешний trigger.

Предпочтительный вариант для MVP: **встроенный scheduler + systemd unit для service**.

## 6. Модель хранения данных

Предпочтительная база на первом этапе: **SQLite**.

Минимальные таблицы:
- `providers`
- `provider_ssl_checks`
- `provider_refresh_jobs`
- `provider_ssl_cache`
- `geo_updates`
- `host_resource_snapshots`
- `client_runtime_snapshots`
- `qos_rules`
- `shape_rules`
- `job_runs`

### Что хранить в `provider_ssl_checks`
- provider id / name
- url
- checked_at
- status
- expires_at
- days_left
- issuer
- subject
- san
- error_text
- raw_payload

### Что хранить в `geo_updates`
- kind (`geoip`, `geosite`, `asn`)
- started_at
- finished_at
- status
- source
- path
- size
- error_text

### Что хранить в `client_runtime_snapshots`
- client identity (ip/mac/hostname/source)
- traffic in/out
- connection count
- via (`mihomo`, `bypass`, `vpn`, `tunnel`)
- qos profile
- shape state
- captured_at

## 7. Capability flags

UI должен запрашивать capabilities и не рисовать фальшивую готовность. В релизе v0.6.0 UI уже использует эти capability для рабочего SSL/TLS workspace провайдеров, а не только для скрытых технических флагов.

Минимальные capability keys:
- `system.metrics`
- `system.logs`
- `system.services`
- `providers.sslChecks`
- `providers.sslCacheRefresh`
- `providers.refresh`
- `geo.info`
- `geo.update`
- `traffic.clients`
- `traffic.topology`
- `qos.status`
- `qos.set`
- `shape.set`
- `shape.remove`
- `mihomo.configFlow`

## 8. Что идёт напрямую в Mihomo

Без Ubuntu service UI может и должен читать напрямую:
- прокси;
- proxy groups;
- rules;
- rule providers;
- connections;
- часть overview/runtime-данных.

Это **не** должно смешиваться с системными Ubuntu-функциями.

## 9. Что обязан делать Ubuntu service

Без Ubuntu service нельзя считать закрытыми такие функции:
- провайдеры и SSL/TLS проверки по расписанию;
- ручные действия `Обновить` и `Обновить SSL-кеш`;
- GEO update state и history;
- ресурсы хоста;
- QoS / shaping;
- runtime state клиентов на уровне хоста;
- запись результата в БД;
- jobs/status/history.

## 10. UX-правило для UI

Если capability нет, UI не должен делать вид, что функция работает. Он должен честно показывать одно из состояний:
- функция доступна и данные живые;
- функция будет доступна после подключения Ubuntu service;
- функция в проекте запланирована, но backend capability пока отсутствует.
