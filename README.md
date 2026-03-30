# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов, фоновых задач и хранения operational state.

## Текущий статус

- Текущая версия линии: **v0.5.3**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **хост — ресурсы сервера, сервисы и лог Mihomo**

Релиз **v0.5.3** переводит раздел **«Хост»** на более честную Ubuntu-модель:
- отдельные зоны **Обзор хоста / Сервисы / Логи** для `ubuntu-service` backend-а;
- нормализацию `/api/status`, `/api/system/resources`, `/api/system/services`, `/api/system/logs`;
- показ CPU, RAM, storage, uptime, состояния Mihomo и списка systemd-юнитов;
- чтение каноничного лога `/var/log/mihomo/mihomo.log` без старой agent-only логики.

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
- обновлять rolling release `dist.zip` для механизма обновления через кнопку **«Обновить»** внутри UI.

Для встроенного обновления используется постоянная rolling-ссылка, а версионные архивы остаются для истории и ручной проверки.

## Ubuntu paths

Канонические пути новой линии:
- `/etc/mihomo/config.yaml`
- `/var/lib/ultra-ui-ubuntu/`
- `/var/lib/ultra-ui-ubuntu/runtime/`
- `/var/lib/ultra-ui-ubuntu/config/`
- `/var/log/ultra-ui-ubuntu/`
- `/var/log/mihomo/mihomo.log`
- `/etc/ultra-ui-ubuntu/agent.env`

## Разработка

```bash
pnpm i
pnpm dev
pnpm build
```
