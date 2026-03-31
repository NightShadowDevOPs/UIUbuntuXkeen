Current prepared release: v0.6.30. The CI workflow file syntax is repaired after the invalid YAML in v0.6.29.

# Текущий статус — v0.6.30

- Текущая линия: **v0.6.30**
- Проект остаётся в честной модели: **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров всё ещё не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.
- `v0.6.17` по-прежнему считать ошибочным архитектурным ответвлением.
- `v0.6.30` переводит GitHub Actions install-step на `pnpm install --no-frozen-lockfile` и явно показывает drift между `package.json` и `pnpm-lock.yaml`.

## Что поймано сейчас

- В importer section `pnpm-lock.yaml` отсутствуют как минимум `flag-icons` и `qrcode-generator`.
- Из-за этого CI с `--frozen-lockfile` падал ещё на шаге install и не доходил до реальной build-ошибки.
