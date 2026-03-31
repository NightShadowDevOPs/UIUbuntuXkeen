Prepared release: v0.6.47. This release is a stabilizing honesty fix: the UI no longer fakes a working backend when the current Ubuntu host does not expose `/api/capabilities` or `/cgi-bin/api.sh`. `3x-ui Hosts` and `Users` now fall back to local UI data and show an explicit warning instead of a misleading network-driven pseudo-state.

Актуальный релиз для переноса: **v0.6.47**

Что сделано в `v0.6.47`
- подтверждено по живому хосту, что `http://192.168.5.23:9090/cgi-bin/api.sh?...` сейчас отвечает `404 page not found`; значит server-side backend route в текущем runtime не подключён
- убран ложный capability fallback: если `/api/capabilities` и `cgi-bin/api.sh?cmd=capabilities` отсутствуют, UI больше не включает фальшивые backend-возможности
- `Хосты 3x-ui` теперь честно переходят в локальный fallback-режим и показывают предупреждение о недоступном backend route
- `Пользователи` делают то же самое, не изображая подключённую server-side БД
- в package.json убраны старые scripts `backend:dev` и `backend:smoke`, которые тянули фантомный `ubuntu-service`

Что подтверждено по серверу
- UI обслуживается самим `mihomo`
- текущая папка UI на сервере: `/etc/mihomo/uiubuntu`
- аварийное восстановление работает штатно через перезапуск `mihomo` с удалением папки UI
- route `/cgi-bin/api.sh` на текущем хосте **не активен** и возвращает `404 page not found`

Что делать дальше
1. Не строить новые UI-зависимости на `api.sh`, пока на сервере реально не появится рабочий route.
2. Если нужен настоящий backend для `3x-ui Hosts` / `Users`, сначала определить, где он должен жить в реальном runtime Mihomo на Ubuntu.
3. После появления реального server-side route — только тогда включать живую SSL-проверку и shared DB режим.

[Update v0.6.47]
