# Backend route absence audit v0.6.47

## Подтверждено на живом хосте
Запросы к:
- `/cgi-bin/api.sh?cmd=capabilities`
- `/cgi-bin/api.sh?cmd=mihomo_providers`
- `/cgi-bin/api.sh?cmd=ssl_cache_refresh`
- `/cgi-bin/api.sh?cmd=users_db_get`

на `http://192.168.5.23:9090` возвращают `404 page not found`.

## Вывод
На текущем Ubuntu-хосте `api.sh` не является активным runtime endpoint, даже если файл присутствует в репозитории проекта. Поэтому UI не должен включать backend-возможности автоматически и обязан честно работать в локальном fallback-режиме.
