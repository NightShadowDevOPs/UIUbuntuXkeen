# v0.6.63 — XUI hosts same-origin backend fallback

## Что исправлено

1. Экран `Хосты 3x-ui` больше не зависит только от сохранённого frontend-профиля backend.
2. Если UI открыт на Ubuntu-хосте, страница сначала умеет дочитать `/api/providers` и связанные provider endpoints с текущего origin даже тогда, когда в браузере сохранён старый compatibility backend.
3. `loadRowsFromBackend()` на странице `XuiHostsPage` больше не обрывается ранним выходом только потому, что текущий сохранённый backend профиль не распознан как `ubuntu-service`.
4. Для provider endpoints (`providers`, `checks`, `checks/history`, `checks/run`, `ssl-cache/refresh`) добавлен same-origin fallback, чтобы экран и действия продолжали работать после clean/update сценариев и смены backend профиля.

## Почему список был пустым

Backend и SQLite были заполнены, `/api/providers` возвращал 8 хостов, но фронт мог продолжать жить на старом сохранённом backend-профиле и даже не доходить до same-origin `/api/providers`. В результате страница показывала пустой локальный fallback, несмотря на живой server-side backend.

## Ожидаемое поведение после обновления

- список `Хосты 3x-ui` должен подниматься с текущего Ubuntu-host backend;
- действия проверки сертификатов тоже должны обращаться к same-origin backend, даже если frontend профиль ещё не был вручную пересохранён в Setup.
