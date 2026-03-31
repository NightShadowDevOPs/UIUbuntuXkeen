# Следующий шаг после v0.6.49

1. Поставить backend на живой Ubuntu-хост через `backend/scripts/install.sh`.
2. Проверить `systemctl status ultra-ui-ubuntu-backend` и `curl http://127.0.0.1:18090/api/health`.
3. В `Setup` добавить и выбрать backend `http://<IP_хоста>:18090` как `ubuntu-service`.
4. Проверить сохранение `Хосты 3x-ui` и `Пользователи` уже через SQLite backend, а не через локальный fallback UI.
5. После подтверждения запуска — расширять backend на `Host`, `Traffic`, `QoS`, `logs`, `resources`.
