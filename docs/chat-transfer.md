# UIUbuntuXkeen — перенос в новый чат

Актуальный релиз для переноса: **v0.6.20**

Вставь этот файл целиком в новый чат.

---

Мы продолжаем проект **UIUbuntuXkeen**.

## Что это за проект

UIUbuntuXkeen — отдельный Ubuntu-oriented веб-интерфейс для управления **Mihomo** на Ubuntu-хосте/сервере.

Проект вырос из линии **UltraUIXkeen / UI Mihomo / Ultra**, но теперь развивается как **самостоятельный продукт под Ubuntu**, а не как роутерный UI для Netcraze Ultra. Эти два проекта **не смешивать**: у них разные хосты, разные runtime-модели и разные продуктовые цели.

## Репозиторий и рабочий процесс

- Репозиторий: `https://github.com/NightShadowDevOPs/UIUbuntuXkeen`
- Пользователь загружает релизы в репозиторий через **GitHub Desktop**
- После push пользователь проверяет **GitHub Actions**
- Обновление UI на сервере выполняется через кнопку **«Обновить»** в самом UI

## Как работаем по релизам

Ты всегда отвечаешь в таком порядке:
1. даёшь **дистрибутив архивом**;
2. отдельно даёшь **commit message**;
3. соблюдаешь **версионность**;
4. в каждом релизе обновляешь `docs/`;
5. в каждом релизе обязательно обновляешь `TRANSFER_CHAT` и `docs/chat-transfer.md`;
6. в каждом релизе даёшь отдельный архив для переноса проекта в новый чат.

## Обязательные документы в docs

В `docs/` всегда должны быть:
- `project-spec.md` — полное ТЗ;
- `backend-contract.md` — Ubuntu backend contract;
- `functional-audit.md` — глубокий аудит функционального паритета;
- `roadmap.md` — план работ по релизам;
- `releases.md` — журнал выполненных релизов;
- `chat-transfer.md` — актуальный перенос в новый чат.

## Текущий статус

- Текущий релиз линии: **v0.6.20**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- `v0.6.16` — правильный cleanup-wave релиз: `Home` больше не поднимает router legacy автоматически, `Хост` очищен до host/runtime, а `Tasks / Users / Policies` убраны из основной навигации как legacy-аудит.
- `v0.6.17` — **не считать правильным релизом**: в нём была навязана новая runtime-модель `frontend + backend`, которая не была подтверждена как штатная схема проекта.
- `v0.6.19` — честная staging-линия для provider SSL: legacy path выключен, в UI остаётся редактирование URL 3x-ui подписок до появления Ubuntu service на хосте.
- `v0.6.20` — build/type-check hotfix после падения CI/Actions на `uiBuild`, `UserTrafficStats`, `ProxyProvider` и `HostRuntimeCard`.

Ключевые факты:
- release flow нового репозитория уже подтверждён на сервере;
- сервер обновляется через постоянную rolling-ссылку `dist.zip`;
- каноничный лог Mihomo на Ubuntu: `/var/log/mihomo/mihomo.log`;
- без отдельно подтверждённого Ubuntu service не будут полноценно закрыты провайдеры, GEO, ресурсы хоста, QoS, shaping и состояния клиентов;
- audit уже разложил, что можно брать напрямую из Mihomo, а что требует отдельного server-side этапа.

## Главный результат аудита

### Что можно брать напрямую из Mihomo
- прокси;
- proxy groups;
- rules;
- rule providers;
- connections;
- часть overview/runtime данных.

### Что требует нового Ubuntu service
- SSL/TLS проверки провайдеров по расписанию;
- `Обновить` и `Обновить SSL-кеш`;
- last GEO update и GEO history;
- ресурсы хоста;
- каноничный лог Mihomo и системные логи;
- трафик и состояния клиентов на уровне хоста;
- QoS / shaping;
- jobs/status/history;
- запись результата в SQLite/DB.

## Архитектурные правила проекта

### Ubuntu paths
Используем только Ubuntu-ориентированную модель путей:
- `/etc/mihomo/config.yaml`
- `/var/lib/ultra-ui-ubuntu/`
- `/var/lib/ultra-ui-ubuntu/runtime/`
- `/var/lib/ultra-ui-ubuntu/config/`
- `/var/log/ultra-ui-ubuntu/`
- `/var/log/mihomo/mihomo.log`
- `/etc/ultra-ui-ubuntu/agent.env`

### Backend modes
Сейчас допустимы два режима:
- `compatibility-bridge`
- `ubuntu-service`

Важно: наличие frontend-клиента `ubuntuService.ts` ещё не означает, что внутри самого UI-проекта уже существует подтверждённый встроенный Ubuntu backend runtime.

## Ближайший roadmap

- `v0.6.20` — build/type-check hotfix без смены архитектуры;
- `v0.6.19` — page-by-page teardown для `TasksPage.vue`;
- `v0.6.20` — пересборка `SubscriptionsPage.vue` под server publish path;
- `v0.6.21` — зачистка `UsersPage.vue` и `PoliciesPage.vue`;
- отдельный server-side этап — реальная проверка SSL сертификатов Провайдеров, jobs/history и storage model.

## Что важно помнить в следующем чате

- не смешивать UIUbuntuXkeen с роутерным проектом;
- не считать похожий экран доказательством готового backend-функционала;
- сначала фиксировать реальную runtime-модель проекта, потом обещать server-side возможности;
- проверка SSL сертификатов Провайдеров нужна продукту, но пока не считается закрытой в текущем frontend-only состоянии;
- все документы в `docs/` обновлять в каждом релизе;
- отдельный transfer-архив давать в каждом релизе;
- писать пользователю по-русски, названия разделов использовать как в проекте: **«Хост»**, **«Провайдеры»**, **«Трафик»**, **«Задачи»**.


- `v0.6.19`: UI очищен от ложной provider SSL-проверки через legacy path. Теперь честно зафиксировано, что проверка сертификатов Провайдеров должна выполняться отдельным Ubuntu service на этом хосте. Пока в UI сохраняются только URL 3x-ui подписок и пороги предупреждений.
- `v0.6.20`: закрыты build/type-check blockers, которые падали в CI/Actions после `v0.6.19`.
