# Журнал шагов

Актуально для релиза: **v0.6.47**

## Шаги v0.6.47
1. По живому хосту подтверждено, что `192.168.5.23:9090/cgi-bin/api.sh?...` отвечает `404 page not found` на `capabilities`, `mihomo_providers`, `ssl_cache_refresh` и `users_db_get`.
2. После этого зафиксировано, что server-side backend route на текущем runtime не подключён.
3. В `src/store/backendCapabilities.ts` убран ложный fallback, который включал fake-capabilities даже при отсутствии реального backend route.
4. В `src/store/providerHealth.ts` ошибка capability probing теперь пробрасывается наверх как реальная backend-route ошибка.
5. В `Хосты 3x-ui` и `Пользователи` добавлены предупреждения и честный локальный fallback-режим.
6. Убраны старые package scripts, которые всё ещё ссылались на фантомный `ubuntu-service`.
