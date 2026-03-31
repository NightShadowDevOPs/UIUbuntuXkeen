# Build hotfix v0.6.35

## Проблема
GitHub Actions finally exposed the real blocker from `v0.6.34`:

- `src/components/connections/ConnectionCard.js (26:56): Expression expected`

Причина была не в pnpm и не в GitHub Actions как таковых. В репозиторий попали transpiled-файлы `src/**/*.js` и `src/**/*.d.ts`, а Vite по умолчанию резолвит `.js` раньше `.tsx`. Из-за этого вместо исходного `ConnectionCard.tsx` сборка брала `ConnectionCard.js` с JSX внутри plain `.js` файла и падала на парсинге.

## Что сделано
- удалены stale transpiled-артефакты `src/**/*.js` и `src/**/*.d.ts`, если рядом есть исходник `.ts`, `.tsx` или `.vue`;
- в `vite.config.ts` добавлен явный порядок `resolve.extensions`, где `.ts` / `.tsx` идут раньше `.js`;
- добавлен `.gitignore`, чтобы такие артефакты снова не заехали в `src/`.

## Что проверить
- GitHub Actions: шаг `Build UI` должен пройти без ошибки `ConnectionCard.js (26:56)`;
- runtime-часть UI и автоматическую проверку SSL-сертификатов провайдеров не трогали.
