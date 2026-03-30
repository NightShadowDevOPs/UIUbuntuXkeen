# UIUbuntuXkeen — план работ по релизам

Актуально на: **2026-03-30**  
Текущая версия линии: **v0.5.2**  
Последний подтверждённо рабочий релиз на сервере: **v0.2.10**

## Принцип версионности

- новый набор изменений = новый номер версии;
- старт новой Ubuntu-линии идёт с `0.x`;
- после закрытия MVP и критериев приёмки выходим в `1.0.0`;
- roadmap, release journal, audit и chat-transfer обновляются в каждом релизе.

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
- release flow нового репозитория подтверждён на реальном сервере.

### v0.3.0–v0.4.1 — foundation backend contract и Ubuntu path model
Статус: **сделано как foundation**
- вынесены central project/release constants;
- добавлен Ubuntu backend contract foundation;
- Setup/Edit Backend переведены на hybrid backend mode;
- зафиксирован каноничный лог Mihomo `/var/log/mihomo/mihomo.log`;
- groundwork под host-oriented wording и capability-driven UI стал виден в интерфейсе.

### v0.5.0 — провайдеры: подготовка SSL/TLS-диагностики
Статус: **частично / требует service**
- адаптированы UI-кусочки SSL/TLS diagnostics из старой линии;
- audit показал, что полноценная автоматическая проверка, refresh SSL cache и хранение результата были завязаны на агент и не могут считаться закрытыми без нового Ubuntu service.

### v0.5.1 — глубокий аудит функционального паритета и обновление документации
Статус: **готово**
- выполнен audit Xkeen → Ubuntu по ключевым функциональным контурам;
- добавлен `docs/functional-audit.md`;
- обновлены ТЗ, backend contract, roadmap, release journal и transfer docs;
- roadmap перестроен по реальным operational-блокам, а не по косметическим экранам.

## Текущий приоритет

> Пользователь зафиксировал приоритет: **провайдеры, SSL/сроки, трафик, состояния клиентов, раздел «Хост», ресурсы хоста, GEO-файлы, локальные правила, QoS, shaping**. Safe config flow и structured editors пока отложены.

## Ближайшая очередь

### v0.5.2 — Провайдеры: foundation Ubuntu service
Статус: **сделано как UI/runtime foundation**
- добавлена capability-aware модель для `/api/capabilities`;
- расширен Ubuntu backend contract в коде под provider/GEO/traffic/QoS/jobs endpoint-ы;
- provider runtime в UI теперь умеет читать provider state через Ubuntu service, а не только через legacy agent bridge;
- ручные действия и блокировки в Tasks/Providers теперь завязаны на capability активного backend-а, а не только на старый `agentEnabled`;
- заложены состояния `last check`, `next check`, `job status`, `error` для следующего backend-этапа.

### v0.5.3 — Хост: ресурсы сервера и Mihomo
План:
- раздел **«Хост»** как operational-экран Ubuntu;
- CPU / RAM / load / uptime / disk / network;
- статус Mihomo;
- каноничный лог `/var/log/mihomo/mihomo.log`;
- host-oriented wording без router-era хвостов.

### v0.5.4 — Трафик и состояния клиентов
План:
- графики трафика;
- карточки и таблицы клиентов;
- routed/vpn/bypass/mihomo state;
- usage summary;
- foundation для topology / traffic relations.

### v0.5.5 — GEO-файлы, локальные правила и top rules
План:
- last GEO update;
- GEO history;
- local rules;
- top rules;
- summary по client → rule → provider flows.

### v0.6.0 — QoS / shaping foundation
План:
- API-контракт для qos/shaping;
- runtime state и профили;
- jobs и audit trail;
- UI foundation в разделах **«Хост»** и **«Трафик»**.

### v0.7.0 — Subscriptions / tasks operational parity
План:
- адаптация подписок и сервисных задач под Ubuntu service;
- доведение jobs/status/history до единой модели.

### v0.8.0 — Safe config core
План:
- active / draft / baseline / history;
- validate / apply / rollback;
- операционный журнал изменений.

### v0.9.0 — Structured editors MVP
План:
- structured editors: DNS / Rules / Proxies;
- raw YAML как fallback;
- form-driven сценарий как основной путь работы.

### v1.0.0 — Ubuntu MVP complete
Критерии:
- работа с Mihomo на Ubuntu;
- разделы **«Провайдеры»**, **«Хост»**, **«Трафик»** и **«Задачи»** закрывают ключевой operational функционал;
- есть foundation QoS/shaping и jobs/history;
- есть safe config flow;
- UI ощущается как отдельный Ubuntu-продукт, а не как роутерный UI без агента.

## После v1.0.0

### v1.1.x
- расширенные wizards и шаблоны создания сущностей;
- углубление subscriptions/policies.

### v1.2.x
- audit views;
- automation;
- housekeeping jobs и retention policy для runtime history.

### v1.3.x
- multi-instance support.

### v1.4.x+
- optional desktop wrapper;
- cluster/fleet scenarios.
