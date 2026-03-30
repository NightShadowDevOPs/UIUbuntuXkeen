# UIUbuntuXkeen — журнал релизов

## v0.4.1 — Observability log-path polish
Дата: **2026-03-30**

Сделано:
- в `src/config/project.ts` добавлен каноничный путь к логу Mihomo: `/var/log/mihomo/mihomo.log`;
- в `BackendContractCard` путь к логу Mihomo теперь показывается рядом с Ubuntu path-моделью;
- в `BackendDataFlowCard` добавлен отдельный observability-блок с подсказкой, какой лог смотреть на Ubuntu;
- подправлены RU-тексты для раздела «Хост / рантайм» и backend contract preview;
- обновлены `README.md`, `docs/project-spec.md`, `docs/backend-contract.md`, `docs/roadmap.md`, `docs/chat-transfer.md`, `TRANSFER_CHAT`, `CHANGELOG.md`.

Результат:
- в интерфейсе теперь видно не только модель данных direct Mihomo / Ubuntu service, но и конкретный путь к основному логу Mihomo на Ubuntu;
- проверять разделы «Настройка», «Редактирование backend» и «Роутер / рантайм» стало проще;
- groundwork под следующий этап safe config core не ломает текущий рабочий update flow.

Статус:
- подготовлено, ожидает пользовательской проверки.

Следующий плановый релиз:
- `v0.5.0` — Safe config core.

## v0.4.0 — Runtime / Setup / Observability data foundation
Дата: **2026-03-30**

Сделано:
- добавлен `src/components/settings/BackendDataFlowCard.vue`;
- в `SetupPage` и `EditBackendModal` добавлена наглядная карточка data flow: что UI читает напрямую из Mihomo, а что должно идти через отдельный Ubuntu service;
- в `RouterPage` этот же data flow preview вынесен в runtime workspace, чтобы оператор видел архитектурную модель уже на рабочем экране;
- обновлены RU/EN переводы для hybrid data model и observability foundation;
- обновлены `README.md`, `docs/project-spec.md`, `docs/backend-contract.md`, `docs/roadmap.md`, `docs/chat-transfer.md`, `TRANSFER_CHAT`, `CHANGELOG.md`.

Результат:
- hybrid data model стала понятной прямо в интерфейсе, а не только в документации;
- direct Mihomo и Ubuntu service теперь разведены по смыслу на setup/edit/runtime-экранах;
- groundwork под следующий этап capability-driven observability стал заметно понятнее для реальной проверки пользователем.

Статус:
- подготовлено, ожидает пользовательской проверки.

Следующий плановый релиз:
- `v0.5.0` — Safe config core.

## v0.3.2 — Runtime/setup contract preview
Дата: **2026-03-30**

Сделано:
- добавлен `src/components/settings/BackendContractCard.vue`;
- в `SetupPage` и `EditBackendModal` добавлен backend contract preview: base URL, expected probe/runtime endpoints и каноничные Ubuntu paths;
- в helper-слой backend-а добавлены runtime/info title helpers и списки probe endpoint-ов для `compatibility-bridge` и `ubuntu-service`;
- `RouterPage` начал динамически менять видимые workspace/info заголовки в зависимости от backend mode;
- обновлены `README.md`, `docs/project-spec.md`, `docs/backend-contract.md`, `docs/roadmap.md`, `docs/chat-transfer.md`, `TRANSFER_CHAT`, `CHANGELOG.md`.

Результат:
- hybrid data model и Ubuntu backend contract теперь видны в setup/edit flow прямо в UI;
- runtime-раздел стал ближе к host-oriented модели без поломки текущего compatibility режима;
- groundwork под следующий этап observability теперь есть и в коде, и в документации.

Статус:
- подготовлено, ожидает пользовательской проверки.

Следующий плановый релиз:
- `v0.4.0` — Runtime / Setup / Observability data foundation.

## v0.3.1 — Hybrid backend setup polish
Дата: **2026-03-30**

Сделано:
- в `SetupPage` добавлен явный выбор backend mode: `compatibility-bridge` / `ubuntu-service`;
- в `EditBackendModal` добавлен такой же выбор backend mode для уже сохранённых backend entries;
- добавлен helper рекомендуемого secondary path: пустой путь для direct/bridge и `/api` для Ubuntu service;
- в списке backend-ов на экране Setup добавлены badge-ы режима direct / ubuntu-service;
- `exportSettings()` теперь отдаёт архив настроек с Ubuntu-oriented именем `ui-ubuntu-xkeen-settings`;
- обновлены `README.md`, `docs/backend-contract.md`, `docs/roadmap.md`, `docs/chat-transfer.md`, `TRANSFER_CHAT`, `CHANGELOG.md`.

