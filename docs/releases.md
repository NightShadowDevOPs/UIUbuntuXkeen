# UIUbuntuXkeen — журнал релизов

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
- `v0.5.5` — Трафик и состояния клиентов.

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