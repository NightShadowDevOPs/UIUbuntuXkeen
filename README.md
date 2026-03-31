# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект развивается как отдельный продукт под Ubuntu и не должен смешиваться с роутерной линией UltraUIXkeen / Netcraze.

## Текущий статус

- Текущая версия линии: **v0.6.35**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **cleanup-first + честная фиксация runtime-модели + жёсткий захват CI-логов**

## Что важно зафиксировать

- До ошибочного `v0.6.17` проект был **статическим frontend UI**, который подключается к выбранному backend через `Setup`.
- Наличие `Dockerfile` и `Caddyfile` в репозитории **не означает**, что проект уже стал встроенным Ubuntu backend/service.
- Релиз `v0.6.17` **не считать правильным**: в нём была самовольно навязана новая runtime-модель `frontend + backend`, не зафиксированная как штатная архитектура проекта.
- Релиз `v0.6.19` убрал ложную provider SSL-проверку через legacy path и оставил только подготовку URL подписок до появления Ubuntu service на хосте.
- Релиз `v0.6.35` убирает реальную причину падения CI: из `src/` удалены заехавшие transpiled `.js`/`.d.ts`, которые перекрывали `.ts`/`.tsx`; дополнительно Vite теперь предпочитает TypeScript-резолвинг, автоматическая проверка SSL-сертификатов прокси-провайдеров не тронута.

## Что уже сделано в cleanup-линии

### v0.6.35
- GitHub Actions обновлён до `actions/checkout@v5` и `actions/setup-node@v6`, чтобы убрать warning про deprecated Node.js 20 actions;
- шаги `pnpm install`, `pnpm type-check` и `pnpm exec vite build --debug` теперь всегда пишут логи в файлы, console output, Step Summary и artifact `ui-build-logs`;
- install/build шаги больше не обрывают job мгновенно: их exit code сохраняется, логи печатаются, и только потом отдельный финальный guard-step завершает job с ошибкой;
- автоматическую проверку SSL-сертификатов прокси-провайдеров не трогали.

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

- прогнать GitHub Actions на `v0.6.35`;
- если CI ещё не зелёный — открыть Step Summary или artifact `ui-build-logs` и взять первую конкретную строку install/build-ошибки;
- продолжать page-by-page cleanup;
- отдельно спроектировать настоящий Ubuntu server-side контур для проверок Провайдеров, истории, jobs и хранения результатов.

## Provider SSL checks

As of `v0.6.35`, provider certificate checks are **not** treated as a finished frontend-only feature. The UI keeps the provider subscription URL editor, while the actual TLS/SSL polling is reserved for a dedicated Ubuntu service running on the project host.

## CI note (v0.6.35)

The GitHub Actions workflow now captures full install/type-check/build logs into both the step summary and an uploaded artifact before failing the job, so the next run should finally reveal the concrete blocker instead of another naked `exit code 1`.
