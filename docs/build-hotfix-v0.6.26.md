# Build hotfix v0.6.26

- Убран `pnpm/action-setup` из GitHub Actions workflow.
- `pnpm` теперь ставится через `npm install -g pnpm@9.12.1`.
- Шаг `Build UI` печатает `build-ui.log` прямо в том же шаге при ошибке, чтобы причина Vite не терялась в summary.
- Цель релиза: наконец получить первичную реальную ошибку сборки, а не сбой bootstrap/runner инфраструктуры.
