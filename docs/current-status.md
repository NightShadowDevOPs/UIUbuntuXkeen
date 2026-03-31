Current prepared release: v0.6.34. The CI workflow now captures install/type-check/build logs into summary and artifact before failing, and deprecated Node.js 20 Actions are bumped away.

# Текущий статус — v0.6.34

- Текущая линия: **v0.6.34**
- Проект остаётся в честной модели: **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров всё ещё не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.
- `v0.6.17` по-прежнему считать ошибочным архитектурным ответвлением.
- `v0.6.34` не пытается угадывать новый build blocker вслепую: релиз сначала гарантированно вытаскивает полный install/build лог наружу.

## Что поймано сейчас

- По скриншоту GitHub всё ещё показывает только `Build UI / Process completed with exit code 1`.
- Warning про Node.js 20 actions засоряет картину, но сам по себе не объясняет build failure.
- Следовательно, сейчас самый полезный шаг — стабильно сохранить и вывести полные логи каждого CI-этапа.
