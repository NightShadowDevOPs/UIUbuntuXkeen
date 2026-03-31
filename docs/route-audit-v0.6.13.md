# UIUbuntuXkeen — поэкранный аудит интерфейса и legacy-хвостов

Дата: 2026-03-31  
База анализа: `UIUbuntuXkeen-dist-v0.6.13.zip`

## Зачем этот документ

Это не аудит «что красиво/некрасиво». Это карта того, **что реально есть в UI**, **на что это завязано**, и **что с этим делать при перестройке под серверный Ubuntu backend**.

Главный принцип: если у блока нет честного server-side execution path, он не должен выглядеть как полностью рабочая функция.

---

## 1. Общая карта экранов

### Monitor
- `OverviewPage.vue`
- `RouterPage.vue`
- `TrafficPage.vue`
- `ConnectionsPage.vue`
- `LogsPage.vue`

### Network
- `ProxiesPage.vue`
- `ProxyProvidersRoutePage.vue`
- `SubscriptionsPage.vue`
- `RulesPage.vue`
- `MihomoPage.vue`

### Management
- `TasksPage.vue`
- `UsersPage.vue`
- `PoliciesPage.vue`
- `SettingsPage.vue`

### System
- `SetupPage.vue`

---

## 2. Самый важный архитектурный вывод

В текущем проекте одновременно живут **три слоя**:

1. **Mihomo UI-base** — живой и полезный.
2. **router legacy** — `agent.ts`, `store/agent.ts`, `router-agent/install.sh`, `usersDbSync`, вызовы к `:9099/cgi-bin/api.sh`.
3. **будущий Ubuntu/server-контур** — `ubuntuService.ts`, `backendContract.ts`, `docs/backend-contract.md`.

Из-за этого часть экранов уже выглядит как Ubuntu server UI, но фактически всё ещё завязана на старую router-era модель.

---

## 3. Краткая матрица по всем страницам

| Экран | Кнопки | Поля ввода | Select | Textarea | Legacy/контуры | Решение |
|---|---:|---:|---:|---:|---|---|
| Overview | 0 | 0 | 0 | 0 | Mihomo-base | Оставить |
| Router / Host | 3 | 0 | 0 | 0 | legacy `AgentCard` + host cards | Чистить и переименовать в чистый `Хост` |
| Traffic | 6 | 0 | 0 | 0 | legacy `agentEnabled` + Netcraze/QoS cards | Чистить, делить на runtime vs server features |
| Connections | 0 | 0 | 0 | 0 | Mihomo-base | Оставить |
| Logs | 0 | 0 | 0 | 0 | base + host integration | Оставить, но честно развести источники |
| Proxies | 1 | 0 | 0 | 0 | Mihomo-base + provider health helper | Оставить |
| Proxy Providers | 0 | 0 | 0 | 0 | Mihomo-base | Оставить |
| Subscriptions | 14 | 3 | 5 | 8 | legacy `agentUrl` + provider health | Перестраивать под server publishing |
| Rules | 0 | 0 | 0 | 0 | Mihomo-base | Оставить |
| Mihomo | 18 | 0 | 0 | 0 | Mihomo-base + workspace wrapper | Оставить, слегка полировать |
| Tasks | 54 | 31 | 4 | 0 | legacy `agent`, `usersDbSync`, provider ops | Резать первым |
| Users | 6 | 2 | 0 | 0 | legacy import + users-db sync | Резать/скрывать legacy куски |
| Policies | 11 | 5 | 2 | 0 | local UI-only profiles | Оставить, но не смешивать с серверным админ-контуром |
| Settings | 5 | 0 | 0 | 0 | mixed settings | Оставить, но перенести лишнее из Tasks сюда |
| Setup | 6 | 1 | 2 | 0 | backend contract | Оставить и упростить терминологию |

---

## 4. Детальный разбор проблемных экранов

# 4.1. RouterPage.vue

## Что сейчас есть

### Workspace tabs
- Overview
- Services
- Logs
- Traffic *(только legacy-режим)*
- Network *(только legacy-режим)*

## Что реально подключено
- `HostRuntimeCard`
- `HostServicesCard`
- `HostLogsCard`
- `AgentCard`
- `SystemCard`
- `NetcrazeTrafficCard`
- `ChartsCard`
- `NetworkCard`

## Проблема
Это **не один экран**, а смесь из трёх эпох:
- новый `Host`-контур;
- старый `router/agent`-контур;
- Netcraze-specific operational cards.

## Что оставить
- `Overview` как host runtime summary;
- `Services`;
- `Logs`.

## Что убрать или вынести
- `AgentCard` — убрать из Ubuntu-линии;
- legacy `Traffic` subsection — вынести в `TrafficPage` или скрыть до server backend;
- `NetworkCard` — только если есть честный backend источник, иначе скрыть;
- `NetcrazeTrafficCard` — не должен жить внутри `Хоста`.

## Итоговое решение
`RouterPage` должен стать **`Хост`** и содержать только:
- runtime;
- services;
- logs;
- возможно network summary, если под него есть серверный API.

---

