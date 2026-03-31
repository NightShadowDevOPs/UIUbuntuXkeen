# Build hotfix v0.6.27

Причина нового падения GitHub Actions:

- `actions/setup-node` с параметром `cache: pnpm` пытался найти исполняемый файл `pnpm` ещё до шага `Setup pnpm`.
- Из-за этого workflow падал на bootstrap-слое и снова не доходил до реальной сборки UI.

Что исправлено:

- удалён `cache: pnpm` из шага `Setup Node.js`;
- сохранён явный шаг `npm install -g pnpm@9.12.1`;
- в preflight diagnostics добавлен `which pnpm`.

Ожидаемый результат:

- workflow перестаёт падать на ошибке `Unable to locate executable file: pnpm`;
- следующий провал, если он останется, уже должен показать реальную build-ошибку проекта.
