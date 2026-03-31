## v0.6.20 - 2026-03-31

- исправлен build/type-check hotfix для `Array.prototype.at()` в `src/composables/uiBuild.ts`;
- исправлены TypeScript-претензии к `UserTrafficStats.vue`: безопасный доступ к `shaperBadge` в шаблоне и нормализация `trafficLimitBytes` при открытии лимитов;
- исправлен `ProxyProvider.vue`: `sslExpireBadge` больше не падает на `info.days === null`;
- расширен тип `UbuntuSystemStatus`: добавлен `uptimeSec` для `HostRuntimeCard.vue`;
- `tsconfig.app.json` поднят до `ES2022`, чтобы сборка не спотыкалась о современные стандартные API.

## v0.6.19 - 2026-03-31

- честно отключён legacy provider SSL fallback через router-agent / compatibility path;
- раздел «Задачи» теперь показывает, что URL 3x-ui подписок можно сохранять уже сейчас, а реальная проверка сертификатов появится после подключения Ubuntu service на этом хосте;
- auto-bootstrap legacy agent выключен по умолчанию, чтобы Ubuntu-линия не подмешивала роутерный контур в новый профиль браузера;
- добавлен `docs/provider-ssl-service-plan-v0.6.19.md`.

## v0.6.18 - 2026-03-31

- откатена ошибочная runtime-ветка `v0.6.17`: проект возвращён к честной модели **статический frontend UI + выбранный backend через Setup**;
- удалён навязанный в `v0.6.17` новый встроенный backend/runtime-контур из релизной линии;
- docs обновлены под фактическое состояние проекта: `v0.6.17` прямо помечен как неверный архитектурный релиз;
- добавлен `docs/runtime-model-audit-v0.6.18.md` с разбором реальной runtime-модели и причин отката.

## v0.6.13 - 2026-03-31

- SSL-опрос в разделе **«Задачи»** снова переведён на **прямую проверку введённых вручную URL 3x-ui подписок провайдеров**, а не на данные из конфига/provider metadata;
- кнопки **«Обновить SSL провайдеров»** и **«Обновить SSL-кеш»** теперь используют `ssl_probe_batch` по адресам из списка провайдеров/Users DB и заполняют таблицу напрямую;
- в Tasks источник URL для SSL-таблицы снова жёстко привязан к сохранённым адресам провайдеров, поэтому неправильные URL из backend-конфига больше не подмешиваются в результат.

## v0.6.12 - 2026-03-30

- исправлен fallback SSL-кеша в разделе **«Задачи»**: если dedicated refresh endpoint недоступен или падает с `Network Error`, UI переключается на штатное чтение `mihomo_providers`;
- compatibility fallback добавлен и для списка провайдеров: при сбое Ubuntu-service checks UI пытается читать agent cache, а не оставляет Tasks в подвешенном состоянии;
- в таблице SSL-статусов теперь учитываются `panelSslError` и `panelSslCheckedAtSec`, а глобальная ошибка refresh показывается честно вместо вечного `SSL обновляется…`.

# Changelog

## v0.6.10 - 2026-03-30
- в разделе **«Задачи»** убран долгий direct `ssl_probe_batch`, из-за которого UI мог висеть 30–60 секунд и отлипать без результата/с `failed`;
- кнопки **«Обновить SSL провайдеров»** и **«Обновить SSL-кеш»** теперь опираются на штатный agent flow: `ssl_cache_refresh` + повторное чтение `mihomo_providers`;
- таблица провайдеров в Tasks теперь читает **`panelSslNotAfter`** из ответа agent provider cache, то есть использует именно результат кэшированной проверки URL 3x-ui подписок;
- оставлен best-effort fallback по локальному списку провайдеров, но без блокирующего SSL batch-probe из браузера.

## v0.6.8 - 2026-03-30
- в разделе **«Задачи»** наконец подключён реальный SSL/TLS-опрос по сохранённым URL 3x-ui подписок провайдеров: `refreshProvidersSsl` и `refreshProviderSslCache` теперь не только дёргают backend refresh, но и запускают прямой probe по subscription URL через compatibility bridge, если он доступен;
- таблица провайдеров в Tasks теперь подмешивает результаты `probePanelSsl()` как приоритетный источник `sslNotAfter` / `sslError` / `checkedAt`, поэтому список начинает показывать реальные даты сертификатов и ошибки по самим ссылкам подписок, а не только backend хвосты;
- stale SSL-данные теперь корректно сбрасываются при изменении URL подписки, а direct probe фильтрует только TLS-capable `https://` / `wss://` ссылки;
- в UI Tasks добавлена явная индикация последней SSL-проверки и отдельное сообщение об ошибке probe, чтобы было видно, когда опрос реально отработал, а когда backend/bridge недоступен.

