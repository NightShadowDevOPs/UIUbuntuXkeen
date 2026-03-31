# Build hotfix v0.6.33

## Что исправлено

- GitHub Actions переведён на официальный `pnpm/action-setup` + `actions/setup-node@v4` с pnpm cache, без хрупкого ручного `npm install -g pnpm`.
- Сборка теперь идёт через обычный `pnpm build --debug` с `NODE_OPTIONS=--max-old-space-size=4096`, без обвязки, которая снова маскировала первичную ошибку.
- Убрана зависимость от `flag-icons` и `import.meta.glob('/node_modules/...')` в UI badge-компоненте: флаги теперь рисуются emoji-глифами через уже встроенные шрифты `Twemoji` / `NotoEmoji`.

## Зачем это сделано

Этот hotfix одновременно снимает два риска:

1. нестабильный bootstrap `pnpm` в GitHub Actions;
2. потенциально хрупкую Vite-сборку на glob-импорте ассетов из `node_modules`.

## Что не трогали

- автоматическую проверку SSL-сертификатов прокси-провайдеров;
- host/runtime модель Ubuntu UI;
- серверную часть проверки сертификатов как отдельный backend/service блок.
