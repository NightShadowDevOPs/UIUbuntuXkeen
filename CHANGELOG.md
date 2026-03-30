# Changelog

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