## v0.6.6 - 2026-03-30
- раздел **«Задачи»** приведён ближе к каноничному operational-виду со скринов: блок провайдеров теперь показывает сводные счётчики по URL/ошибкам/истечениям и не прячет локально сохранённый список, даже если backend-проверки сейчас недоступны;
- список провайдеров в Tasks теперь сохраняет практический порядок источников: сначала реальные proxy providers из UI, затем сохранённые subscription URL/иконки/SSL override-настройки и только потом backend extras;
- в таблице провайдеров добавлена явная нижняя строка с временем последней проверки или ошибкой TLS/SSL по URL 3x-ui подписки, чтобы раздел **«Задачи»** был ближе к старой operational-форме;
- docs уточнены под каноничную модель: **Providers задают URL 3x-ui подписок, Tasks выполняет SSL/TLS-опрос и показывает operational-результат**.

## v0.6.5 - 2026-03-30
- раздел **«Задачи»** перестал терять список провайдеров, если backend health/checks временно недоступен: теперь таблица собирается из текущих provider sources, сохранённых URL подписок, иконок и SSL override-настроек;
- `TasksPage` теперь подтягивает список proxy providers напрямую через `fetchProxyProvidersOnly()`, а не ждёт только provider-health ответ;
- в сборке списка провайдеров учтены дополнительные ключи источника (`subscriptionUrl`, `downloadUrl`, `panelUrl` и их snake_case-варианты) для совместимости со старой и новой моделью данных;
- в docs добавлено явное описание структуры раздела **«Задачи»**: какие блоки, кнопки и действия являются каноничными для проекта.

## v0.6.4 - 2026-03-30
- раздел **«Задачи»** приведён к рабочей модели со скринов: блок провайдеров открыт по умолчанию и использует редактируемые URL 3x-ui подписок прямо в таблице;
- SSL/TLS в Tasks теперь приоритетно опирается на сохранённые вручную ссылки подписок провайдеров, а не на случайные хвосты из provider metadata;
- карточка провайдера и Tasks используют одну и ту же общую карту subscription URL, синхронизируемую через users DB;
- UI-термины переведены с «панелей управления» на **3x-ui подписки / ссылки подписки** там, где речь идёт именно об источнике SSL-проверки.

## v0.6.2 - 2026-03-30
- раздел **«Задачи»** переведён с panel URL логики на **provider/subscription source URL** для SSL/TLS проверки провайдеров;
- таблица в Tasks теперь показывает реальную ссылку источника подписки провайдера и состояние сертификата именно этой ссылки;
- кнопка **«Обновить SSL провайдеров»** больше не дёргает ошибочный panel probe flow, а запускает существующий provider SSL cache/provider-health refresh;
- список **«Прокси-провайдеры»** снова не участвует в SSL-операционке, а Tasks остаётся каноничным местом для этой диагностики;
- обновлены README, roadmap, release journal, transfer docs, audit, spec и backend contract под правильный контур `v0.6.2`.

## v0.6.1 - 2026-03-30
- убран ошибочно добавленный `ProxyProviderSslChecksWorkspace.vue` из раздела **«Прокси-провайдеры»**;
- список прокси-провайдеров возвращён к нормальному виду без постороннего SSL-блока поверх карточек;
- SSL-проверки и действия **«Проверить сейчас»** / **«Обновить SSL-кеш»** зафиксированы как контур раздела **«Задачи»**, а не раздела **«Прокси-провайдеры»**;
- обновлены README, roadmap, release journal, backend-contract, transfer docs и спецификация: убраны неверные формулировки про «готовый SSL MVP» в списке провайдеров.

## v0.6.0 - 2026-03-30
- добавлен `ProxyProviderSslChecksWorkspace.vue` — единая operational-панель SSL/TLS по прокси-провайдерам прямо в разделе **Прокси-провайдеры**;
- в workspace выведены реальные действия **«Проверить сейчас»** и **«Обновить SSL-кеш»** поверх уже существующего compatibility bridge / Ubuntu service capability слоя;
- сводка и таблица теперь показывают по каждому провайдеру: состояние сертификата, срок действия, источник проверки, время последней проверки, URL и TLS/SSL ошибку;
- workspace умеет честно показывать провайдеров без HTTPS/WSS URL как отдельный класс, а не маскировать их под «сломанные» сертификаты;
- обновлены roadmap, release journal, spec, backend-contract и transfer docs под переход к `v0.6.0` как Provider SSL checks MVP.

