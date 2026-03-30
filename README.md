# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.6.3**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **build/install stabilization before the next functional SSL step**

Релиз **v0.6.3** — это стабилизационный шаг перед следующим функциональным релизом:
- добавлен `.npmrc`, чтобы GitHub Actions не валился на `pnpm install` из-за рассинхрона lockfile;
- версия `prettier-plugin-tailwindcss` возвращена к `^0.6.14`, совпадающей с текущим `pnpm-lock.yaml`;
- документация обновлена под реальное состояние линии `v0.6.3`;
- новые UI-фичи в этом релизе не добавлялись: сначала стабилизируем install/build, потом продолжаем SSL-функционал в **«Задачах»**.

## Как работаем

1. ChatGPT готовит архив дистрибутива.
2. Денис заливает изменения в репозиторий через GitHub Desktop.
3. Проверяются GitHub Actions.
4. Обновление UI на сервере выполняется через кнопку **«Обновить»** в самом UI.

## Документация

Каноничные документы лежат в `docs/`:
- `docs/project-spec.md`
- `docs/backend-contract.md`
- `docs/functional-audit.md`
- `docs/roadmap.md`
- `docs/releases.md`
- `docs/chat-transfer.md`

## GitHub Actions и обновление UI

GitHub Actions должны:
- собирать UI на каждом push/PR;
- публиковать versioned release `vX.Y.Z`;
- публиковать rolling-архив `dist.zip`;
- не ломать установку из-за хрупкого bootstrap-а package manager;
- не тащить новые фичи, пока install/build снова не станут предсказуемыми.
