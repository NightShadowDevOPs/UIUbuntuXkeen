# UIUbuntuXkeen

**UIUbuntuXkeen** — Ubuntu-oriented веб-интерфейс для управления **Mihomo**.

Проект развивается как отдельный продукт под Ubuntu и больше не должен смешиваться с роутерной линией UltraUIXkeen / Netcraze.

## Текущий статус

- Текущая версия линии: **v0.6.22**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий шаг: **rollback after invalid runtime experiment + cleanup-first**

## Что важно зафиксировать

- До ошибочного `v0.6.17` проект был **статическим frontend UI**, который подключается к выбранному backend через `Setup`.
- Наличие `Dockerfile` и `Caddyfile` в репозитории **не означает**, что проект уже стал встроенным Ubuntu backend/service.
- Релиз `v0.6.17` **не считать правильным**: в нём была самовольно навязана новая runtime-модель `frontend + backend`, не зафиксированная как штатная архитектура проекта.
- Релиз `v0.6.19` убрал ложную provider SSL-проверку через legacy path и оставил только подготовку URL подписок до появления Ubuntu service на хосте.
- Релиз `v0.6.22` — это второй build/type-check hotfix после следующего падения CI: без смены архитектуры и без примешивания роутерного runtime.

## Что уже сделано в cleanup-линии

### v0.6.16
- `Home` больше не поднимает router legacy автоматически.
- `Хост` очищен до host/runtime-экрана.
- `Трафик` очищен от роутерных QoS / Netcraze карточек.
- `Tasks / Users / Policies` убраны из основной навигации как legacy-аудит.

### v0.6.22
- закрыты текущие build/type-check blockers из CI/Actions;
- `tsconfig.app.json` поднят до `ES2022`;
- provider SSL checks по-прежнему не считаются закрытой frontend-only функцией.

### v0.6.19
- откатена ошибочная runtime-ветка `v0.6.17`;
- подтверждена фактическая модель проекта: **статический UI + выбранный backend через Setup**;
- docs обновлены под честное состояние проекта;
- зафиксировано, что проверка SSL сертификатов Провайдеров остаётся **целевой серверной функцией**, но ещё не считается закрытой в текущем frontend-only состоянии.

## Ближайший правильный шаг

- продолжать page-by-page cleanup;
- разобрать `TasksPage.vue` по блокам и действиям;
- отдельно спроектировать настоящий Ubuntu server-side контур для проверок Провайдеров, истории, jobs и хранения результатов.


## Provider SSL checks

As of `v0.6.22`, provider certificate checks are **not** treated as a finished frontend-only feature. The UI keeps the provider subscription URL editor, while the actual TLS/SSL polling is reserved for a dedicated Ubuntu service running on the project host.
