31.03.2026 UIUbuntuXkeen — сообщение для нового чата (вставь целиком)

Проект: UIUbuntuXkeen
Репозиторий: NightShadowDevOPs/UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.27**

Что важно помнить

- Это отдельный Ubuntu/host-проект, его нельзя смешивать с роутерной линией UltraUIXkeen / Netcraze.
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**.
- `v0.6.17` считать ошибочным архитектурным ответвлением; линия после него возвращена к модели **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров пока не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.

Что сделано в `v0.6.27`
- из `actions/setup-node` убран `cache: pnpm`, который требовал `pnpm` ещё до шага его установки
- сохранён явный bootstrap через `npm install -g pnpm@9.12.1`
- в preflight diagnostics добавлен `which pnpm`, чтобы PATH-проблемы были видны сразу

Следующий шаг

- Запустить новый workflow и получить уже раскрытую первую реальную build-ошибку из GitHub Actions, если bootstrap больше не падает.
- Следующий hotfix делать только по фактическому логу Vite/Rollup.


Current prepared release: v0.6.28 (CI install-step diagnostics hotfix).
