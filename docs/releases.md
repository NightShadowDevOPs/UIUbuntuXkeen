# UIUbuntuXkeen — журнал релизов

## v0.5.6 — трафик: hotfix synthetic IP и degraded telemetry
Дата: **2026-03-30**

Сделано:
- убран пугающий generic `Network Error`, если optional agent endpoint `host_traffic_live` недоступен;
- вместо ошибки экран честно переходит в режим **только Mihomo** и продолжает показывать полезные данные;
- synthetic/system IP без host evidence (например `198.18.x.x`) больше не попадают в таблицу клиентов;
- summary трафика перестало считать synthetic source IP как реальных клиентов.

Результат:
- раздел **«Трафик»** стал менее картонным и менее шумным;
- пользователь видит либо нормальные host-side данные, либо честный degraded режим без ложных ‘клиентов’;
- groundwork под будущий Ubuntu service сохранён, но текущий экран ведёт себя намного взрослее.

Статус:
- функциональный hotfix UI/runtime на основе реальной обратной связи со скрином.

Следующий плановый релиз:
- `v0.5.7` — GEO-файлы, локальные правила и top rules.

## v0.5.5 — трафик: единый рабочий экран клиентов и состояний
Дата: **2026-03-30**

Сделано:
- раздел **«Трафик»** собран в единый operational workspace;
- добавлены `TrafficRuntimeSummaryCard.vue` и `TrafficClientsStateCard.vue`;
- таблица клиентов строится по `sourceIP` на основе живых Mihomo connections и compatibility agent traffic probes;
- на страницу **«Трафик»** выведены live connections, host traffic/QoS и user-traffic;
- compatibility-контур (`NetcrazeTrafficCard`, `HostQosCard`) больше не прячется в побочных экранах, а работает там, где его реально ждут.

Результат:
- экран **«Трафик»** перестал быть только страницей учёта лимитов и стал рабочим местом для проверки клиентов;
- уже сейчас видно, кто активен, через что идёт трафик и какие IP реально участвуют в живых соединениях;
- groundwork под будущий `/api/traffic/clients` сохранён, но страница полезна и без него.

Статус:
- функциональный UI/runtime-релиз; для полного host-native паритета всё ещё нужен Ubuntu service.

Следующий плановый релиз:
- `v0.5.6` — GEO-файлы, локальные правила и top rules.

## v0.5.4 — хост: функциональный hotfix compatibility fallback
Дата: **2026-03-30**

Сделано:
- секции **Сервисы / Логи** больше не скрыты только для `ubuntu-service`;
- `RouterPage.vue` показывает эти секции и в compatibility-режиме;
- `HostRuntimeCard.vue` умеет тянуть реальные метрики через `agentStatusAPI()` + `fetchVersionSilentAPI()`;
- `HostServicesCard.vue` строит compatibility fallback по живым probe-данным вместо пустого блока;
- `HostLogsCard.vue` в legacy-режиме читает `mihomo` и `agent` логи через `agentLogsAPI()`.

Результат:
- экран **«Хост»** перестал быть чисто декоративным в текущем режиме подключения;
- даже без полного `ubuntu-service` теперь можно видеть сервисный срез и логи;
- groundwork под будущие системные endpoint-ы сохранён.

Статус:
- функциональный hotfix UI/runtime; полноценный список systemd units всё ещё требует нового Ubuntu service.

Следующий плановый релиз:
- `v0.5.6` — GEO-файлы, локальные правила и top rules.

## v0.5.3 — хост: ресурсы, сервисы и лог Mihomo
Дата: **2026-03-30**

Сделано:
- раздел **«Хост»** перестроен под `ubuntu-service` backend и больше не притворяется старой router-страницей;
- добавлены host-компоненты для runtime/resources, systemd-сервисов и логов;
- `src/api/ubuntuService.ts` научен нормализовать payload-ы `/api/status`, `/api/system/resources`, `/api/system/services`, `/api/system/logs`;
- `RouterPage.vue` теперь показывает отдельные зоны **Обзор хоста / Сервисы / Логи** для Ubuntu backend-а, а legacy router workflow сохранён;
- в UI отдельно подсвечен каноничный лог Mihomo `/var/log/mihomo/mihomo.log`.

Результат:
- в Ubuntu-линии появился не просто заголовок **«Хост»**, а рабочий UI-контур под реальные backend endpoint-ы;
- стало проще подключать живой Ubuntu service без повторного перелопачивания страницы.

Статус:
- UI foundation готов; для полного эффекта нужны живые backend endpoint-ы и данные с хоста.

Следующий плановый релиз:
- `v0.5.4` — функциональный hotfix compatibility fallback.

## v0.5.2