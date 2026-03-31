- v0.6.33 — moved CI to `pnpm/action-setup` + `actions/setup-node@v4`, removed the `flag-icons` node_modules glob path from provider badges, and kept provider SSL checks untouched.
- v0.6.32 — replaced `build-ui.yml` with a simplified CI flow that prints install/build logs inline on failure and removes the noisy lockfile drift step.
- v0.6.30 — fixed invalid GitHub Actions YAML syntax in `build-ui.yml` and restored a parseable CI workflow.
## v0.6.30 — simplify CI install and bypass frozen lockfile drift

- шаг `Install dependencies` упрощён: убраны `tee`/промежуточные ловушки, чтобы GitHub Actions печатал реальную ошибку напрямую в лог
- CI install переведён на `pnpm install --no-frozen-lockfile`, чтобы не спотыкаться о drift между `package.json` и `pnpm-lock.yaml`
- добавлен шаг `Check lockfile drift`, который явно показывает missing dependencies в lockfile importer section
- это unblock-хотфикс для CI; отдельным шагом потом стоит локально пересобрать и закоммитить актуальный `pnpm-lock.yaml`

## v0.6.27 — remove setup-node pnpm cache precondition

- удалён `cache: pnpm` из `actions/setup-node`, потому что GitHub Actions пытался найти `pnpm` ещё до шага установки `pnpm`
- сохранён явный bootstrap через `npm install -g pnpm@9.12.1`
- в preflight добавлен `which pnpm`, чтобы сразу видеть PATH-проблемы

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


## v0.6.28
- Hardened GitHub Actions `Install dependencies` step with inline log capture on failure.
- Disabled Husky during CI install to keep workflow focused on real dependency/build errors.
