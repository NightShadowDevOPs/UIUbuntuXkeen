# База шагов и хода работ

Актуально для релиза: **v0.6.44**

## Выполненные шаги
1. Взята за базу версия `v0.6.43`.
2. Проверен текущий контур проекта: в репозитории уже есть реальные команды `api.sh` — `mihomo_providers`, `ssl_cache_refresh`, `users_db_get`, `users_db_put`.
3. Обновлён compatibility capabilities fallback, чтобы UI видел именно эти реально существующие возможности.
4. В `src/api/ubuntuService.ts` добавлен fallback на существующий Mihomo/api.sh contour вместо ожидания phantom `/api/*` backend-а.
5. Реализовано чтение и сохранение `providerPanelUrls` через shared users DB.
6. Реализовано чтение и сохранение plain LAN inventory и `proxyAccessPolicyMode` через shared users DB с сохранением не-LAN правил.
7. Обновлены документы состояния, релизов и следующего шага.

## Что сознательно не делалось
- не добавлялся новый standalone service;
- не ломался recovery/update path через `mihomo`;
- не применялись server-side firewall/policy изменения для `proxyAccess` без отдельной проверки.
