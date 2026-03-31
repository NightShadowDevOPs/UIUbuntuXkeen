Prepared release: v0.6.34. The CI workflow now captures install/type-check/build logs into summary and artifact before failing, and deprecated Node.js 20 Actions are bumped away.

31.03.2026 UIUbuntuXkeen — сообщение для нового чата (вставь целиком)

Проект: UIUbuntuXkeen
Репозиторий: NightShadowDevOPs/UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.34**

Что важно помнить

- Это отдельный Ubuntu/host-проект, его нельзя смешивать с роутерной линией UltraUIXkeen / Netcraze.
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**.
- `v0.6.17` считать ошибочным архитектурным ответвлением; линия после него возвращена к модели **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров пока не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.
- Автоматическую проверку SSL-сертификатов прокси-провайдеров не трогали и не ломали.

Что сделано в `v0.6.34`
- `.github/workflows/build-ui.yml` обновлён до `actions/checkout@v5` и `actions/setup-node@v6`, чтобы убрать warning про deprecated Node.js 20 actions.
- `pnpm install`, `pnpm type-check` и `pnpm exec vite build --debug` теперь всегда пишут полные логи в файлы, в Step Summary и в artifact `ui-build-logs`.
- Job больше не обрывается в середине шага: сначала сохраняются exit code и лог, потом отдельный финальный шаг завершает workflow с понятной причиной.

Что поймано
- По скриншоту GitHub всё ещё показывает только `Build UI / Process completed with exit code 1`; warning про Node.js 20 actions — отдельный шум, а не доказанная первопричина build failure.
- Значит сейчас важнее не гадать про проектный blocker наугад, а гарантированно вытащить полный install/build лог наружу.

Следующий шаг

- Прогнать workflow из `v0.6.34`.
- Если CI не зелёный — открыть Step Summary или artifact `ui-build-logs` и брать уже первую конкретную строку ошибки для следующего точечного фикса.
