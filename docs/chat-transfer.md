Prepared release: v0.6.60. The live Ubuntu backend contour stays on `ubuntu-service`; this hotfix restores lost 3x-ui host rows into backend storage when `/api/providers` is empty, prevents accidental empty provider wipes, and bridges legacy status polling to `/api/status` so the UI stops treating dead `:9099/cgi-bin/api.sh?cmd=status` as its primary status route.
Актуальный релиз для переноса: **v0.6.60**

## Update v0.6.60
- if the standalone backend provider list is empty, the UI now rebuilds `3x-ui Hosts` from local/users-db fallback rows and seeds them back into backend storage automatically;
- backend provider storage is hardened against accidental empty overwrites and can recover hosts from saved SSL state/history;
- pages that still used `agentStatusAPI()` now bridge to `/api/status` while `ubuntu-service` is active, instead of hammering the dead `:9099/cgi-bin/api.sh?cmd=status` route.

Prepared release: v0.6.58. The live Ubuntu backend contour stays on `ubuntu-service`, and this hotfix fixes the missing provider SSL actions by routing frontend REST calls to the real standalone backend origin instead of relative Mihomo UI `/api/...` paths.
Актуальный релиз для переноса: **v0.6.58**

## Update v0.6.58
- `Хосты 3x-ui` finally send provider SSL actions to the real `ubuntu-service` origin (`http://host:18090/api/...`) instead of falling back to relative Mihomo UI paths.
- The page now forces a fresh backend capability probe on mount and treats the selected `ubuntu-service` backend as provider-capable immediately, so stale `capability-missing` no longer blocks SSL actions.


Что сделано в `v0.6.52`
- backend `ubuntu-service` закреплён как основной рабочий режим; возвращаться на `direct` не нужно
- на экране `Хосты 3x-ui` теперь есть два отдельных server-side действия: `Проверить сейчас` и `Обновить SSL-кэш`
- карточка SSL-провайдеров тоже получила оба действия
- в статусных бейджах `Хосты 3x-ui` теперь видны ближайшая проверка и последний job status
- `backend/scripts/install.sh` теперь явно перезапускает `ultra-ui-ubuntu-backend.service`, если сервис уже был запущен
- документация `docs/*`, `TRANSFER_CHAT` и журнал запросов/шагов обновлены под новый этап

Что важно понимать
- UI по-прежнему раздаётся самим `mihomo`
- backend по-прежнему запускается отдельно как `ultra-ui-ubuntu-backend.service`
- активный режим в `Setup`: **`ubuntu-service`**
- этот релиз не меняет архитектуру запуска, а развивает уже подтверждённый backend-контур

Что делать дальше на сервере
1. Залить релиз в репозиторий.
2. На Ubuntu-хосте выполнить `git fetch origin --prune && git reset --hard origin/main` в `/opt/UIUbuntu/app`.
3. Запустить `backend/scripts/install.sh` — ручной `systemctl restart` после этого уже не нужен.
4. Пересобрать и переложить UI, если менялся frontend.
5. В UI оставить выбранным backend `ubuntu-service`.
6. Проверить экран `Хосты 3x-ui`: обе кнопки должны работать через backend без fallback.

Что следующим шагом после `v0.6.52`
- подтвердить ручной SSL-check и refresh cache на живых 3x-ui хостах;
- подтвердить сохранение `Users inventory` через backend;
- идти в следующий backend-блок: `Host / resources / services / logs`.

[Update v0.6.52]


## Update v0.6.53
- `ubuntu-service` stays the active backend mode.
- Added standalone backend WebSocket routes for `/api/traffic`, `/api/memory`, `/api/connections`, `/api/logs`.
- Goal of this release: restore live overview/traffic telemetry on the Ubuntu backend without falling back to `direct`.


## Update v0.6.54
- `ubuntu-service` remains the active backend mode.
- Added Mihomo bridge routes for `/api/configs`, `/api/proxies`, `/api/providers/proxies`, `/api/providers/rules`, `/api/rules`.
- `/api/connections` now relays the real Mihomo WebSocket when the local controller is available, instead of only sending the lightweight host-local snapshot.
- Backend install/update keeps using `backend/scripts/install.sh`; the env file now also keeps `MIHOMO_ACTIVE_CONFIG=/etc/mihomo/config.yaml` by default.
- Goal of this release: make `Обзор / Топология соединений` on `ubuntu-service` see real hosts and proxy chains rather than only the Ubuntu host itself.


## Update v0.6.55
- stayed on `ubuntu-service` as the main backend contour;
- added provider SSL history endpoint and richer per-host diagnostics in `Хосты 3x-ui`;
- server deploy workflow remains `git fetch origin --prune && git reset --hard origin/main`, then install/build/deploy.

- Current confirmed step: `v0.6.57` fixes provider SSL actions on `ubuntu-service` by starting backend SSL jobs asynchronously and polling their completion from the UI; `Хосты 3x-ui` should no longer block `Обновить SSL-кэш` with a false `capability-missing` state.