## v0.5.6 - 2026-03-30
- `TrafficClientsStateCard.vue` больше не показывает пугающий `Network Error`, если optional agent endpoint `host_traffic_live` недоступен; вместо этого UI спокойно остаётся в режиме **только Mihomo**;
- из таблицы состояний клиентов отфильтрованы синтетические/system IP без host evidence (например `198.18.x.x`), чтобы в трафике не появлялись фальшивые ‘клиенты’;
- `TrafficRuntimeSummaryCard.vue` теперь считает уникальные источники и активных клиентов без системных synthetic IP;
- добавлен текстовый fallback `trafficHostTelemetryUnavailable` для честного режима degraded telemetry;
- обновлены roadmap, release journal, transfer docs и спецификация под hotfix v0.5.6.

## v0.5.5 - 2026-03-30
- раздел **«Трафик»** перестроен в единый operational workspace вместо разрозненных экранов;
- добавлены `TrafficRuntimeSummaryCard.vue` и `TrafficClientsStateCard.vue` для живой сводки и таблицы клиентов по IP;
- состояния клиентов теперь собираются из живых Mihomo connections и compatibility agent traffic probes (`host_traffic_live`, `lan_hosts`);
- на странице **«Трафик»** собраны live clients, live connections, host traffic и user-traffic;
- compatibility-режим показывает `NetcrazeTrafficCard` и `HostQosCard` прямо в разделе **«Трафик»**, а не прячет их в других местах интерфейса;
- обновлены README, roadmap, release journal и transfer docs под новый трафиковый workspace.

## v0.5.4 - 2026-03-30
- исправлен архитектурный промах v0.5.3: секции **«Сервисы»** и **«Логи»** больше не прячутся только за `ubuntu-service`;
- `RouterPage.vue` теперь показывает **Сервисы / Логи** и в compatibility bridge-режиме;
- `HostRuntimeCard.vue` получил fallback на `agentStatusAPI()` + `fetchVersionSilentAPI()` для реальных CPU/RAM/storage/uptime метрик там, где Ubuntu service ещё не поднят;
- `HostServicesCard.vue` теперь собирает рабочий compatibility fallback вместо пустой заглушки;
- `HostLogsCard.vue` в legacy-режиме читает логи через `agentLogsAPI()` (`mihomo` / `agent`), а не ждёт несуществующий `/api/system/logs`;
- обновлены README, roadmap, release journal и transfer docs под функциональный hotfix.

## v0.5.3 - 2026-03-30
- раздел **«Хост»** переведён на отдельные Ubuntu service-зоны: обзор, сервисы и логи;
- `src/api/ubuntuService.ts` расширен нормализацией `/api/status`, `/api/system/resources`, `/api/system/services`, `/api/system/logs`;
- добавлены `src/components/host/HostRuntimeCard.vue`, `HostServicesCard.vue`, `HostLogsCard.vue`;
- `RouterPage.vue` теперь честно перестраивается под `ubuntu-service`, а legacy router flow не ломается;
- обновлены README, roadmap, release journal и transfer docs под следующий шаг `v0.5.3`.

## v0.5.2 - 2026-03-30
- добавлен capability-aware foundation-слой для provider runtime в режиме `ubuntu-service`;
- расширены `BackendCapabilities` и Ubuntu backend endpoints под провайдеры, GEO, traffic, QoS, shaping и jobs;
- добавлены `src/helper/backendCapabilities.ts`, `src/store/backendCapabilities.ts`, `src/api/ubuntuService.ts`;
- `src/store/providerHealth.ts` теперь умеет работать не только через legacy agent bridge, но и через Ubuntu service provider endpoints;
- `TasksPage` больше не блокирует provider SSL/runtime-действия только по флагу старого agent, а честно смотрит на capability активного backend-а;
- обновлены README, roadmap, release journal и transfer docs под следующий шаг `v0.5.3`.

## v0.5.1 - 2026-03-30
- выполнен глубокий аудит функционального паритета UltraUIXkeen → UIUbuntuXkeen;
- добавлен `docs/functional-audit.md`;
- обновлены `docs/project-spec.md`, `docs/backend-contract.md`, `docs/roadmap.md`, `docs/releases.md`, `docs/chat-transfer.md`, `README.md`, `TRANSFER_CHAT`;
- roadmap перестроен под реальные operational-приоритеты: провайдеры, хост, трафик, GEO, QoS и shaping.

## v0.5.0