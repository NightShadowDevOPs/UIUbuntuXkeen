# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.5.5**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **Трафик и состояния клиентов**

Релиз **v0.5.5** переводит раздел **«Трафик»** из разрозненных кусков в единый рабочий экран:
- добавлена сводка по живым клиентам, соединениям и текущим скоростям;
- появилась таблица клиентов по IP с состояниями **Mihomo / VPN / bypass**;
- live connections и user-traffic собраны на одной странице, без прыжков по разным разделам;
- compatibility-контур с `NetcrazeTrafficCard` и `HostQosCard` сохранён, чтобы экран был полезен уже сейчас, а не после будущего Ubuntu service.

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
