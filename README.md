# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект стартует на базе линии **UltraUIXkeen**, но развивается как отдельный продукт под Ubuntu: с нормальной моделью путей, сервисов и безопасного управления конфигурацией Mihomo.

## Текущий статус

Текущая версия: **v0.2.2**

На этом релизе GitHub Actions переведены на Node 24-ready версии actions, при этом runtime сборки проекта оставлен на Node.js 22 для стабильной сборки и публикации rolling-обновления.

## Как работаем

1. ChatGPT готовит архив дистрибутива.
2. Денис заливает изменения в репозиторий через GitHub Desktop.
3. Проверяются GitHub Actions.
4. Обновление UI на сервере выполняется через кнопку **«Обновить»** в самом UI.

## Документация

Каноничные документы лежат в `docs/`:
- `docs/project-spec.md`
- `docs/roadmap.md`
- `docs/releases.md`
- `docs/chat-transfer.md`

## GitHub Actions и обновление UI

Начиная с `v0.2.2`, GitHub Actions должны:
- собирать UI на каждом push/PR;
- публиковать versioned release `vX.Y.Z`;
- обновлять rolling release `dist.zip` для механизма обновления через кнопку **«Обновить»** внутри UI.

Перед первым серверным тестом проверь, не указывает ли `external-ui-url` ещё на старый репозиторий.

## Базовая идея продукта

Новый проект должен:
- сохранить сильные стороны текущего UI Mihomo;
- отказаться от роутерной привязки к Netcraze Ultra / Entware / BusyBox / CGI;
- использовать Ubuntu-native пути и сервисную модель;
- развивать безопасный operational flow для `config.yaml` Mihomo.

## Ubuntu paths

Канонические пути новой линии:
- `/etc/mihomo/config.yaml`
- `/var/lib/ultra-ui-ubuntu/`
- `/var/lib/ultra-ui-ubuntu/config/`
- `/var/log/ultra-ui-ubuntu/`
- `/etc/ultra-ui-ubuntu/agent.env`

## Разработка

```bash
pnpm i
pnpm dev
pnpm build
```
