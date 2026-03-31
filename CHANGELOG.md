## v0.6.23 - 2026-03-31

- добавлен `.github/workflows/build-ui.yml`;
- шаг `Build UI` теперь запускает `pnpm exec vite build --debug 2>&1 | tee build-ui.log`;
- при падении workflow содержимое `build-ui.log` печатается прямо в лог GitHub Actions;
- шаг `Type check` оставлен informational (`continue-on-error: true`), чтобы не маскировать реальную build-ошибку;
- upload artifacts специально не добавлялись.

## v0.6.22 - 2026-03-31

- исправлены оставшиеся CI-типизации в `TasksPage` callbacks;
- поправлена нормализация user limits для строгого TS build.

## v0.6.21 - 2026-03-31

- исправлен `TasksPage.vue`: добавлен локальный `sleep()` helper для polling-циклов provider SSL и users-db операций;
- исправлен `TasksPage.vue`: `usersDbPushNow` больше не передаётся в `@click` как функция с несовместимой сигнатурой обработчика DOM event;
- исправлен `TasksPage.vue`: `sslWarnDays` input теперь читает `value` через безопасный `HTMLInputElement` cast;
- исправлен `src/i18n/zh.ts`: китайский словарь теперь наследует недостающие ключи из `en.ts`, чтобы новые строки не валили типизацию;
- исправлен `src/composables/userLimits.ts`: `getUserLimit()` теперь явно возвращает `UserLimitResolved`, чтобы downstream-код не видел optional-поля там, где лимит уже нормализован.

## v0.6.20 - 2026-03-31

- поднят `tsconfig.app.json` до `ES2022`;
- устранены build/type-check blockers в `uiBuild`, `UserTrafficStats`, `ProxyProvider` и `HostRuntimeCard`.

## v0.6.19 - 2026-03-31

- честно отключён legacy provider SSL fallback через router-agent / compatibility path;
- раздел «Задачи» теперь показывает, что URL 3x-ui подписок можно сохранять уже сейчас, а реальная проверка сертификатов появится после подключения Ubuntu service на этом хосте;
- auto-bootstrap legacy agent выключен по умолчанию, чтобы Ubuntu-линия не подмешивала роутерный контур в новый профиль браузера;
- добавлен `docs/provider-ssl-service-plan-v0.6.19.md`.

## v0.6.18 - 2026-03-31

- откатена ошибочная runtime-ветка `v0.6.17`: проект возвращён к честной модели **статический frontend UI + выбранный backend через Setup**;
- удалён навязанный в `v0.6.17` новый встроенный backend/runtime-контур из релизной линии;
- docs обновлены под фактическое состояние проекта: `v0.6.17` прямо помечен как неверный архитектурный релиз;
- добавлен `docs/runtime-model-audit-v0.6.18.md` с разбором реальной runtime-модели и причин отката.
