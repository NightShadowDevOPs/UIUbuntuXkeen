# Changelog

## v0.6.3 - 2026-03-30
- добавлен `.npmrc` с `frozen-lockfile=false` и `prefer-frozen-lockfile=false`, чтобы GitHub Actions не падал на `pnpm install` при рассинхроне lockfile;
- версия `prettier-plugin-tailwindcss` возвращена к `^0.6.14`, чтобы не расходиться с текущим `pnpm-lock.yaml`;
- документация и transfer-файлы переведены в режим стабилизации: следующий шаг — не новая «рисовалка», а возврат к функционалу после зелёного install/build;
- релиз не добавляет новую SSL-фичу и не трогает список прокси-провайдеров: это именно build/install stabilization.

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