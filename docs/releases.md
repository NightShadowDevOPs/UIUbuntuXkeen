# UIUbuntuXkeen — журнал релизов

## v0.5.2 — провайдеры: foundation Ubuntu service в UI runtime
Дата: **2026-03-30**

Сделано:
- добавлен capability-aware foundation-слой для `ubuntu-service` backend-а;
- расширены `BackendCapabilities` и `UBUNTU_BACKEND_ENDPOINTS` под provider/GEO/traffic/QoS/jobs контуры;
- добавлены `src/helper/backendCapabilities.ts`, `src/store/backendCapabilities.ts`, `src/api/ubuntuService.ts`;
- `src/store/providerHealth.ts` переведён на общую модель: legacy agent bridge **или** Ubuntu service provider endpoints;
- `TasksPage` больше не блокирует provider SSL/runtime-контур только по старому `agentEnabled`, а честно смотрит на capabilities активного backend-а;
- обновлены README, roadmap, transfer docs и журнал релизов.

Результат:
- UI перестал считать provider runtime агент-эксклюзивной функцией;
- появился нормальный foundation для следующего шага, где backend уже начнёт реально отдавать provider checks, cache status и jobs;
- миграция в Ubuntu-line стала чуть менее «рисуем карточки, но данных нет» и чуть более честной.

Статус:
- foundation-релиз UI; для полного эффекта нужен следующий backend/service этап.

Следующий плановый релиз:
- `v0.5.3` — Хост: ресурсы сервера и Mihomo.

## v0.5.1 — глубокий аудит функционального паритета и пакет документации для переноса
Дата: **2026-03-30**

Сделано:
- выполнен глубокий аудит функционального паритета линии **UltraUIXkeen 1.2.106** и текущей Ubuntu-линии;
- добавлен новый документ `docs/functional-audit.md`;
- обновлено полное ТЗ проекта в `docs/project-spec.md`;
- обновлён `docs/backend-contract.md` с явной моделью Ubuntu service, scheduler и SQLite-хранилища;
- перестроен `docs/roadmap.md` под реальные приоритеты: провайдеры, хост, трафик, GEO, QoS и shaping;
- обновлены `docs/chat-transfer.md`, `TRANSFER_CHAT`, `README.md`, `CHANGELOG.md`;
- подготовлен новый пакет документации для переноса в новый чат.

Результат:
- проект теперь имеет не только общую архитектурную идею, но и честную карту функционального паритета;
- стало явно видно, что можно брать напрямую из Mihomo, а что требует нового Ubuntu service;
- roadmap перестроен под реальный operational перенос, а не под косметические экраны.

Статус:
- документационный релиз, серверного теста не требует.

Следующий плановый релиз:
- `v0.5.2` — Провайдеры: foundation Ubuntu service.

## v0.5.0 — Провайдеры: SSL / TLS и диагностика
Дата: **2026-03-30**

Сделано:
- в старую линию Xkeen уже был встроен полезный контур SSL-проверок провайдеров; в этом релизе он адаптирован по UI-слою для Ubuntu-линии;
- в карточках/панелях провайдеров сохранены поля даты истечения, URL проверки и текста ошибки probe;
- обновлены документы и transfer-файл.

Результат:
- стало видно, какие поля нужны для provider SSL diagnostics;
- последующий audit показал, что для полноценной автоматической проверки нужен новый Ubuntu service.

Статус:
- подготовлено как foundation, но не закрывает полный провайдерный контур без service.

## v0.4.1 — observability log-path polish
Дата: **2026-03-30**
- в Setup, Edit Backend и host/runtime карточках показан каноничный лог Mihomo `/var/log/mihomo/mihomo.log`.

## v0.4.0 — runtime/setup data-flow preview
Дата: **2026-03-30**
- UI стал показывать разницу между direct Mihomo data и тем, что должен давать Ubuntu service.

## v0.3.2 — runtime/setup contract preview
Дата: **2026-03-30**
- Setup и Edit Backend показывают backend contract preview: base URL, expected probe/runtime endpoint-ы и каноничные Ubuntu paths.

## v0.3.1 — hybrid backend setup polish
Дата: **2026-03-30**
- добавлен явный выбор backend mode: `compatibility-bridge` / `ubuntu-service`.

## v0.3.0 — backend contract foundation
Дата: **2026-03-30**
- добавлен foundation-слой project/release constants и backend kinds/capabilities.

## v0.2.10 — первый подтверждённо рабочий серверный релиз
Дата: **2026-03-30**
- сборка прошла;
- сервер успешно обновился через кнопку **«Обновить»**.

## v0.2.9 — TypeScript build annotations cleanup
Дата: **2026-03-30**
- исправлены build annotations после стабилизации CI.

## v0.2.8 — CI install bootstrap fallback
Дата: **2026-03-30**
- GitHub Actions переведены на Corepack + `pnpm@9.12.1`;
- install step смягчён для первого зелёного pipeline нового репозитория.

## v0.2.7 — inline install failure in the same GitHub step
Дата: **2026-03-30**
- лог install failure печатается в том же шаге.
