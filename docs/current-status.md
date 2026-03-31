Current prepared release: v0.6.36. Build UI is fixed, and the current step restores visible provider SSL control plus DB-backed proxy access management.

# Текущий статус — v0.6.36

- Текущая линия: **v0.6.36**
- Подтверждённо рабочий пользователем релиз: **v0.2.10**
- Подготовленный релиз: **v0.6.36**

## Что исправлено и добавлено
- сохранён build-fix против stale transpiled `src/*.js`;
- SSL-провайдеры снова видны на странице **Провайдеры**;
- снимок SSL-проверок и время последнего обновления сохраняются в **shared users DB**;
- добавлена таблица LAN-пользователей с полями `IP / MAC / hostname / source / proxyAccess`;
- добавлен режим фильтрации доступа к proxy: `allow all` / `allow-list only`;
- блокировка применяется только к proxy-портам Mihomo;
- bundled agent расширен командами `blockipports` / `unblockipports`.

## Следующая проверка
- Убедиться, что список SSL-провайдеров снова виден на странице **Провайдеры**.
- Проверить ручной запуск SSL-проверки.
- Проверить сохранение LAN-хостов и имён в таблице пользователей.
- Проверить режим `allow-list only` на реальных клиентах.
