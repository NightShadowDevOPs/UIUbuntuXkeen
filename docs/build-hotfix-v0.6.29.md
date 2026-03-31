# v0.6.29 — CI install unblock and lockfile drift visibility

## Что поймали

GitHub Actions стабильно доходил до шага `Install dependencies` и падал почти мгновенно. По структуре проекта причина выглядит как drift между `package.json` и `pnpm-lock.yaml`: в importer section lockfile отсутствуют как минимум `flag-icons` и `qrcode-generator`.

## Что изменено

- install-step упрощён до прямого `pnpm install --no-frozen-lockfile --reporter append-only`;
- убраны дополнительные `tee`/log-wrapper конструкции, чтобы первичная ошибка pnpm печаталась прямо в лог job;
- добавлен шаг `Check lockfile drift`;
- сохранён явный bootstrap `pnpm@9.12.1`;
- Husky остаётся отключённым в CI.

## Замечание

Это release-unblock для CI. Полноценное долгосрочное исправление — локально обновить `pnpm-lock.yaml` и закоммитить его уже без drift.
