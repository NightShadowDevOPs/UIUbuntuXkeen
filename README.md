# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект развивается как отдельный продукт под Ubuntu и не должен смешиваться с роутерной линией UltraUIXkeen / Netcraze.

## Текущий статус

- Текущая версия линии: **v0.6.27**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **cleanup-first + честная фиксация runtime-модели + нормальный CI-лог сборки**

## Что важно зафиксировать

- До ошибочного `v0.6.17` проект был **статическим frontend UI**, который подключается к выбранному backend через `Setup`.
- Наличие `Dockerfile` и `Caddyfile` в репозитории **не означает**, что проект уже стал встроенным Ubuntu backend/service.
- Релиз `v0.6.17` **не считать правильным**: в нём была самовольно навязана новая runtime-модель `frontend + backend`, не зафиксированная как штатная архитектура проекта.
- Релиз `v0.6.19` убрал ложную provider SSL-проверку через legacy path и оставил только подготовку URL подписок до появления Ubuntu service на хосте.
- Релиз `v0.6.27` исправляет GitHub Actions workflow: `pnpm` теперь устанавливается отдельным шагом до install/build, а подробный вывод `vite build --debug` остаётся включённым.

## Что уже сделано в cleanup-линии

### v0.6.27
- добавлен `.github/workflows/build-ui.yml`;
- шаг `Build UI` теперь печатает полный debug-лог `vite build`;
- при падении workflow выводится содержимое `build-ui.log` прямо в лог Actions;
- upload artifacts намеренно не добавлялись.

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

- получить уже раскрытую реальную build-ошибку из GitHub Actions после нового workflow;
- закрыть следующий build/blocker уже по фактической причине, а не наугад;
- продолжать page-by-page cleanup;
- отдельно спроектировать настоящий Ubuntu server-side контур для проверок Провайдеров, истории, jobs и хранения результатов.

## Provider SSL checks

As of `v0.6.27`, provider certificate checks are **not** treated as a finished frontend-only feature. The UI keeps the provider subscription URL editor, while the actual TLS/SSL polling is reserved for a dedicated Ubuntu service running on the project host.


## CI note (v0.6.28)
The GitHub Actions workflow now prints dependency install logs inline and disables Husky during CI bootstrap.
