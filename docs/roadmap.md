# UIUbuntuXkeen — план работ по релизам

Актуально на: **2026-03-30**  
Текущая версия линии: **v0.3.2**  
Последний подтверждённо рабочий релиз на сервере: **v0.2.10**

## Принцип версионности

- новый набор изменений = новый номер версии;
- старт новой Ubuntu-линии идёт с `0.x`;
- после закрытия MVP и критериев приёмки выходим в `1.0.0`;
- roadmap, release journal и chat-transfer обновляются в каждом релизе.

## Уже сделано

### v0.1.0 — Ubuntu bootstrap docs foundation
Статус: **готово**
- приведён к норме комплект документов в `docs/`;
- добавлены полное ТЗ, roadmap, журнал релизов и transfer-файл;
- удалены лишние устаревшие документы из `docs/`.

### v0.2.0–v0.2.9 — CI/bootstrap и зачистка стартовой базы
Статус: **готово**
- настроен GitHub Actions pipeline;
- добавлены versioned release и rolling `dist.zip`;
- стабилизирован install/build flow для нового репозитория;
- вычищены первые TypeScript-аннотации и хвосты, мешавшие выпуску сборки.

### v0.2.10 — первый подтверждённо рабочий серверный релиз
Статус: **готово и подтверждено**
- сборка проходит;
- обновление через кнопку **«Обновить»** в UI прошло успешно;
- release flow для нового репозитория подтверждён на реальном сервере.

### v0.3.0 — Backend contract foundation
Статус: **готово, ожидает серверной проверки**
- вынесены central project/release constants;
- заложен Ubuntu backend contract foundation;
- добавлены типы backend kind/capabilities;
- add/update backend проходят через normalization layer;
- начало перевода раздела `router` в host-oriented смысл на уровне UI-названий.

### v0.3.1 — Hybrid backend setup polish
Статус: **готово, ожидает серверной проверки**
- в Setup и Edit Backend добавлен явный выбор backend mode;
- добавлен рекомендуемый secondary path для `compatibility-bridge` и `ubuntu-service`;
- список backend-ов в Setup показывает режим direct/ubuntu-service;
- groundwork под hybrid-модель: direct Mihomo + Ubuntu service.

### v0.3.2 — Runtime/setup contract preview
Статус: **готово, ожидает серверной проверки**
- Setup и Edit Backend теперь показывают backend contract preview: базовый URL, probe/runtime endpoint-ы и каноничные Ubuntu paths;
- runtime workspace начал переключать visible wording между router-oriented и host-oriented режимом;
- groundwork под capability-driven observability стал виден в UI, а не только в docs.

## Ближайшая очередь

### v0.4.0 — Runtime / Setup / Observability data foundation
План:
- начать реальное чтение status/health/capabilities для Ubuntu service;
- подготовить host metrics / logs / connections foundation;
- начать capability-driven переключение UI по данным backend-а;
- оформить hybrid data model: что идёт напрямую в Mihomo, а что — через Ubuntu service;
- продолжить замену router runtime на host runtime в рабочих экранах.

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
