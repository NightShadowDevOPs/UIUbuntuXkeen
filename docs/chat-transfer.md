Prepared release: v0.6.43. This is a stability/audit release on top of the recovered v0.6.41 baseline and the cleaned v0.6.42 distribution. The project runtime contour is now documented explicitly: UI is served by Mihomo, `/ui/` opens `Overview` first, and no phantom standalone service is bundled.

Актуальный релиз для переноса: **v0.6.43**

Что сделано в `v0.6.43`
- корневой маршрут UI переведён на `Overview`, чтобы старт UI не зависел от страницы `Proxies`;
- зафиксирован реальный runtime contour проекта: `mihomo.service` обслуживает UI, recovery делается удалением папки UI и повторным стартом `mihomo`;
- `Хосты 3x-ui` и `Пользователи` сохранены как отдельные разделы UI, но без ложных утверждений о наличии отдельного service на сервере;
- добавлен документ аудита backend-контура и зафиксирован следующий безопасный шаг.

Что важно помнить
- не придумывать отдельный server-side service, если он не существует в реальном runtime проекта;
- перед любыми backend-изменениями сначала сверять фактический контур `mihomo` / `/etc/mihomo/uiubuntu`;
- recovery/update path подтверждён пользователем: остановить `mihomo`, удалить папку UI, запустить `mihomo` снова;
- все запросы и шаги фиксируются в docs.

Следующий безопасный шаг
- отдельно разобрать существующий server-side contour (`api.sh`, capability probing, storage expectations) и только после этого подключать реальное хранение для `3x-ui Hosts` и `Users`.
