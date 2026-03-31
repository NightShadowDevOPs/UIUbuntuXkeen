# UIUbuntuXkeen v0.6.43 — smoke checklist

Проверить после выкладки:
1. `/ui/` открывается и попадает на `Overview`, а не на `Proxies`.
2. Боковое меню открывает `Overview`, `Traffic`, `Connections`, `Logs`, `Proxies`, `Хосты 3x-ui`, `Пользователи`, `Settings`.
3. Recovery path через `mihomo` не изменён.
4. Кнопка обновления UI в панели работает штатно.
5. Страницы `Хосты 3x-ui` и `Пользователи` открываются и не ломают старт UI, даже если server-side `/api/*` endpoints недоступны.
