# UIUbuntuXkeen — перенос в новый чат

Актуальный релиз для переноса: **v0.5.4**

Вставь этот файл целиком в новый чат.

---

Мы продолжаем проект **UIUbuntuXkeen**.

## Что это за проект

UIUbuntuXkeen — отдельный Ubuntu-oriented веб-интерфейс для управления **Mihomo** на Ubuntu-хосте/сервере.

Проект вырос из линии **UltraUIXkeen / UI Mihomo / Ultra**, но теперь развивается как **самостоятельный продукт под Ubuntu**, а не как роутерный UI для Netcraze Ultra.

## Репозиторий и рабочий процесс

- Репозиторий: `https://github.com/NightShadowDevOPs/UIUbuntuXkeen`
- Пользователь загружает релизы в репозиторий через **GitHub Desktop**
- После push пользователь проверяет **GitHub Actions**
- Обновление UI на сервере выполняется через кнопку **«Обновить»** в самом UI

## Как работаем по релизам

Ты всегда отвечаешь в таком порядке:
1. даёшь **дистрибутив архивом**;
2. отдельно даёшь **commit message**;
3. соблюдаешь **версионность**;
4. в каждом релизе обновляешь `docs/`;
5. в каждом релизе обязательно обновляешь `TRANSFER_CHAT` и `docs/chat-transfer.md`;
6. в каждом релизе даёшь отдельный архив для переноса проекта в новый чат.

## Обязательные документы в docs

В `docs/` всегда должны быть:
- `project-spec.md` — полное ТЗ;
- `backend-contract.md` — Ubuntu backend contract;
- `functional-audit.md` — глубокий аудит функционального паритета;
- `roadmap.md` — план работ по релизам;
- `releases.md` — журнал выполненных релизов;
- `chat-transfer.md` — актуальный перенос в новый чат.

## Текущий статус

- Текущий релиз линии: **v0.5.4**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Релиз **v0.5.4** — функциональный hotfix по разделу **«Хост»**: секции **Сервисы / Логи** больше не скрыты только за `ubuntu-service`, а runtime/logs получили живой compatibility fallback через существующий bridge/agent контур.

Ключевые факты:
- release flow нового репозитория уже подтверждён на сервере;
- сервер обновляется через постоянную rolling-ссылку `dist.zip`;
- проект уходит от router-oriented архитектуры к Ubuntu-native service model;
- каноничный лог Mihomo на Ubuntu: `/var/log/mihomo/mihomo.log`;
- без нового Ubuntu service не будут полноценно закрыты провайдеры, GEO, ресурсы хоста, QoS, shaping и состояния клиентов;
- audit уже разложил, что можно брать напрямую из Mihomo, а что требует Ubuntu service.

## Главный результат аудита

### Что можно брать напрямую из Mihomo
- прокси;
- proxy groups;
- rules;
- rule providers;
- connections;
- часть overview/runtime данных.

### Что требует нового Ubuntu service
- SSL/TLS проверки провайдеров по расписанию;
- `Обновить` и `Обновить SSL-кеш`;
- last GEO update и GEO history;
- ресурсы хоста;
- каноничный лог Mihomo и системные логи;
- трафик и состояния клиентов на уровне хоста;
- QoS / shaping;
- jobs/status/history;
- запись результата в SQLite/DB.

## Архитектурные правила проекта

### Ubuntu paths
Используем только Ubuntu-ориентированную модель путей:
- `/etc/mihomo/config.yaml`
- `/var/lib/ultra-ui-ubuntu/`
- `/var/lib/ultra-ui-ubuntu/runtime/`
- `/var/lib/ultra-ui-ubuntu/config/`
- `/var/log/ultra-ui-ubuntu/`
- `/var/log/mihomo/mihomo.log`
- `/etc/ultra-ui-ubuntu/agent.env`

### Backend modes
Сейчас допустимы два режима:
- `compatibility-bridge`
- `ubuntu-service`

### Минимальный target API
- `/api/status`
- `/api/health`
- `/api/version`
- `/api/capabilities`
- `/api/system/metrics`
- `/api/system/resources`
- `/api/system/logs`
- `/api/providers`
- `/api/providers/checks`
- `/api/providers/refresh`
- `/api/providers/ssl-cache/refresh`
- `/api/geo/info`
- `/api/geo/update`
- `/api/traffic/clients`
- `/api/qos/status`
- `/api/shape/set`
- `/api/jobs`

### Хранилище состояния
На первом этапе планируем **SQLite**.

Минимальные таблицы:
- `providers`
- `provider_ssl_checks`
- `provider_refresh_jobs`
- `provider_ssl_cache`
- `geo_updates`
- `host_resource_snapshots`
- `client_runtime_snapshots`
- `qos_rules`
- `shape_rules`
- `job_runs`

## Ближайший roadmap

- `v0.5.4` — Трафик и состояния клиентов
- `v0.5.5` — GEO-файлы, локальные правила и top rules
- `v0.5.5` — GEO-файлы, локальные правила и top rules
- `v0.6.0` — QoS / shaping foundation
- `v0.7.0` — Subscriptions / tasks operational parity
- `v0.8.0` — Safe config core
- `v0.9.0` — Structured editors MVP
- `v1.0.0` — Ubuntu MVP complete

## Что важно помнить в следующем чате

- не считать старые agent-driven функции уже перенесёнными только потому, что похожий экран есть в UI;
- сначала проектировать Ubuntu service contract и storage model, потом обещать полноценные provider/GEO/QoS функции;
- все документы в `docs/` обновлять в каждом релизе;
- отдельный transfer-архив давать в каждом релизе;
- писать пользователю по-русски, названия разделов использовать как в проекте: **«Хост»**, **«Провайдеры»**, **«Трафик»**, **«Задачи»**.
