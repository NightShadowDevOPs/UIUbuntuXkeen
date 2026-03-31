Prepared release: v0.6.33. The CI workflow now uses the official pnpm setup path, and provider flag badges no longer depend on SVG glob imports from node_modules.

31.03.2026 UIUbuntuXkeen — сообщение для нового чата (вставь целиком)

Проект: UIUbuntuXkeen
Репозиторий: NightShadowDevOPs/UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.33**

Что важно помнить

- Это отдельный Ubuntu/host-проект, его нельзя смешивать с роутерной линией UltraUIXkeen / Netcraze.
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**.
- `v0.6.17` считать ошибочным архитектурным ответвлением; линия после него возвращена к модели **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров пока не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.
- Автоматическую проверку SSL-сертификатов прокси-провайдеров не трогали и не ломали.

Что сделано в `v0.6.33`
- `.github/workflows/build-ui.yml` переведён на официальный путь `pnpm/action-setup` + `actions/setup-node@v4` с pnpm cache.
- Шаг сборки упрощён до прямого `pnpm build --debug` с `NODE_OPTIONS=--max-old-space-size=4096`, чтобы GitHub Actions показывал первичную ошибку без лишней обвязки.
- Badge-компонент флагов больше не зависит от `flag-icons` и `import.meta.glob('/node_modules/...')`: флаги рисуются emoji-глифами через уже встроенные шрифты `Twemoji` / `NotoEmoji`.

Что поймано
- Предыдущая линия CI была слишком хрупкой: одновременно подозрительными оставались bootstrap `pnpm` и build-path с glob-импортом SVG-флагов из `node_modules`.
- `v0.6.33` убирает оба этих фактора, чтобы следующий прогон дал либо зелёную сборку, либо уже нормальную конкретную ошибку.

Следующий шаг

- Прогнать workflow из `v0.6.33`.
- Если CI не зелёный — брать первую явную ошибку из raw job log и чинить уже её, а не оболочку workflow.
