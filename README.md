# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.6.2**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **Tasks SSL by provider/subscription source URL**

Релиз **v0.6.2** уже делает правильный продуктовый шаг в разделе **«Задачи»**:
- SSL в Tasks теперь читается по **provider/subscription source URL**, а не по выдуманной panel URL логике;
- кнопка **«Обновить SSL провайдеров»** больше не запускает левый panel probe, а идёт через существующий provider-health / SSL cache refresh flow;
- список прокси-провайдеров остаётся чистым, а Tasks снова показывает operational-смысл именно там, где ему место;
- документация обновлена под реальное состояние шага `v0.6.2`.

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
- не ломать установку из-за хрупкого bootstrap-а package manager.
