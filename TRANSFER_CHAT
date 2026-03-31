Prepared release: v0.6.36. Build UI is already fixed by the previous cleanup, and this release continues with provider SSL visibility, shared DB state and proxy access control.

31.03.2026 UIUbuntuXkeen — сообщение для нового чата (вставь целиком)

Проект: UIUbuntuXkeen
Репозиторий: NightShadowDevOPs/UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.36**

Что важно помнить

- Это отдельный Ubuntu/host-проект, его нельзя смешивать с роутерной линией UltraUIXkeen / Netcraze.
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**.
- Линия после ошибочного `v0.6.17` возвращена к модели **статический frontend UI + выбранный backend через Setup**.
- Автоматическую проверку SSL-сертификатов прокси-провайдеров нельзя ломать.

Что сделано в `v0.6.36`
- Build-fix из `v0.6.35` сохранён: stale transpiled `src/*.js` больше не перекрывают `.ts` / `.tsx`.
- На страницу **Провайдеры** возвращён видимый блок SSL-проверок провайдеров.
- Снимок SSL-провайдеров, время проверки и состояние кеша сохраняются в **shared users DB**.
- Добавлена таблица LAN-пользователей с хранением **IP / MAC / hostname / source / proxyAccess**.
- Добавлен режим доступа к proxy: **allow all** или **allow-list only**.
- Ограничение применяется только к **proxy-портам Mihomo**, а не ко всему трафику устройства.
- В bundled agent добавлены `blockipports` / `unblockipports`, а также восстановление таких правил после рестарта.
- Версия bundled agent поднята до **0.6.23** в `api.sh` и `router-agent/install.sh`.

Что проверить после релиза
- На странице **Провайдеры** виден блок SSL-проверок и кнопка ручного запуска.
- После проверки видны дата последней проверки, срок действия и состояние кеша.
- На странице **Пользователи** видна таблица `IP / MAC / hostname / proxy access`.
- В режиме `allow-list only` к proxy могут подключаться только явно разрешённые хосты.