# 4.2. TrafficPage.vue

## Что сейчас есть
### Верхние вкладки
- Clients
- Connections
- Users

## Что реально подключено
- `TrafficRuntimeSummaryCard`
- `TrafficClientsStateCard`
- `NetcrazeTrafficCard`
- `HostQosCard`
- `ConnectionCardList` / `ConnectionTable` / `ConnectionDetails`
- `UserTrafficStats`

## Проблема
`TrafficPage` одновременно показывает:
- хорошие runtime-представления;
- legacy QoS/shaping карточки;
- старый compatibility mode через `agentEnabled`.

## Что оставить
- runtime summary;
- clients state;
- connections bridge to Mihomo;
- user traffic stats как отдельный логический блок.

## Что скрыть до серверной реализации
- `NetcrazeTrafficCard`;
- `HostQosCard`;
- любой UI, завязанный на `agentEnabled` и compatibility-only режиме.

## Итоговое решение
Сделать `TrafficPage` двухслойным:
1. **Runtime traffic** — всегда доступен, если жив Mihomo/runtime.
2. **QoS / shaping / client control** — только когда готов Ubuntu service.

Не надо показывать человеку operational power-buttons, если за ними пока router-legacy или пустота.

---

# 4.3. SubscriptionsPage.vue

## Что сейчас есть
### Основные зоны
1. Имя bundle / режим отбора провайдеров.
2. Инвентарь провайдеров с фильтрами:
   - available only;
   - protocol;
   - country;
   - ручной выбор.
3. HTTPS publication block.
4. Usage modes.
5. Mihomo / Clash subscription block.
6. Universal / JSON / V2RayTun block.
7. Selected providers summary.

## Что реально подключено
- `agentUrl` / `agentToken`
- provider inventory из store/proxies
- provider health helper
- локально вычисляемые published/local URLs
- deep links / QR-коды

## Проблема
Это **очень полезный экран**, но он всё ещё построен на старой идее: источник публикации — `agentUrl` или локальная сборка URL на клиенте.

Для Ubuntu-линии это уже не подходит как основная архитектура.

## Что оставить
- inventory провайдеров;
- фильтры по protocol/country/availability;
- custom provider selection;
- генерацию ссылок как UI-представление;
- QR-коды и deep-links.

## Что переделать
- убрать зависимость от legacy `agentReady` как главного условия;
- published base должен приходить из серверной модели публикации, а не храниться как просто local UI setting;
- статусы `HTTPS ready / local only / needs TLS` должны проверяться не по догадке клиента, а по серверной конфигурации публикации;
- все publish URLs должны строиться от **server-side canonical endpoint**.

## Что можно временно скрыть/упростить
- всё, что делает вид, будто published HTTPS уже продуктово готов для универсального server deployment, если это ещё не закреплено на backend.

## Итоговое решение
`SubscriptionsPage` оставить, но сделать его **чисто server-facing**:
- клиент выбирает состав подписки;
- сервер отдаёт канонические URL публикации;
- клиент только показывает, копирует и кодирует QR.

---

# 4.4. TasksPage.vue

## Масштаб проблемы
- **54 кнопки**
- **31 поле ввода**
- **4 select**
- **7 details/collapse блоков**

Это не страница задач. Это **склад разных подсистем**, часть которых уже надо убрать, часть — перенести в другие разделы, а часть — вообще прятать до появления Ubuntu backend.

## Что сейчас смешано в Tasks

### A. Quick Actions
- Apply enforcement now
- Refresh providers SSL
- Router UI URL + copy actions

### B. Providers panel / SSL
- список провайдеров;
- ручной refresh;
- refresh SSL cache;
- URL панели/подписки;
- warn days;
- icon picker;
- SSL state/output.

### C. Provider traffic debug
- отладка соответствия провайдеров и соединений;
- sync/flush состояния.

### D. Live logs
- Mihomo log / config / agent log;
- auto refresh;
- force refresh.

### E. Data freshness
- GEO update;
- rule providers update;
- rescan local rules;
- freshness refresh;
- geo files;
- local rules;
- top rules.

### F. Diagnostics
- download report;
- summary output.

### G. Upstream tracking
- latest release;
- latest commit;
- compare since last review;
- mark reviewed.

### H. Users DB sync
- pull / push;
- conflict diagnostics;
- conflict preview/export;
- manual resolve;
- smart merge;
- labels / limits / tunnel descriptions / panel URLs / icons / SSL settings merge.

### I. Operations history
- журнал событий/операций.

## Проблема
Это уже не один экран. Это минимум **6 отдельных разделов**, сваленных в один контейнер.

## Что оставить в проекте, но вынести из Tasks
- `Live logs` → в `Хост / Логи`;
- `Data freshness` → в `Settings` или отдельный `Maintenance`;
- `Upstream tracking` → в `About / Release / System`;
- `Users DB sync` → либо удалить вместе с legacy, либо убрать в скрытый compatibility-only контур;
- `Provider traffic debug` → developer/debug-only section, не пользовательский экран.

