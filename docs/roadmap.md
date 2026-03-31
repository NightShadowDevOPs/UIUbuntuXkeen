# UIUbuntuXkeen — план работ по релизам

Актуально на: **2026-03-31**  
Текущая версия линии: **v0.6.20**  
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

### v0.6.5 — Tasks providers list and form audit
Статус: **сделано**
- список провайдеров в Tasks больше не зависит только от provider-health/checks backend ответа;
- Tasks теперь best-effort подтягивает proxy providers store и использует сохранённые URL подписок/иконки/SSL override-настройки как дополнительные источники списка;
- docs зафиксировали каноничную структуру раздела **«Задачи»**: быстрые действия, провайдеры, live logs, актуальность данных, диагностика, upstream, users DB, история операций.

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

### v0.6.3 — build/install stabilization
Статус: **сделано**
- добавлен `.npmrc` с отключённым frozen lockfile для CI/install стабилизации;
- зависимость `prettier-plugin-tailwindcss` возвращена к версии `^0.6.14`, совпадающей с текущим `pnpm-lock.yaml`;
- docs и transfer-файлы переведены в режим стабилизации: сначала зелёный install/build, затем следующий функциональный шаг по SSL в **«Задачах»**.

### v0.6.4 — Tasks alignment: 3x-ui subscription URLs
Статус: **сделано**
- раздел **«Задачи»** приведён к целевому виду: блок провайдеров открыт по умолчанию и показывает редактируемые ссылки подписок;
- URL 3x-ui подписок можно задавать прямо в таблице Tasks и в карточке провайдера;
- SSL/TLS-опрос в Tasks приоритетно идёт по сохранённым URL подписок провайдеров;
- терминология очищена от ложной модели «панелей управления» там, где речь идёт именно о ссылке подписки.

### v0.6.6 — Tasks providers SSL operational polish
Статус: **сделано**
- раздел **«Задачи»** доведён ближе к эталонной форме со скринов без переноса SSL-логики в список прокси-провайдеров;
- список провайдеров сохраняет реальный порядок provider sources и не теряет локально сохранённые subscription URL при временной недоступности backend checks;
- в блоке провайдеров показаны сводные счётчики по URL/ошибкам/скорым истечениям и явный checked/error meta line по каждому URL 3x-ui подписки;
- docs уточнили границу ответственности: Providers задают subscription URL, Tasks показывает SSL/TLS operational state.

### v0.6.10 — Tasks provider SSL cache flow (no blocking batch probe)
- список провайдеров в разделе **«Задачи»** больше не должен исчезать целиком при backend/provider-check ошибке;
- direct SSL/TLS probe обязан использовать effective URL 3x-ui подписок из сохранённой карты, текущих proxy providers и provider metadata;
- UI в Tasks закрепляется на каноничной терминологии **«ссылка подписки / 3x-ui подписка»**.

### v0.6.10 — scheduler/history для SSL-проверок и GEO groundwork
- добавить планировщик и историю SSL-проверок;
- рядом довести GEO/rule-providers/local rules блок в Tasks.

### v0.6.8 — Tasks real SSL polling by subscription URLs
Статус: **сделано**
- кнопки обновления SSL в разделе **«Задачи»** теперь запускают direct probe по сохранённым URL 3x-ui подписок провайдеров через compatibility bridge, если он доступен;
- таблица провайдеров подмешивает результаты probe как приоритетный источник даты сертификата / TLS-ошибки / checked-at;
- stale SSL-состояние сбрасывается при изменении URL подписки, чтобы после редактирования ссылки не оставались фальшивые старые результаты;
- UI Tasks теперь показывает реальное время последней SSL-проверки и отдельную ошибку probe, если backend bridge/service не смог выполнить опрос.

### v0.6.8 — scheduler/history для SSL-проверок и GEO groundwork
Статус: **следующий шаг**
План:
- добавить `next check`, `last successful run`, job/history для provider SSL checks;
- вывести GEO last update и GEO history как соседний operational блок;
- подготовить storage/state контур под scheduler результаты и историю проверок.

### v0.6.10 — QoS и shaping под Ubuntu
План:
- host shaping profiles;
- per-client bandwidth/QoS status;
- диагностика применённых ограничений;
- сценарии apply/remove/reconcile.

- v0.6.12 — стабилизация Tasks SSL refresh: убраны ложные failed/network-error сценарии, если agent list читается и кэш перестраивается асинхронно.

- v0.6.13 — Tasks SSL переведён на прямой probe по сохранённым URL подписок провайдеров; backend/config URL больше не являются источником для этого блока.



### v0.6.17 — ошибочный runtime-эксперимент
Статус: **не считать правильным релизом**
- в проект была навязана модель `frontend + встроенный backend runtime`;
- это не было зафиксировано как штатная архитектура UIUbuntuXkeen;
- релиз откатан и не должен использоваться как опорная точка для следующих шагов.

### v0.6.18 — rollback invalid runtime experiment
Статус: **сделано**
- проект возвращён к честной runtime-модели `v0.6.16`;
- docs обновлены под фактическое состояние проекта;
- добавлен runtime-аудит, фиксирующий реальную архитектурную границу проекта;
- provider SSL checks снова честно считаются целевым отдельным server-side этапом.

### v0.6.16 — cleanup wave 1
Статус: **сделано**
- Home очищен от автоматического router bootstrap;
- Хост приведён к чистому host/runtime экрану;
- Traffic очищен от роутерных compatibility-карточек;
- Tasks / Users / Policies убраны из основного меню и оставлены для legacy-аудита.

### v0.6.20 — build/type-check unblock hotfix
- закрыть ошибки сборки из CI/Actions;
- не менять продуктовую архитектуру ради срочного build-fix;
- сохранить курс на cleanup-first и будущий host-side provider SSL service.

### v0.6.19 — page-by-page legacy teardown
Статус: **следующий шаг**
План:
- разобрать `TasksPage` по блокам и решить для каждого: оставить / скрыть / вынести / удалить;
- отдельно пересобрать `SubscriptionsPage` под канонический server publish path;
- начать зачистку `UsersPage` и `PoliciesPage` как legacy-аудит экранов.


### v0.6.19 — honest provider SSL staging
- UI перестаёт притворяться, что provider SSL checks уже работают через legacy router/compatibility path;
- URL 3x-ui подписок остаются редактируемыми;
- место будущей проверки закреплено за отдельным Ubuntu service на хосте проекта.
