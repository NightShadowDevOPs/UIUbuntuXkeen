# Provider SSL history and details — v0.6.55

Что сделано:
- backend endpoint `GET /api/providers/checks/history` отдаёт последние записи из `provider_ssl_checks`;
- основной payload `/api/providers/checks` расширен полями `panelSslDaysLeft` и `panelSslStatus`;
- на экране `Хосты 3x-ui` добавлены фильтр, режим `только проблемные`, детальная карточка провайдера и таблица истории проверок.

Проверка после обновления:
1. Открыть `Хосты 3x-ui`.
2. Нажать `Детали` у нужного хоста.
3. Убедиться, что видны issuer / subject / SAN / последняя ошибка и история последних проверок.
4. Если обновление backend делается на сервере, использовать workflow `git fetch origin --prune && git reset --hard origin/main`.
