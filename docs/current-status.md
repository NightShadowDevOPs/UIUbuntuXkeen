Current prepared release: v0.6.33. The CI workflow now uses the official pnpm setup path, and provider flag badges no longer depend on SVG glob imports from node_modules.

# Текущий статус — v0.6.33

- Текущая линия: **v0.6.33**
- Проект остаётся в честной модели: **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров всё ещё не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.
- `v0.6.17` по-прежнему считать ошибочным архитектурным ответвлением.
- `v0.6.33` убирает хрупкий bootstrap `pnpm` в GitHub Actions и отказ от glob-импорта SVG-флагов из `node_modules` в badge-компоненте.

## Что поймано сейчас

- Линия с ручным `npm install -g pnpm` и лог-обвязкой вокруг build по-прежнему оставалась подозрительной и не давала уверенности, что падение ловится в правильном месте.
- Badge-компонент флагов тянул SVG через `import.meta.glob('/node_modules/flag-icons/...')`, что добавляло лишний риск для Vite build.
