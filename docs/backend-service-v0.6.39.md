# ОТМЕНЕНО В v0.6.40

Этот документ сохранён только как след ошибочной ветки v0.6.39. Отдельный `ubuntu-service/` был удалён из дистрибутива в v0.6.40.

# v0.6.39 — Ubuntu backend service MVP

## Что добавлено

В релизе `v0.6.39` проект впервые получает **реальный Ubuntu backend/service**, лежащий прямо в репозитории: `ubuntu-service/`.

Стек MVP:
- FastAPI
- SQLite
- встроенный scheduler thread
- stdlib TLS probe через `ssl` / `socket`

## Что хранится в SQLite

- `provider_hosts` — список 3x-ui panel hosts;
- `provider_ssl_checks` — история проверок сертификатов;
- `provider_ssl_state` — последнее известное состояние сертификата по каждому хосту;
- `users_inventory` — таблица `IP / MAC / display_name / hostname / source / proxyAccess`;
- `service_settings` — policy mode и служебные настройки;
- `jobs` — состояние job `provider_ssl_checks`;
- `document_events` — служебный журнал backend-а.

## Реализованные endpoint'ы

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

## Автопроверка сертификатов

- Интервал по умолчанию: `14400` секунд (4 часа).
- Хранится в `ULTRA_UI_UBUNTU_SSL_INTERVAL_SECS`.
- Ручной запуск доступен через UI и API.

## Что ещё не закрыто этим MVP

- серверное применение proxy access policy на Ubuntu-хосте без роутерных команд;
- system resources / logs / QoS / shaping в полном объёме;
- полноценный install/deploy flow для service на сервере.