## Что оставить в Tasks как допустимое ядро
Если страница называется `Задачи`, в ней должны быть только реальные manual jobs, например:
- обновить данные провайдеров;
- обновить GEO;
- обновить правила;
- пересканировать локальные policy/rules;
- посмотреть статус последней задачи.

## Что надо удалить или скрыть первым делом
- agent-specific logs;
- users-db sync UI в текущем виде;
- smart merge conflict monster;
- provider traffic debug из основного пользовательского UI;
- upstream review block;
- роутерные/compatibility-only quick actions без серверного пути выполнения.

## Итоговое решение
`TasksPage` нужно **разрезать** минимум на:
1. `Задачи / Maintenance jobs`
2. `Провайдеры / SSL`
3. `Диагностика`
4. `Служебное / Debug` *(скрыто или dev-only)*

В текущем виде страница не подлежит точечному ремонту. Её нужно перепаковывать по смыслу.

---

# 4.5. UsersPage.vue

## Что сейчас есть
1. `Import LAN hosts`
2. `Source IP labels`
3. переход к `Traffic`

## Проблема
Экран смешивает:
- полезную пользовательскую модель (`source IP labels`);
- router-era импорт LAN hosts;
- users-db sync маркеры;
- топологические действия.

## Что оставить
- `Source IP labels` как отдельный полезный operational mapping block.

## Что скрыть/убрать до backend
- `Import LAN hosts`, если он сидит на legacy agent scan/import;
- sync clouds/markers, если они завязаны на users-db router storage.

## Итоговое решение
`UsersPage` должен стать экраном **идентификации клиентов и user mapping**, а не UI для router-import и sync-конфликтов.

---

# 4.6. PoliciesPage.vue

## Что сейчас есть
- profiles;
- traffic limit;
- bandwidth limit;
- snapshots;
- export/import JSON.

## Проблема
Экран сам по себе нормальный, но сейчас выглядит как часть админки продукта, хотя фактически это в основном **local UI-managed policy presets**.

## Что оставить
- profiles;
- snapshots;
- export/import.

## Что уточнить
- либо честно назвать это `Policy presets` / `Шаблоны ограничений`;
- либо не выдавать это за уже работающий server-side enforcement центр.

## Итоговое решение
Экран можно оставить почти без боли, но нужно чётко развести:
- presets UI;
- реальное применение policy/QoS на сервере.

---

# 4.7. SetupPage.vue

## Что сейчас есть
- backend mode choice;
- backend list;
- recommended path;
- credentials / editing / removing backend.

## Проблема
По смыслу экран нужен, но терминология ещё хранит переходный период:
- compatibility bridge;
- ubuntu service;
- direct modes.

## Что оставить
- выбор backend mode;
- backend registry;
- recommended path.

## Что улучшить
- упростить wording;
- чётко показать пользователю, какой режим production, какой temporary compatibility.

---

## 5. Что уже можно считать хорошим ядром проекта

Эти страницы можно не мучить архитектурно, а просто полировать:
- `OverviewPage.vue`
- `ConnectionsPage.vue`
- `LogsPage.vue`
- `ProxiesPage.vue`
- `ProxyProvidersRoutePage.vue`
- `RulesPage.vue`
- `MihomoPage.vue`
- большая часть `SettingsPage.vue`

Это Mihomo-centric ядро, и оно не выглядит фундаментально ложным.

---

## 6. Что должно войти в первый cleanup-релиз

### Обязательно
1. Убрать legacy auto-bootstrap и agent-first поведение из `HomePage`.
2. Перестроить `RouterPage` в чистый `Хост`.
3. В `TrafficPage` скрыть compatibility-only QoS/Netcraze карточки до server backend.
4. Разрезать/облегчить `TasksPage`.
5. Убрать из пользовательского UI giant users-db conflict UI.
6. Убрать всё, что визуально обещает рабочий Ubuntu backend, когда за ним пока router-era хвост.

### Желательно сразу
7. Переименовать пользовательские термины `Router` → `Хост` везде, где это ещё не добито.
8. В `SubscriptionsPage` отвязать публикацию от legacy `agentUrl` как основного источника.
9. В `UsersPage` оставить только действительно актуальные серверной линии блоки.

---

## 7. Приоритет следующего прохода

### Волна 1
- `HomePage`
- `RouterPage`
- `TrafficPage`
- `TasksPage`

### Волна 2
- `SubscriptionsPage`
- `UsersPage`
- `SetupPage`

### Волна 3
- терминология;
- статусные тексты;
- чистка docs и подсказок;
- вынос debug-only элементов из пользовательского UI.

---

## 8. Вывод без дипломатии

Главная проблема текущей Ubuntu-линии — не одна сломанная SSL-проверка.

Главная проблема в том, что **UI всё ещё partially притворяется готовым серверным продуктом, пока значимая часть operational UX держится на legacy router-era логике или вообще только задумана контрактом.**

Поэтому правильная стратегия сейчас:
- не латать отдельные кнопки;
- не делать ещё 10 “точечных фиксов”;
- а **вырезать ложные/лишние блоки, расчистить пользовательский UI и оставить только честный контур**.

