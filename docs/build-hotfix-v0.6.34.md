# Build hotfix v0.6.34

## Что исправлено

- GitHub Actions обновлён до `actions/checkout@v5` и `actions/setup-node@v6`, чтобы убрать warning про deprecated Node.js 20 actions.
- `pnpm install`, `pnpm type-check` и `pnpm exec vite build --debug` теперь всегда пишут полные логи в `install-deps.log`, `type-check.log` и `build-ui.log`.
- Эти логи печатаются в console output, попадают в Step Summary и отдельно загружаются как artifact `ui-build-logs`.
- Workflow больше не падает в середине build/install шага: сначала сохраняется exit code, потом выводятся диагностические логи, и только финальный guard-step завершает job с ошибкой.

## Зачем это сделано

Скриншот из GitHub подтвердил только две вещи:

1. `Build UI` всё ещё завершается `exit code 1`;
2. warning про Node.js 20 actions засоряет картину, но не объясняет сам build blocker.

Значит следующий полезный шаг — не ещё один слепой фикс, а релиз, который гарантированно вытаскивает реальную причину install/build наружу.

## Что не трогали

- автоматическую проверку SSL-сертификатов прокси-провайдеров;
- host/runtime модель Ubuntu UI;
- продуктовую логику страниц и компонентов.
