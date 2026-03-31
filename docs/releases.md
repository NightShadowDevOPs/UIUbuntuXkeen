## v0.6.26 — GitHub Actions pnpm bootstrap and inline build log

- убран `pnpm/action-setup`, который тянул deprecated Node 20 runtime warning
- `pnpm` теперь ставится через `npm install -g pnpm@9.12.1`
- шаг `Build UI` печатает `build-ui.log` в том же шаге при падении, чтобы первая ошибка Vite была видна сразу

## v0.6.26 — workflow early-failure diagnostics hotfix

- moved preflight diagnostics before project version read
- replaced the brittle version echo with explicit `node:fs` JSON parsing
- made the failure-log step tolerant when `build-ui.log` is missing

## v0.6.26 — workflow log visibility hotfix

- Добавлен `.github/workflows/build-ui.yml`.
- Шаг `Build UI` теперь печатает полный лог `vite build --debug` в GitHub Actions.
- При падении workflow содержимое `build-ui.log` выводится в лог шага.
- `Type check` оставлен informational, чтобы не маскировать реальную build-ошибку.
- Upload artifacts не добавлялись.

## v0.6.22 — second build unblock hotfix

- Закрыты оставшиеся CI-типизации в `TasksPage` callbacks.
- Исправлена нормализация `userLimits` для строгого TS build.

## v0.6.21 — build hotfix

- Исправлены типизации в `TasksPage.vue`.
- Добавлен локальный `sleep()` helper.
- Китайский словарь переведён на fallback от `en.ts`.
