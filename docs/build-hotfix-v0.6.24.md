# Build hotfix audit — v0.6.24

## Что исправлено

- GitHub Actions workflow больше не пытается использовать `pnpm` до его установки.
- Добавлен явный шаг `pnpm/action-setup`, после которого `actions/setup-node` уже может безопасно работать с `cache: pnpm`.
- Обновлены action references для checkout/setup-node.
- Подробный debug-лог `vite build` при падении сохранён в выводе workflow.

## Причина релиза

На GitHub Actions сборка падала ещё до стадии реального `vite build`: раннер сообщал `Unable to locate executable file: pnpm`.
