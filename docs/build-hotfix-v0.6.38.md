# v0.6.38 — Ubuntu wording cleanup, separate 3x-ui hosts workspace, document DB journals

Что исправлено:
- страница **Хосты 3x-ui** больше не объясняет SSL-контур через `router-agent`;
- каноничный backend для этой страницы описан через Ubuntu backend contract (`/api/providers/checks`, `/api/providers/checks/run`, `/api/providers/ssl-cache/status`, `/api/providers/ssl-cache/refresh`);
- раздел **Хосты 3x-ui** остаётся отдельным workspace только для адресов панелей 3x-ui;
- вкладка **Пользователи** закреплена как отдельный раздел меню;
- в `docs/` добавлены журналы document DB для запросов и шагов.
