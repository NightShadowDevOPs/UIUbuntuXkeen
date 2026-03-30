# UIUbuntuXkeen — план работ по релизам

Актуально на: **2026-03-30**  
Текущая версия линии: **v0.6.2**  
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

### v0.5.2 — Провайдеры: foundation Ubuntu service
Статус: **сделано как UI/runtime foundation**
- добавлена capability-aware модель для `/api/capabilities`;
- расширен Ubuntu backend contract в коде под provider/GEO/traffic/QoS/jobs endpoint-ы;
- provider runtime в UI теперь умеет читать provider state через Ubuntu service, а не только через legacy agent bridge;
- ручные действия и блокировки в Tasks/Providers теперь завязаны на capability активного backend-а, а не только на старый `agentEnabled`;
- заложены состояния `last check`, `next check`, `job status`, `error` для следующего backend-этапа.

### v0.5.3 — Хост: foundation под Ubuntu service
Статус: **сделано как foundation, потребовал hotfix**
- раздел **«Хост»** был перестроен под Ubuntu service контур;
- добавлены зоны **Обзор хоста / Сервисы / Логи**;
- UI научен нормализовать `/api/status`, `/api/system/resources`, `/api/system/services`, `/api/system/logs`;
- но секции оказались слишком жёстко привязаны к `ubuntu-service` и в текущем рабочем режиме были практически не видны пользователю.

### v0.5.4 — Хост: functional hotfix compatibility fallback
Статус: **сделано**
- секции **Сервисы / Логи** стали доступны и в compatibility bridge-режиме;
- runtime-карточка умеет брать CPU/RAM/storage/uptime через существующий agent/status fallback;
- логи Mihomo и agent/service теперь читаются через живой fallback, а не только через будущий `/api/system/logs`;
- groundwork под полный Ubuntu service сохранён, но экран уже даёт практическую пользу.

## Текущий приоритет

> Пользователь зафиксировал приоритет: **провайдеры, SSL/сроки, трафик, состояния клиентов, раздел «Хост», ресурсы хоста, GEO-файлы, локальные правила, QoS, shaping**. Safe config flow и structured editors пока отложены.

## Ближайшая очередь

### v0.5.5 — Трафик и состояния клиентов
Статус: **сделано как рабочий traffic workspace**
- раздел **«Трафик»** собран в единый operational workspace;
- добавлена сводка по клиентам, соединениям и текущим скоростям;
- добавлена таблица клиентов по IP со статусами **Mihomo / VPN / bypass / observed**;
- live connections и user-traffic теперь доступны на одной странице;
- compatibility-режим показывает host traffic и QoS прямо в разделе **«Трафик»** через существующий agent bridge.

### v0.5.6 — Трафик: practical hotfix по synthetic IP и degraded telemetry
Статус: **сделано**
- убран шумный generic `Network Error`, когда optional `host_traffic_live` недоступен;
- синтетические/system IP без host evidence исключены из таблицы клиентов и summary;
- экран **«Трафик»** теперь честно деградирует до режима **только Mihomo**, а не делает вид, что всё сломалось.

### v0.6.0 — ошибочный SSL workspace в «Прокси-провайдерах»
Статус: **откачено в v0.6.1**
- в `v0.6.0` SSL-проверка была ошибочно вынесена в список **«Прокси-провайдеры»**;
- это противоречило текущей архитектуре проекта, где SSL-контур живёт в разделе **«Задачи»**;
- релиз нельзя считать правильным продуктовым направлением, даже если часть действий визуально работала.

### v0.6.1 — rollback misplaced provider SSL workspace
Статус: **сделано**
- ошибочно добавленный workspace удалён из раздела **«Прокси-провайдеры»**;
- список провайдеров снова очищен от лишней SSL/TLS панели;
- docs приведены к реальному состоянию проекта без ложных заявлений о закрытом SSL MVP;
- текущий правильный курс: развивать SSL-проверки через **«Задачи»** и существующий provider-health flow.

### v0.6.2 — Tasks SSL by provider/subscription source URL
Статус: **сделано**
- SSL-таблица в разделе **«Задачи»** больше не завязана на `panelUrl`;
- проверка и отображение сертификата переведены на **provider/subscription source URL**;
- `Обновить SSL провайдеров` снова использует существующий provider-health / SSL cache refresh flow;
- экран соответствует архитектуре проекта: SSL живёт в **«Задачах»**, а не в списке прокси-провайдеров.

### v0.6.3 — provider scheduler/history и GEO groundwork
Статус: **следующий шаг**
План:
- добавить `next check`, `last successful run`, job/history для provider SSL checks;
- вывести GEO last update и GEO history как соседний operational блок;
- подготовить storage/state контур под scheduler результаты и историю проверок.

### v0.6.4 — QoS и shaping под Ubuntu
План:
- host shaping profiles;
- per-client bandwidth/QoS status;
- диагностика применённых ограничений;
- сценарии apply/remove/reconcile.
