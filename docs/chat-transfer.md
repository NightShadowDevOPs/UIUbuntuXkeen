Prepared release: v0.6.52. The live Ubuntu backend contour is now stable enough to stay on `ubuntu-service`, and this step adds real SSL actions in the UI plus an install/update fix that restarts the backend automatically.

Актуальный релиз для переноса: **v0.6.52**

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
2. На Ubuntu-хосте выполнить `git pull --ff-only` в `/opt/UIUbuntu/app`.
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
