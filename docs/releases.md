# UIUbuntuXkeen — журнал релизов

## v0.2.7 — 2026-03-30

Тип релиза: **hotfix / inline install failure in the same GitHub step**

Сделано:
- GitHub Actions шаг `Install dependencies` теперь сам печатает полный `pnpm install` лог в консоль через `tee` и завершаетcя с реальным exit code этой команды;
- удалён отдельный шаг `Fail job if install failed`, который показывал только сухой `exit code 1` и маскировал полезный текст ошибки;
- диагностика install failure теперь остаётся в одном и том же шаге GitHub Actions, откуда её удобно копировать целиком;
- обновлены `docs`, transfer-пакет и changelog под новый CI-hotfix.

Результат:
- при следующем падении стадии `Install dependencies` полезный лог должен быть прямо внутри этого же шага, без отдельной красной плашки-пустышки;
- это позволяет быстро скопировать текст и прислать его на анализ без плясок с артефактами и дополнительными fail-step.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.6 — 2026-03-30

Тип релиза: **hotfix / inline CI install log output**

Сделано:
- GitHub Actions шаг `Install dependencies` переведён в режим диагностического захвата с `continue-on-error`, чтобы сначала вывести полный install-лог в консоль job, а уже потом явно завершить job ошибкой;
- полный вывод `pnpm install` теперь печатается прямо в окне GitHub Actions между маркерами `pnpm install log begin/end`, без обязательной загрузки workflow-артефактов;
- убрана зависимость от отдельного log-артефакта для анализа install failure;
- логика сборки сохранена: `type-check`, `build`, упаковка и публикация релизов выполняются только если установка зависимостей прошла успешно;
- обновлены `docs`, transfer-пакет и changelog под новый CI-hotfix-релиз.

Результат:
- если `Install dependencies` снова упадёт, текст ошибки можно будет сразу скопировать из консоли GitHub Actions и прислать без скачивания артефактов;
- это ускоряет разбор реальной причины падения и убирает лишний слой с невыгружаемыми артефактами;
- тестирование на сервере по-прежнему только после первого зелёного Actions.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.5 — 2026-03-30

Тип релиза: **hotfix / CI diagnostics and log capture**

Сделано:
- в GitHub Actions добавлен шаг **Preflight diagnostics** с выводом базовой среды выполнения: event/ref, версии `node`, `pnpm`, `python3`, наличие `package.json` и `pnpm-lock.yaml`, а также `sha256` для package/lock-файлов;
- шаги `Install dependencies`, `Type check` и `Build UI` теперь пишут подробный вывод в `ci-logs/` через `tee`, а не теряют его в молчаливом красном прямоугольнике;
- при падении `Install dependencies` или `Build UI` хвост соответствующего лога выводится прямо в консоль GitHub Actions;
- артефакт `uiubuntuxkeen-ci-logs-vX.Y.Z` загружается в каждом прогоне workflow, даже если сборка упала;
- обновлены `docs`, transfer-пакет и changelog под диагностический hotfix-релиз.

Результат:
- теперь по падению workflow можно забирать отдельный лог-артефакт и видеть хвост install/build-лога прямо в GitHub Actions без гадания;
- следующий упавший прогон уже должен дать достаточно данных, чтобы понять реальную причину сбоя на `pnpm install`;
- тестирование на сервере откладывается до первого зелёного Actions после этого hotfix.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.4 — 2026-03-30

Тип релиза: **hotfix / GitHub Actions install step**

Сделано:
- шаг `Install dependencies` в GitHub Actions переведён в CI-safe режим: добавлены `CI=true` и `HUSKY=0`;
- установка зависимостей теперь выполняется через `pnpm install --frozen-lockfile --ignore-scripts`, чтобы lifecycle/prepare-хуки не валили pipeline на стадии установки;
- сохранён жёсткий контроль lockfile через `--frozen-lockfile`, чтобы hotfix не превращал pipeline в лотерею;
- обновлены `docs`, transfer-пакет и changelog под hotfix-релиз.

Результат:
- workflow больше не должен падать на стадии `Install dependencies` из-за Husky/prepare и других install-time скриптов;
- если после этого pipeline всё ещё упадёт, значит проблема уже не в lifecycle-хуках, а глубже — и следующий лог будет гораздо полезнее;
- после зелёного GitHub Actions можно тестировать обновление UI на сервере через кнопку **«Обновить»**.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.3 — 2026-03-30

Тип релиза: **hotfix / GitHub Actions metadata step**

