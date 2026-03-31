# Build hotfix audit — v0.6.22

Этот hotfix закрывает следующий хвост CI/TypeScript после `v0.6.21`.

## Что исправлено

- `src/views/TasksPage.vue`
  - добавлены явные типы в `filter/sort` callback-ах для geo items, чтобы строгий TS не ругался на implicit `any`.
- `src/composables/userLimits.ts`
  - `UserLimitResolved` теперь явно требует `trafficLimitBytes` и `bandwidthLimitBps`, потому что после нормализации лимита эти поля уже не должны считаться `undefined`.

## Что это не меняет

- архитектура проекта не менялась;
- provider SSL checks по-прежнему не считаются реализованными фронтендом;
- это именно build/type-check hotfix.
