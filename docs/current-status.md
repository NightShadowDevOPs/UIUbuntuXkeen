Current prepared release: v0.6.32. The GitHub Actions workflow is replaced with a simpler log-first version so CI finally prints the first real install/build error instead of empty `Error:` blocks.

# Текущий статус — v0.6.32

- Текущая линия: **v0.6.32**
- Проект остаётся в честной модели: **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров всё ещё не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.
- `v0.6.17` по-прежнему считать ошибочным архитектурным ответвлением.
- `v0.6.32` меняет GitHub Actions на упрощённый workflow без шага `Check lockfile drift`, с гарантированным выводом `install-deps.log` и `build-ui.log` прямо в CI.

## Что поймано сейчас

- До `v0.6.32` CI всё ещё показывал пустые `Error:` даже когда шаги `Install dependencies` и `Build UI` падали.
- Значит основной блокер сместился из bootstrap-ошибок GitHub Actions в сам способ вывода логов шага.