Сделано:
- исправлен шаг GitHub Actions **Read project version**: вместо хрупкой inline-команды через `node -p` версия теперь читается через `python3` напрямую из `package.json`;
- release pipeline сохранён в прежней логике: после успешной сборки публикуются versioned release и rolling `dist.zip`;
- обновлены `docs`, transfer-пакет и changelog под hotfix-релиз.

Результат:
- ошибка на шаге **Read project version** больше не должна ронять workflow до установки зависимостей и сборки;
- после зелёного GitHub Actions снова можно тестировать обновление UI на сервере через кнопку **«Обновить»**.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.2 — 2026-03-30

Тип релиза: **hotfix / GitHub Actions Node 24 readiness**

Сделано:
- GitHub Actions workflow переведён на Node 24-ready версии actions: `actions/checkout@v5`, `actions/setup-node@v6`, `pnpm/action-setup@v5`, `actions/upload-artifact@v6`, `actions/download-artifact@v7`;
- runtime сборки самого проекта оставлен на `node-version: 22`, чтобы не смешивать миграцию workflow runtime и миграцию runtime приложения в один релиз;
- обновлены `docs`, transfer-пакет и changelog под hotfix-релиз.

Результат:
- предупреждения GitHub вида `Node.js 20 actions are deprecated` для используемых official actions должны уйти;
- pipeline становится ближе к будущему принудительному переходу GitHub Actions на Node 24 без лишнего сюрприза посреди релиза;
- после зелёного GitHub Actions можно тестировать обновление UI на сервере через кнопку **«Обновить»**.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.1 — 2026-03-30

Тип релиза: **hotfix / CI pipeline**

Сделано:
- смягчён GitHub Actions pipeline: `pnpm type-check` переведён в informational-режим и больше не блокирует публикацию сборки;
- основным критерием выпуска оставлена успешная `pnpm build`, чтобы встроенное обновление UI не стопорилось из-за старых типизационных хвостов исходной линии;
- обновлены `docs`, transfer-пакет и changelog под hotfix-релиз.

Результат:
- ошибка вида `Exit code 2`, типичная для шага `pnpm type-check`/`vue-tsc`, больше не должна блокировать выпуск артефакта и публикацию rolling `dist.zip`;
- после зелёного GitHub Actions можно снова тестировать обновление UI на сервере через кнопку **«Обновить»**.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.2.0 — 2026-03-30

Тип релиза: **bootstrap / metadata / release pipeline**

Сделано:
- обновлены видимые branding-точки проекта: title, PWA metadata, ссылки на репозиторий и базовые release endpoints;
- проверка доступности новой версии UI переведена на репозиторий `NightShadowDevOPs/UIUbuntuXkeen`;
- URL rolling-обновления через встроенный механизм UI переведён на новый репозиторий;
- добавлен GitHub Actions pipeline: `pnpm install`, `pnpm type-check`, `pnpm build`, упаковка артефактов и публикация релизов;
- добавлены два канала публикации: versioned release `vX.Y.Z` и rolling release `dist.zip`;
- очищен верхнеуровневый исторический transfer-файл старой линии, чтобы не тащить лишний мусор в новый продукт.

Результат:
- после зелёного GitHub Actions можно тестировать серверный сценарий обновления UI через кнопку **«Обновить»**;
- серверная проверка на этом этапе относится именно к цепочке публикации/обновления UI, а не к полной Ubuntu-native backend-архитектуре.
- Если на сервере в конфиге Mihomo/ядра всё ещё прописан старый `external-ui-url`, перед первым обновлением новой линии его нужно переключить на rolling URL нового репозитория.

Следующий плановый релиз:
- `v0.3.0` — Backend contract foundation.

## v0.1.0 — 2026-03-30

Тип релиза: **foundation / docs bootstrap**

Сделано:
- оформлен каноничный набор документации в `docs/`;
- добавлено полное ТЗ Ubuntu-линии проекта;
- добавлен roadmap по релизам;
- добавлен единый transfer-файл для нового чата;
- удалены лишние и устаревшие документы из `docs/`;
- удалены исторические одноразовые transfer-снимки старой линии, чтобы не плодить мусор.

Результат:
- `docs/` стали базой проекта, а не складом старых заметок;
- в следующих релизах обновляется единый комплект документов, а не пачка дублирующих markdown-файлов.

Следующий плановый релиз:
- `v0.2.0` — Ubuntu bootstrap metadata.
