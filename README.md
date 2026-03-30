# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.5.4**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **функциональный hotfix раздела «Хост»**

Релиз **v0.5.4** не рисует новые карточки, а чинит практическую проблему прошлого шага:
- секции **Сервисы / Логи** теперь доступны и в режиме `compatibility-bridge`;
- runtime-карточка умеет брать реальные host-метрики через существующий agent/status fallback;
- лог Mihomo и agent/service лог читаются через живой fallback, даже если полноценный `ubuntu-service` ещё не поднят;
- groundwork под `/api/status`, `/api/system/resources`, `/api/system/services`, `/api/system/logs` сохранён для будущего Ubuntu service.

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
