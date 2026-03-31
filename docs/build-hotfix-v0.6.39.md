# ОТМЕНЕНО В v0.6.40

Этот документ сохранён только как след ошибочной ветки v0.6.39. Отдельный `ubuntu-service/` был удалён из дистрибутива в v0.6.40.

# v0.6.39 — Ubuntu service MVP for 3x-ui hosts and users inventory

Ключевой смысл релиза: перестать держать SSL/TLS checks и users inventory только как UI-обещание и добавить реальный Ubuntu backend в сам репозиторий.

Что закрыто:
- backend `ubuntu-service/` добавлен в проект;
- есть SQLite для panel hosts, SSL history/state и users inventory;
- ручная и автоматическая (4 часа) SSL-проверка панелей 3x-ui выполняется на backend-е;
- UI страницы **Хосты 3x-ui** и **Пользователи** умеют читать/писать через Ubuntu backend APIs.

Что остаётся следующим шагом:
- подключить service на живом Ubuntu-хосте;
- довести server-side применение proxy access policy до Ubuntu without router commands;
- расширить host resources / logs / QoS части контракта.
