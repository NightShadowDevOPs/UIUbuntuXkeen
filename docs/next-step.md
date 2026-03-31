# Следующий шаг после v0.6.50

1. Обновить UI до `v0.6.50` на живом хосте через git workflow в `/opt/UIUbuntu/app`.
2. Повторно выполнить `backend/scripts/install.sh`, чтобы backend/runtime и документация были синхронизированы с релизом.
3. В `Setup` оставить активным backend `ubuntu-service` с `secondaryPath=/api`.
4. Проверить экран `Хосты 3x-ui` без fallback-плашки и `capabilities-http-404`.
5. Подтвердить сохранение `Хосты 3x-ui` и `Пользователи` через живой SQLite backend.
6. После подтверждения — идти в следующий backend-блок: `Host`, `Traffic`, `QoS`, `logs`, `resources`.
