# Build hotfix audit — v0.6.20

Дата: 2026-03-31

## Что сломалось

CI/Actions падал на type-check/build по следующим местам:

- `src/composables/uiBuild.ts` — `Array.prototype.at()` без подходящего target/lib;
- `src/components/users/UserTrafficStats.vue` — nullable доступы к `shaperBadge[...]` в шаблоне и возможный `undefined` у `trafficLimitBytes`;
- `src/components/proxies/ProxyProvider.vue` — `info.days` мог быть `null`;
- `src/components/host/HostRuntimeCard.vue` — использовался `status.uptimeSec`, которого не было в типе `UbuntuSystemStatus`.

## Что исправлено

- `tsconfig.app.json` переведён на `ES2022`;
- в `uiBuild.ts` убран `.at(-1)` и заменён на совместимый доступ по индексу;
- в `UserTrafficStats.vue` шаблон переведён на безопасный доступ через optional chaining, а `trafficLimitBytes` нормализуется в число до расчётов;
- в `ProxyProvider.vue` badge считает `days` через локальную нормализацию `number | NaN`;
- тип `UbuntuSystemStatus` расширен полем `uptimeSec`, и нормализатор тоже его заполняет.

## Что важно

Этот релиз **не меняет продуктовую архитектуру** и **не возвращает fake SSL runtime**. Он только снимает текущие build/type-check blockers после `v0.6.19`.
