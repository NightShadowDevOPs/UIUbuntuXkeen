# UIUbuntuXkeen — полное ТЗ проекта

Актуальная версия документа: **v0.5.2**  
Дата актуализации: **2026-03-30**

## 0. Статус документа

Документ соответствует релизу **v0.5.2**. На этом этапе проект уже имеет рабочий release-flow и подтверждённый server update path на релизе **v0.2.10**, а в UI появился capability-aware foundation-слой для provider runtime в режиме `ubuntu-service`. При этом полноценный operational-перенос всё ещё требует нового **Ubuntu service** с живыми endpoint-ами и scheduler/storage контуром.

Текущее состояние проекта нужно понимать так:
- UI и release-flow уже живые;
- часть operational UX уже видна в интерфейсе;
- прямой Mihomo API покрывает только часть задач;
- для провайдеров, GEO, ресурсов хоста, QoS, shaping, фоновых проверок и записи результатов нужен новый backend/service слой.

## 1. Назначение проекта

**UIUbuntuXkeen** — отдельный Ubuntu-oriented веб-интерфейс для управления **Mihomo** на Ubuntu-хосте или Ubuntu-сервере.

Проект создаётся на основе линии **UltraUIXkeen / UI Mihomo / Ultra**, но не должен оставаться роутерным форком с косметическим ребрендингом. Цель — превратить лучший опыт текущего UI в самостоятельный operational-интерфейс под Ubuntu.

Проект должен:
- сохранить сильные стороны текущего UI Mihomo;
- отказаться от жёсткой привязки к Netcraze Ultra / Entware / BusyBox / CGI;
- перейти на Ubuntu-native модель путей, сервисов и системной интеграции;
- безопасно и предсказуемо работать с конфигурацией и operational state Mihomo;
- быть удобным для постоянной desktop/web эксплуатации.

## 2. Базовые источники требований

Исходная база:
- проект-источник: **UltraUIXkeen**;
- технологическая база: **Vue 3 + TypeScript**;
- функциональный ориентир: UI для Mihomo с расширениями через `router-agent`;
- стартовая кодовая основа Ubuntu-линии: **UltraUIXkeen 1.2.106**;
- текущая Ubuntu-линия: **UIUbuntuXkeen**;
- подтверждённо рабочий release/update flow: **v0.2.10**.

Для Ubuntu-линии источником требований считаются:
- текущий UI и его рабочие модули;
- пакет переноса проекта под Ubuntu;
- исходный `router-agent` и его команды;
- глубокий аудит функционального паритета `docs/functional-audit.md`;
- зафиксированный roadmap переноса.

## 3. Продуктовая цель

Проект должен стать **операционным центром управления Mihomo на Ubuntu**, а не только визуальной оболочкой к части API.

Целевой продукт должен покрывать:
1. Подключение к Mihomo на Ubuntu.
2. Раздел **«Хост»** со статусом сервера и Mihomo.
3. Раздел **«Провайдеры»** с диагностикой SSL/TLS, плановыми проверками и историей.
4. Раздел **«Трафик»** с графиками, usage и состоянием клиентов.
5. Разделы соединений, правил, подписок и задач.
6. QoS / shaping / policy runtime.
7. GEO-файлы, локальные правила, топ правил и связанные operational summary.
8. Safe config flow и structured editors — как отдельный контур, но не ближайший приоритет.

## 3.1. Текущий приоритет

На текущем этапе пользователь зафиксировал такой приоритет развития:
- диагностика провайдеров и их SSL/TLS-сертификатов;
- информация о трафике и состояниях клиентов;
- состояние сервера и раздел **«Хост»**;
- шейпинг / QoS / policy runtime;
- GEO-файлы, локальные правила и топ правил;
- safe config flow и structured editors отложены на потом.

## 4. Платформа Ubuntu и каноничные пути

Новый проект работает под **Ubuntu Server / Ubuntu Desktop**.

### Каноничные пути

- активный конфиг Mihomo: `/etc/mihomo/config.yaml`
- состояние приложения: `/var/lib/ultra-ui-ubuntu/`
- safe-config state: `/var/lib/ultra-ui-ubuntu/config/`
- runtime/cache/jobs/db: `/var/lib/ultra-ui-ubuntu/runtime/`
- логи приложения: `/var/log/ultra-ui-ubuntu/`
- каноничный лог Mihomo: `/var/log/mihomo/mihomo.log`
- конфиг backend-service: `/etc/ultra-ui-ubuntu/agent.env`
- systemd unit-файлы и timers — штатный способ запуска и фоновых задач

### Платформенные ожидания

- сервисный менеджер: `systemd`
- системные утилиты: `ip`, `ss`, `tc`, `nft`, `iptables` (fallback), `curl`, `openssl`
- журналы: `journalctl` и/или файловые логи
- фоновые задачи: предпочтительно встроенный scheduler service + `systemd`, cron только как fallback

**Важно:** старые пути Xkeen/Entware не считаются основной архитектурой и не должны использоваться как канон для новой Ubuntu-линии.

## 5. Архитектура решения

### Frontend
- Vue 3
- TypeScript
- существующая UI-база UltraUIXkeen как стартовая основа
- развитие в сторону более чистого Ubuntu-friendly operational UI

### Backend / service layer
- отдельный **Ubuntu service** под Ubuntu
- предпочтительный стек: **FastAPI**
- shell/cgi допускаются только как временный переходный мост, но не как основа продукта
- UI должен различать:
  - `compatibility-bridge` — переходный режим
  - `ubuntu-service` — целевой режим

