# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект развивается как отдельный продукт под Ubuntu и не должен смешиваться с роутерной линией UltraUIXkeen / Netcraze.

## Текущий статус

- Текущая версия линии: **v0.6.33**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **cleanup-first + честная фиксация runtime-модели + стабилизация CI/build**

## Что важно зафиксировать

- До ошибочного `v0.6.17` проект был **статическим frontend UI**, который подключается к выбранному backend через `Setup`.
- Наличие `Dockerfile` и `Caddyfile` в репозитории **не означает**, что проект уже стал встроенным Ubuntu backend/service.
- Релиз `v0.6.17` **не считать правильным**: в нём была самовольно навязана новая runtime-модель `frontend + backend`, не зафиксированная как штатная архитектура проекта.
- Релиз `v0.6.19` убрал ложную provider SSL-проверку через legacy path и оставил только подготовку URL подписок до появления Ubuntu service на хосте.
- Релиз `v0.6.33` переводит CI на официальный `pnpm/action-setup` + `actions/setup-node@v4` и убирает зависимость badge-флагов от `flag-icons`/`import.meta.glob('/node_modules/...')`.

## Что уже сделано в cleanup-линии

### v0.6.33
- GitHub Actions переведён на официальный путь `pnpm/action-setup` + `actions/setup-node@v4` с pnpm cache;
- шаг сборки упрощён до прямого `pnpm build --debug` с `NODE_OPTIONS=--max-old-space-size=4096`;
- badge-флаги переведены на emoji-глифы через встроенные шрифты `Twemoji` / `NotoEmoji` без SVG glob из `node_modules`;
- автоматическую проверку SSL-сертификатов прокси-провайдеров не трогали.

### v0.6.19
- откатена ошибочная runtime-ветка `v0.6.17`;
- подтверждена фактическая модель проекта: **статический UI + выбранный backend через Setup**;
- docs обновлены под честное состояние проекта;
- зафиксировано, что проверка SSL сертификатов Провайдеров остаётся **целевой серверной функцией**, но ещё не считается закрытой в текущем frontend-only состоянии.

### v0.6.16
- `Home` больше не поднимает router legacy автоматически;
- `Хост` очищен до host/runtime-экрана;
- `Трафик` очищен от роутерных QoS / Netcraze карточек;
- `Tasks / Users / Policies` убраны из основной навигации как legacy-аудит.

## Ближайший правильный шаг

- прогнать GitHub Actions на `v0.6.33`;
- если CI ещё не зелёный — брать первую явную ошибку из raw log и чинить уже её, а не оболочку workflow;
- продолжать page-by-page cleanup;
- отдельно спроектировать настоящий Ubuntu server-side контур для проверок Провайдеров, истории, jobs и хранения результатов.

## Provider SSL checks

As of `v0.6.33`, provider certificate checks are **not** treated as a finished frontend-only feature. The UI keeps the provider subscription URL editor, while the actual TLS/SSL polling is reserved for a dedicated Ubuntu service running on the project host.

## CI note (v0.6.33)
The GitHub Actions workflow now uses the official pnpm setup path and runs raw `pnpm install` / `pnpm build --debug`, so the next failure should be an actual install/build problem instead of bootstrap noise from the workflow shell.
