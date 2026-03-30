# UIUbuntuXkeen — план работ по релизам

Актуально на: **2026-03-30**  
Текущая версия линии: **v0.1.0**

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

### v0.2.0 — Ubuntu bootstrap metadata
План:
- привести `README.md` и release metadata к новой идентичности проекта;
- обновить package metadata под Ubuntu-линейку;
- убрать явные роутерные описания из стартовых документов и entry points;
- подготовить основу для GitHub Actions проверки сборки.

### v0.3.0 — Backend contract foundation
План:
- зафиксировать модель Ubuntu backend-service;
- выделить API contract `status / health / version / capabilities`;
- подготовить фронтенд-адаптер между текущим UI и новым Ubuntu service layer.

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
