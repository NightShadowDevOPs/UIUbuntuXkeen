# UIUbuntuXkeen — Ubuntu backend contract

Актуально на: **2026-03-30**  
Текущая версия линии: **v0.3.2**

## Назначение

Этот документ фиксирует технический каркас нового Ubuntu backend contract для UIUbuntuXkeen.

Цель: постепенно уйти от router-oriented compatibility bridge к **Ubuntu-native service API**, не ломая текущий рабочий UI и встроенное обновление.

## Текущая модель backend-ов

На линии `v0.3.2` считаем допустимыми два режима backend-а:

### 1. Compatibility bridge
Используется как переходный режим.

Подходит для текущей UI-базы, где ещё живы части логики, пришедшие из router-agent / router-host сценариев.

Характеристики:
- допускает старую модель secondary path;
- может опираться на bridge-логику для QoS, users DB и service-side helper calls;
- не считается финальной архитектурой Ubuntu-линии.

### 2. Ubuntu service
Целевой режим нового продукта.

Характеристики:
- отдельный service/API под Ubuntu;
- каноничные Ubuntu paths;
- capability-driven contract между UI и backend-service;
- безопасный config flow для Mihomo.

## Каноничные Ubuntu paths

Используем только Ubuntu-oriented модель путей:

- active config: `/etc/mihomo/config.yaml`
- app state root: `/var/lib/ultra-ui-ubuntu/`
- config draft/history/baseline: `/var/lib/ultra-ui-ubuntu/config/`
- app logs: `/var/log/ultra-ui-ubuntu/`
- agent/service env: `/etc/ultra-ui-ubuntu/agent.env`

Xkeen / Entware / BusyBox пути не считаются каноничными для новой линии.

## Foundation endpoint groups

Минимальный Ubuntu backend contract должен ориентироваться на следующие endpoint-группы:

### Status / platform
- `/api/status`
- `/api/health`
- `/api/version`
- `/api/capabilities`

### System observability
- `/api/system/metrics`
- `/api/system/connections`
- `/api/system/logs`

### Mihomo config flow
- `/api/mihomo/config/active`
- `/api/mihomo/config/draft`
- `/api/mihomo/config/history`
- `/api/mihomo/config/validate`
- `/api/mihomo/config/apply`
- `/api/mihomo/config/rollback`

## Capability keys

UI должен уметь ориентироваться не только на URL, но и на набор capabilities backend-а.

Базовый capability set:
- `status`
- `health`
- `version`
- `capabilities`
- `metrics`
- `connections`
- `logs`
- `configActive`
- `configDraft`
- `configHistory`
- `configValidate`
- `configApply`
- `configRollback`

## Что сделано в v0.3.0–v0.3.2

На этом релизе в кодовой базе заложен foundation-слой:
- central project/release constants вынесены в отдельный config-модуль;
- rolling release URL и GitHub release API переведены на единый источник;
- добавлены типы `BackendKind` и `BackendCapabilities`;
- добавлена нормализация backend secondary path;
- добавлена базовая детекция backend kind: `compatibility-bridge` / `ubuntu-service`;
- add/update backend в setup-store теперь проходят через normalization layer;
- setup/edit backend получили явный выбор backend mode (`compatibility-bridge` / `ubuntu-service`);
- для backend mode добавлен рекомендуемый secondary path: пустой для direct/bridge и `/api` для Ubuntu service;
- setup list теперь визуально показывает режим backend-а badge-ом;
- в Setup и Edit Backend добавлен backend contract preview: connection preview, probe/runtime endpoint-ы и каноничные Ubuntu paths для режима `ubuntu-service`;
- runtime workspace начинает переключать видимый смысл между router-oriented и host-oriented режимом по выбранному backend kind.

## Что ещё не считается завершённым

На `v0.3.2` это **ещё не полноценный Ubuntu backend-service**.

Пока не считаются закрытыми:
- реальные `/api/status|health|capabilities` для Ubuntu service;
- service-side metrics/logs implementation;
- safe config API вместо legacy-переходников;
- окончательный отказ от router-oriented terminology внутри всей UI.

## Следующий шаг

Следующий крупный этап: **v0.4.0 — Runtime / Setup / Observability data foundation**.

На нём нужно:
- углубить переход от раздела “Роутер” к Host Runtime;
- подготовить setup flow под Ubuntu service;
- начать реальную capability-driven observability model;
- подготовить hybrid data model: direct Mihomo для runtime-данных и Ubuntu service для системных/config-операций.
