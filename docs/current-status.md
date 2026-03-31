Current prepared release: v0.6.47. The current Ubuntu host is confirmed to run the UI inside Mihomo, but it does not expose a working server-side route for `/cgi-bin/api.sh`, so backend-driven `3x-ui Hosts` / `Users` features must remain in honest local fallback mode until a real runtime endpoint exists.

## Обновление v0.6.47
- подтверждено реальным запросом к хосту `192.168.5.23:9090`, что `/cgi-bin/api.sh?cmd=capabilities`, `/cgi-bin/api.sh?cmd=mihomo_providers`, `/cgi-bin/api.sh?cmd=ssl_cache_refresh` и `/cgi-bin/api.sh?cmd=users_db_get` возвращают `404 page not found`; это значит, что текущий backend route не поднят
- capability-store UI больше не включает фальшивый compatibility-bridge fallback при отсутствии backend route
- `Хосты 3x-ui` и `Пользователи` теперь работают в честном локальном режиме и явно показывают предупреждение о недоступном backend route
- `api.sh` как файл в репозитории остаётся историческим/переходным контуром, но не считается активным runtime endpoint на текущем сервере, пока это не подтверждено отдельно

## Что сейчас точно есть
- UI раздаётся самим `mihomo`
- папка UI на сервере: `/etc/mihomo/uiubuntu`
- recovery: остановить `mihomo` -> удалить папку UI -> запустить `mihomo` -> `mihomo` снова скачает UI из репозитория

## Чего сейчас нет
- рабочего route `/cgi-bin/api.sh` на текущем хосте
- живого backend для SSL-проверок `3x-ui Hosts`
- подтверждённого server-side хранилища Users inventory на этом хосте