### Storage / state
На этапе MVP допускается **SQLite** как основное operational-хранилище для runtime state, jobs, SSL-check history, GEO updates, host snapshots и QoS/shaping state. Позже возможно вынесение части данных в PostgreSQL, если это даст практическую пользу.

### Transport
- REST API
- SSE/WebSocket для live metrics, jobs, long-running operations

### Auth
- bearer token
- опциональный trusted LAN mode для локальной среды

## 6. Функциональные модули

### 6.1. Обзор
Сводный operational dashboard:
- состояние Mihomo;
- состояние Ubuntu service;
- CPU / RAM / uptime / load;
- краткая сводка по трафику, соединениям, провайдерам и заданиям.

### 6.2. Хост
Ubuntu-версия прежнего Router runtime:
- ресурсы хоста;
- состояние сервисов;
- состояние Mihomo;
- путь к каноничному логу `/var/log/mihomo/mihomo.log`;
- диагностика backend/service.

### 6.3. Провайдеры
Раздел должен показывать не только список proxy-providers, но и operational diagnostics:
- panel URL / provider URL;
- статус SSL/TLS;
- срок действия сертификата;
- issuer / subject / SAN;
- ошибка проверки;
- последняя проверка;
- следующая проверка;
- состояние фоновой задачи;
- ручные действия `Обновить`, `Обновить SSL-кеш`, `Проверить сейчас`.

### 6.4. Трафик
- общий usage;
- графики;
- хосты/клиенты;
- состояние трафика по каждому клиенту;
- через Mihomo / мимо Mihomo / routed client;
- QoS/shaping markers.

### 6.5. Соединения
- живые соединения;
- фильтрация;
- детализация по правилу / прокси / источнику.

### 6.6. Правила
- список правил;
- локальные правила;
- top rules;
- визуальные summary по клиентам/правилам/провайдерам.

### 6.7. Задачи
- GEO update;
- provider refresh / SSL refresh;
- backup/restore jobs;
- системные long-running operations.

### 6.8. QoS / shaping
- профили;
- текущие применения;
- приоритеты;
- ограничения;
- состояние правил;
- история применений.

### 6.9. Safe config flow
Контур сохраняется в продукте, но сейчас не является ближайшим шагом:
- active / draft / baseline / history;
- validate / apply / rollback;
- structured editors.

## 7. Глубокий вывод аудита

Результат функционального аудита такой:
- **напрямую из Mihomo** можно и нужно читать прокси, группы, правила, соединения и часть runtime-данных;
- значимая operational-часть старой линии была завязана на `router-agent`;
- без нового Ubuntu service нельзя полноценно вернуть:
  - проверку провайдеров по расписанию;
  - SSL-кеш и историю SSL-проверок;
  - дату и время последнего обновления GEO-файлов;
  - ресурсы хоста;
  - QoS / shaping;
  - состояние клиентов на уровне хоста;
  - запись результата в БД;
  - ручные действия `Обновить`, `Обновить SSL-кеш` и их автоматизацию.

То есть проекту нужна **hybrid-модель**:
- direct Mihomo API для всего, что Mihomo уже умеет отдавать сам;
- Ubuntu service для системных, scheduled и stateful задач.

## 8. Технические требования к Ubuntu service

Ubuntu service должен обеспечивать:
- `/api/status`, `/api/health`, `/api/version`, `/api/capabilities`;
- `/api/system/metrics`, `/api/system/resources`, `/api/system/logs`, `/api/system/services`;
- `/api/providers`, `/api/providers/checks`, `/api/providers/refresh`, `/api/providers/ssl-cache/refresh`;
- `/api/geo/info`, `/api/geo/update`, `/api/geo/history`;
- `/api/traffic/clients`, `/api/traffic/overview`, `/api/traffic/topology`;
- `/api/qos/status`, `/api/qos/set`, `/api/qos/remove`;
- `/api/shape/set`, `/api/shape/remove`;
- `/api/jobs`, `/api/jobs/<built-in function id>`;
- в будущем — `/api/mihomo/config/*` для safe config flow.

## 9. Требования к данным и хранению результатов

Минимальные сущности для SQLite/DB:
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

Для каждого результата проверки или фоновой операции должны храниться минимум:
- время старта;
- время завершения;
- статус;
- ошибка, если была;
- связанный объект;
- полезная нагрузка результата.

## 10. Нефункциональные требования

- надёжность: UI не должен делать вид, что данных больше, чем реально доступно;
- наблюдаемость: все scheduled checks и service actions должны иметь статус и историю;
- безопасность: bearer token, audit trail, ограничение destructive operations;
- производительность: большие таблицы и графики должны оставаться отзывчивыми;
- переносимость: Ubuntu 22.04+ как базовая платформа;
- локализация: RU обязательно, EN желательно;
- обновляемость: release/update flow через GitHub + кнопку **«Обновить»** должен оставаться стабильным.

## 11. Критерии приёмки ближайшего функционального этапа

Ближайший функциональный этап считается закрытым, когда:
1. есть формализованный audit-map старого функционала;
2. раздел **«Провайдеры»** переведён на модель фоновых проверок и истории;
3. раздел **«Хост»** показывает ресурсы сервера и Mihomo;
4. раздел **«Трафик»** возвращает графики и состояния клиентов;
5. GEO / local rules / top rules возвращены как осмысленные operational-блоки;
6. QoS / shaping имеют foundation contract под Ubuntu service.

## 12. Краткий вывод

UIUbuntuXkeen уже жив как проект и как release-flow, но для достижения реального функционального паритета с сильными сторонами старой линии ему нужен не только UI, а новый **Ubuntu service** со scheduler-логикой, БД и системной интеграцией. Именно это и должно стать центром ближайших релизов.