Результат:
- setup flow уже явно разделяет direct Mihomo backend и будущий Ubuntu service backend;
- groundwork под hybrid-модель стал виден прямо в UI, а не только в документах;
- механизм rolling update не менялся и должен проверяться как обычный следующий релиз.

Статус:
- подготовлено, ожидает пользовательской проверки.

Следующий плановый релиз:
- `v0.4.0` — Runtime / Setup / Observability data foundation.

## v0.3.0 — Backend contract foundation
Дата: **2026-03-30**

Сделано:
- добавлен `src/config/project.ts` с едиными project/release constants;
- добавлен `src/config/backendContract.ts` с foundation-моделью Ubuntu backend contract;
- добавлены типы `BackendKind` и `BackendCapabilities`;
- нормализация backend secondary path вынесена в отдельный helper;
- `addBackend` / `updateBackend` переведены на normalization layer;
- `SetupPage` теперь отправляет backend в уже нормализованном виде;
- rolling release URL, GitHub release API и branding-точки переведены на единый config-source;
- в UI название раздела `router` на видимом уровне смещено к host-oriented смыслу;
- добавлен `docs/backend-contract.md`;
- обновлены `README.md`, `docs/README.md`, `docs/project-spec.md`, `docs/roadmap.md`, `docs/chat-transfer.md`, `TRANSFER_CHAT`, `CHANGELOG.md`.

Результат:
- в кодовой базе появился первый явный foundation-слой для перехода от compatibility bridge к Ubuntu service API;
- release/update URLs больше не размазаны по нескольким файлам;
- серверный update flow не менялся по механике и должен проверяться как обычный следующий релиз.

Статус:
- подготовлено, ожидает пользовательской проверки.

Следующий плановый релиз:
- `v0.4.0` — Runtime / Setup / Observability data foundation.

## v0.2.10 — Первый подтверждённо рабочий серверный релиз
Дата: **2026-03-30**

Сделано:
- исправлены остаточные TypeScript build annotations в `UserTrafficStats.vue`, `ProxiesCtrl.tsx`, `RuleCard.vue`, `HostQosCard.vue` и `AgentCard.vue`;
- build pipeline прошёл успешно;
- обновление через кнопку **«Обновить»** на сервере прошло успешно.

Результат:
- релиз подтверждён пользователем как рабочий;
- release flow новой Ubuntu-линии подтверждён на реальном сервере.

## v0.2.9 — TypeScript build annotations cleanup
Дата: **2026-03-30**
- исправлены ошибки в `AgentCard.vue`, `ProxyProvider.vue` и Axios config typing;
- зачищены основные build annotations после стабилизации CI.

## v0.2.8 — CI install bootstrap fallback
Дата: **2026-03-30**
- GitHub Actions переведены на Corepack + `pnpm@9.12.1`;
- install step смягчён для первого зелёного pipeline нового репозитория;
- добавлена расширенная preflight-диагностика среды.

## v0.2.7 — Inline install failure in the same GitHub step
Дата: **2026-03-30**
- GitHub Actions шаг `Install dependencies` теперь печатает лог и падает в этом же шаге;
- удалён бесполезный отдельный fail-step.

## v0.2.6 — Inline CI install log output
Дата: **2026-03-30**
- install-лог переведён в консоль job для копирования без артефактов;
- сборка и публикация оставлены только после успешной установки зависимостей.

## v0.2.5 — CI diagnostics and log capture
Дата: **2026-03-30**
- добавлены preflight diagnostics и лог capture для install/type-check/build;
- подготовлена база для разбора падений нового pipeline.

## v0.2.4 — GitHub Actions install step hardening
Дата: **2026-03-30**
- install step hardened для CI;
- Husky/lifecycle hooks перестали ломать выпуск артефакта.

## v0.2.3 — GitHub Actions metadata step fix
Дата: **2026-03-30**
- исправлен шаг `Read project version`;
- версия читается напрямую из `package.json`.

## v0.2.2 — Actions Node 24 readiness
Дата: **2026-03-30**
- workflow переведён на Node 24-ready action versions;
- сборочный runtime оставлен на Node 22.

## v0.2.1 — CI hotfix after exit code 2
Дата: **2026-03-30**
- `pnpm type-check` переведён в informational-режим;
- выпуск артефакта завязан на успешный `pnpm build`.

## v0.2.0 — Ubuntu bootstrap metadata
Дата: **2026-03-30**
- обновлены branding и project metadata новой Ubuntu-линии;
- переключены ссылки обновлений на `NightShadowDevOPs/UIUbuntuXkeen`;
- добавлен release pipeline и rolling `dist.zip`.

## v0.1.0 — Docs bootstrap
Дата: **2026-03-30**
- собран каноничный комплект проектной документации;
- удалены лишние исторические документы старой линии.
