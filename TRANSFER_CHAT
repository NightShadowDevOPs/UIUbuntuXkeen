31.03.2026 UIUbuntuXkeen — сообщение для нового чата (вставь целиком)

Проект: UIUbuntuXkeen
Репозиторий: NightShadowDevOPs/UIUbuntuXkeen
Актуальный релиз для переноса: **v0.6.29**

Что важно помнить

- Это отдельный Ubuntu/host-проект, его нельзя смешивать с роутерной линией UltraUIXkeen / Netcraze.
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**.
- `v0.6.17` считать ошибочным архитектурным ответвлением; линия после него возвращена к модели **статический frontend UI + выбранный backend через Setup**.
- Проверка SSL сертификатов Провайдеров пока не считается закрытой frontend-only функцией: реальная проверка должна жить в отдельном Ubuntu service на хосте.

Что сделано в `v0.6.29`
- Install dependencies в GitHub Actions переведён на `pnpm install --no-frozen-lockfile --reporter append-only`.
- Добавлен шаг `Check lockfile drift`, который явно показывает missing dependencies в importer section `pnpm-lock.yaml`.
- Цель релиза — убрать тупик на CI install и получить уже реальную ошибку pnpm/vite, если она ещё есть.

Что поймано
- В importer section `pnpm-lock.yaml` отсутствуют как минимум `flag-icons` и `qrcode-generator`.
- Именно это выглядит как наиболее вероятная причина мгновенного падения `pnpm install --frozen-lockfile` в CI.

Следующий шаг

- Прогнать workflow из `v0.6.29` и взять первую реальную ошибку, если build ещё не зелёный.
- После разблокировки CI локально пересобрать и закоммитить актуальный `pnpm-lock.yaml`.
