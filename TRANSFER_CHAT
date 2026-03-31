Prepared release: v0.6.32. The GitHub Actions workflow file is replaced with a simpler log-first variant so CI finally prints the first real install/build error instead of empty `Error:` blocks.

31.03.2026 UIUbuntuXkeen — сообщение для нового чата (вставь целиком)

Проект: UIUbuntuXkeen
Репозиторий: NightShadowDevOPs/UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.32**

Что важно помнить

- Это отдельный Ubuntu/host-проект, его нельзя смешивать с роутерной линией UltraUIXkeen / Netcraze.
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**.
- `v0.6.17` считать ошибочным архитектурным ответвлением; линия после него возвращена к модели **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров пока не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.

Что сделано в `v0.6.32`
- `.github/workflows/build-ui.yml` заменён на упрощённый workflow без шага `Check lockfile drift`.
- `pnpm install` пишет лог в `install-deps.log` и печатает его прямо в CI при успехе и при падении.
- `pnpm exec vite build --debug` пишет лог в `build-ui.log` и печатает его прямо в CI при успехе и при падении.
- Цель релиза — перестать ловить пустые `Error:` в GitHub Actions и получить первую реальную install/build ошибку.

Что поймано
- До `v0.6.32` даже после фиксов bootstrap и YAML workflow CI продолжал показывать пустые `Error:` в шагах `Install dependencies` и `Build UI`.
- Значит следующая полезная информация должна прийти уже из inline логов `install-deps.log` и `build-ui.log`.

Следующий шаг

- Прогнать workflow из `v0.6.32` и взять первую реальную ошибку install/build, если CI ещё не зелёный.
- После этого точечно чинить уже сам проект или lockfile/deps, а не GitHub Actions оболочку.
