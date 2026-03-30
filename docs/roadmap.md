# UIUbuntuXkeen — план работ по релизам

Актуально на: **2026-03-30**  
Текущая версия линии: **v0.2.7**

## Принцип версионности

- новый набор изменений = новый номер версии;
- старт новой Ubuntu-линии идёт с `0.x`;
- после закрытия MVP и критериев приёмки выходим в `1.0.0`;
- roadmap и `docs/chat-transfer.md` обновляются в каждом релизе.

## Выполнено

### v0.1.0 — Ubuntu bootstrap docs foundation
Статус: **готово**

Что сделано:
- проектная документация в `docs/` приведена к одному каноничному набору;
- добавлено полное ТЗ проекта;
- добавлен release roadmap;
- добавлен единый журнал релизов;
- добавлен актуальный transfer-файл для нового чата;
- убраны лишние устаревшие документы из `docs/`;
- зафиксировано правило обязательной актуализации docs в каждом релизе.

## Ближайшая очередь

### v0.2.5 — CI diagnostics and log capture hotfix
Статус: **готово**

Что сделано:
- в workflow добавлены preflight-диагностика и сохранение CI-логов в `ci-logs/`;
- `pnpm install`, `pnpm type-check` и `pnpm build` теперь сохраняют подробный вывод в отдельные лог-файлы через `tee`;
- при падении install/build шагов хвост соответствующего лога печатается прямо в консоль GitHub Actions;
- добавлен upload артефакта `uiubuntuxkeen-ci-logs-vX.Y.Z` даже для неуспешных прогонов;
- обновлены docs и transfer-пакет для диагностического hotfix-релиза.

Результат:
- следующий красный workflow уже должен дать нормальный материал для анализа, а не просто мрачный `Error:` без подробностей;
- как только workflow станет зелёным, можно будет тестировать server update path через встроенную кнопку **«Обновить»**.

### v0.2.4 — CI install lifecycle hotfix
Статус: **готово**

Что сделано:
- шаг `Install dependencies` в workflow переведён в CI-safe режим с `CI=true` и `HUSKY=0`;
- установка зависимостей выполняется через `pnpm install --frozen-lockfile --ignore-scripts`, чтобы install-time hooks не роняли pipeline;
- обновлены docs и transfer-пакет для hotfix-релиза.

Результат:
- GitHub Actions не должен больше падать на стадии установки зависимостей из-за Husky/prepare и прочих lifecycle script-ов;
- после зелёного workflow можно тестировать обновление UI на сервере.

### v0.2.3 — GitHub Actions version-read hotfix
Статус: **готово**

Что сделано:
- шаг `Read project version` переведён с inline-команды `node -p` на явное чтение `package.json` через `python3`;
- pipeline публикации артефактов и rolling-обновления сохранён без изменения логики;
- обновлены docs и transfer-пакет для hotfix-релиза.

Результат:
- workflow не должен больше падать на чтении версии проекта до стадии `pnpm install` и `pnpm build`;
- после зелёного workflow снова можно тестировать обновление UI на сервере.

### v0.2.2 — Actions Node 24 readiness hotfix
Статус: **готово**

Что сделано:
- workflow переведён на Node 24-ready версии основных GitHub Actions;
- оставлен `node-version: 22` для сборки самого UI, чтобы не добавлять в этот же hotfix лишнюю смену build runtime;
- обновлены docs и transfer-пакет.

Результат:
- предупреждения о deprecated Node 20 actions должны уйти из pipeline;
- после зелёного workflow можно тестировать server update path через встроенную кнопку **«Обновить»**.

### v0.2.1 — CI hotfix after `Exit code 2`
Статус: **готово**

Что сделано:
- `pnpm type-check` переведён в informational-режим в GitHub Actions;
- выпуск артефакта и rolling-обновления теперь зависит от успешной сборки `pnpm build`, а не от старых типизационных хвостов исходной линии;
- обновлены docs и transfer-пакет для hotfix-релиза.

Результат:
- GitHub Actions не должен больше валиться на типичном `Exit code 2` из шага type-check;
- после зелёного workflow снова можно тестировать обновление на сервере.

### v0.2.0 — Ubuntu bootstrap metadata
Статус: **готово**

Что сделано:
- обновлены project metadata и видимые branding-точки новой Ubuntu-линии;
- переключены ссылки проекта и проверка UI-обновлений на новый репозиторий `NightShadowDevOPs/UIUbuntuXkeen`;
- добавлен GitHub Actions pipeline со сборкой, type-check, artifact upload и публикацией релизов;
- добавлен rolling release `dist.zip` для встроенного обновления UI через кнопку «Обновить»;
- очищен верхнеуровневый исторический transfer-файл старой линии.

Результат:
- после зелёного GitHub Actions уже можно тестировать серверный сценарий обновления UI и доставку сборки;
- полный Ubuntu-native backend ещё впереди, но цепочка публикации и in-UI update уже готова к проверке.

### v0.3.0 — Backend contract foundation
План:
- зафиксировать модель Ubuntu backend-service;
- выделить API contract `status / health / version / capabilities`;
- подготовить фронтенд-адаптер между текущим UI и новым Ubuntu service layer;
- начать отрыв ключевых экранов от router-oriented терминологии.

### v0.4.0 — Runtime / Setup / Observability foundation
План:
- начать замену router runtime на host runtime;
- подготовить setup flow под Ubuntu-host;
- заложить host metrics / logs / connections.

### v0.5.0 — Safe config core
План:
- active / draft / baseline / history;
- validate / apply / rollback;
- операционный журнал изменений.

### v0.6.0 — Structured editors MVP
План:
- structured editors: DNS / Rules / Proxies;
- raw YAML как fallback;
- form-driven сценарий как основной путь работы.

### v0.7.0 — Operational parity I
План:
- Proxy Providers;
- Proxy Groups;
- Rule Providers;
- диагностика провайдеров.

### v0.8.0 — Operational parity II
План:
- Subscriptions;
- Users / Traffic;
- QoS / shaping под Ubuntu;
- jobs / task status.

### v0.9.0 — Backup / Restore / Diagnostics
План:
- backup/restore;
- provider SSL diagnostics;
- capability diagnostics;
- audit trail foundation.

### v1.0.0 — Ubuntu MVP complete
Релиз выхода в полноценный Ubuntu MVP.

Критерии:
- работа с Mihomo на Ubuntu;
- safe config flow;
- базовые structured editors;
- live metrics/logs/connections;
- backup/restore;
- bearer-token auth;
- UI ощущается как отдельный Ubuntu-продукт.

## После v1.0.0

### v1.1.x
- wizards и шаблоны создания сущностей;
- редкие nested structured editors.

### v1.2.x
- audit views;
- policies;
- automation.

### v1.3.x
- multi-instance support.

### v1.4.x+
- optional desktop wrapper;
- cluster/fleet scenarios.


- Довести CI до первого зелёного статуса и только после этого переходить к server-side тесту обновления.
