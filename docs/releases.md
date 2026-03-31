## v0.6.23 — workflow log visibility hotfix

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
