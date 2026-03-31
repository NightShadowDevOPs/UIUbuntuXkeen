# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект развивается как отдельный продукт под Ubuntu и не должен смешиваться с роутерной линией UltraUIXkeen / Netcraze.

## Текущий статус

- Текущая версия линии: **v0.6.36**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **provider SSL visibility + shared DB snapshot + proxy access control**

## Что важно зафиксировать

- До ошибочного `v0.6.17` проект был **статическим frontend UI**, который подключается к выбранному backend через `Setup`.
- Наличие `Dockerfile` и `Caddyfile` в репозитории **не означает**, что проект уже стал встроенным Ubuntu backend/service.
- Релиз `v0.6.17` **не считать правильным**: в нём была самовольно навязана новая runtime-модель `frontend + backend`, не зафиксированная как штатная архитектура проекта.
- Релиз `v0.6.19` убрал ложную provider SSL-проверку через legacy path и оставил только подготовку URL подписок до появления Ubuntu service на хосте.
- Релиз `v0.6.36` убирает реальную причину падения CI: из `src/` удалены заехавшие transpiled `.js`/`.d.ts`, которые перекрывали `.ts`/`.tsx`; дополнительно Vite теперь предпочитает TypeScript-резолвинг, автоматическая проверка SSL-сертификатов прокси-провайдеров не тронута.

## Что уже сделано в cleanup-линии

### v0.6.36
- сохранён build-fix против stale transpiled `src/*.js` / `src/*.d.ts`;
- на страницу **Провайдеры** возвращён видимый блок SSL-проверок провайдеров;
- снимок SSL, время проверки и состояние кеша теперь сохраняются в **shared users DB**;
- добавлена таблица LAN-пользователей с хранением `IP / MAC / hostname / source / proxyAccess`;
- добавлен режим доступа к proxy: `allow all` / `allow-list only`;
- фильтрация применяется только к proxy-портам Mihomo;
- bundled agent поднят до `0.6.23` и получил `blockipports` / `unblockipports`.

### v0.6.33
- GitHub Actions переведён на официальный путь `pnpm/action-setup` + `actions/setup-node` с pnpm cache;
- badge-флаги переведены на emoji-глифы через встроенные шрифты `Twemoji` / `NotoEmoji` без SVG glob из `node_modules`;
- provider SSL checks оставлены без изменений.

### v0.6.19
- откатена ошибочная runtime-ветка `v0.6.17`;
- подтверждена фактическая модель проекта: **статический UI + выбранный backend через Setup**;
- docs обновлены под честное состояние проекта;
- зафиксировано, что проверка SSL сертификатов Провайдеров остаётся **целевой серверной функцией**, но ещё не считается закрытой в текущем frontend-only состоянии.

## Ближайший правильный шаг

- прогнать GitHub Actions на `v0.6.36`;
- если CI ещё не зелёный — открыть Step Summary или artifact `ui-build-logs` и взять первую конкретную строку install/build-ошибки;
- продолжать page-by-page cleanup;
- отдельно спроектировать настоящий Ubuntu server-side контур для проверок Провайдеров, истории, jobs и хранения результатов.

## Provider SSL checks

As of `v0.6.36`, provider certificate checks are **not** treated as a finished frontend-only feature. The UI keeps the provider subscription URL editor, while the actual TLS/SSL polling is reserved for a dedicated Ubuntu service running on the project host.

## CI note (v0.6.36)

The GitHub Actions workflow now captures full install/type-check/build logs into both the step summary and an uploaded artifact before failing the job, so the next run should finally reveal the concrete blocker instead of another naked `exit code 1`.
