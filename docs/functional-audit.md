# UIUbuntuXkeen — аудит функционального паритета

Актуальная версия документа: **v0.6.3**  
Дата актуализации: **2026-03-30**

## 1. Что анализировалось

Аудит выполнен по трём источникам:
1. исходная линия **UltraUIXkeen 1.2.106**;
2. её `router-agent` и связанные UI-команды;
3. текущая Ubuntu-линия **UIUbuntuXkeen v0.5.0–v0.6.3**.

Цель аудита — понять не “что красиво выглядит в интерфейсе”, а **какой функционал реально был рабочим**, откуда он брал данные и что нужно вернуть в Ubuntu-линии без самообмана.

## 2. Итог одним абзацем

Самый важный вывод: заметная часть сильного operational UX старой линии держалась **не на одном Mihomo API**, а на `router-agent`.

Поэтому для Ubuntu-линии:
- **часть функций можно брать напрямую из Mihomo**;
- **часть функций не оживёт без нового Ubuntu service**;
- текущий UI уже имеет базу и куски старых экранов, но без service не должен считаться полноценно перенесённым.

## 3. Легенда статусов

- **Готово** — функция реально присутствует и её источник данных понятен.
- **Частично** — есть UI/модель/фрагменты, но нет полного рабочего контура.
- **Отсутствует** — функция в новой линии пока не возвращена как работающий блок.
- **Требует Ubuntu service** — без нового backend/service слоя перенос нельзя считать завершённым.

## 4. Матрица функционального паритета

| Блок | Что было в Xkeen | Источник данных в Xkeen | Текущее состояние в UIUbuntuXkeen | Что нужно для Ubuntu-линии |
|---|---|---|---|---|
| Провайдеры: список и карточки | Список proxy-providers, здоровье, URL, статусы | Mihomo API + agent | **Частично** | Сохранить прямой Mihomo API, а operational-часть перевести в Ubuntu service |
| Провайдеры: SSL/TLS сертификаты | Срок действия, проверка, ошибки, SSL cache | `router-agent` | **Частично / Tasks уже переведён на source URL** | SSL-контур закреплён за разделом **«Задачи»** и уже ориентирован на provider/subscription source URL; дальше нужны scheduler/history и storage в Ubuntu service |
| Провайдеры: `Обновить` | Ручное обновление провайдеров | `router-agent` | **Отсутствует как полноценный Ubuntu-контур** | Endpoint и job в Ubuntu service |
| Провайдеры: `Обновить SSL-кеш` | Принудительное обновление SSL cache | `router-agent` | **Отсутствует как полноценный Ubuntu-контур** | Endpoint и job в Ubuntu service |
| Автопроверка провайдеров | Проверка по расписанию | `router-agent` + cron/cache files | **Отсутствует** | Встроенный scheduler + DB |
| GEO-файлы | Последнее обновление, список файлов, статусы | `router-agent` | **Частично / фактически потеряно** | `/api/geo/*`, история и jobs |
| Локальные правила | Информация о локальных rule-файлах | `router-agent` | **Частично / не восстановлено как продуктовый блок** | Сканирование rules folder через Ubuntu service |
| Top rules / rule summaries | Топ правил, агрегации | Mihomo + UI analytics + agent adjunct data | **Частично** | Восстановить в Overview/Traffic/Rules |
| Ресурсы хоста | CPU, RAM, load, uptime, storage, network | `router-agent` | **Частично** | `/api/system/resources`, `/api/system/metrics` |
| Статус Mihomo | Статус и часть runtime | Mihomo + agent | **Частично** | Прямой Mihomo + host service overlay |
| Каноничный лог Mihomo | Файл/хвост логов | agent / local FS | **Частично** | `/var/log/mihomo/mihomo.log` + `/api/system/logs` |
| Графики трафика | Карточки, графики, связи | Mihomo + agent runtime | **Частично** | Вернуть data pipeline для Traffic/Overview |
| Состояния клиентов | Трафик, соединения, routed/vpn/bypass, hostname | `router-agent` | **Частично / требует Ubuntu service** | `/api/traffic/clients`, snapshots, topology |
| QoS | Профили, статус, применение правил | `router-agent` | **Частично / требует Ubuntu service** | `/api/qos/*`, runtime state и DB |
| Shaping | Shape/unshape для клиентов | `router-agent` | **Частично / требует Ubuntu service** | `/api/shape/*`, jobs, audit trail |
| Соединения | Live connections | Mihomo API | **Готово как база** | Оставить direct Mihomo API |
| Прокси / группы / правила / rule-providers | Основной Mihomo UI | Mihomo API | **Готово как база** | Оставить direct Mihomo API |
| Подписки | Subscription UX и связанный сервисный контур | Mihomo + agent | **Частично** | Отдельно адаптировать под Ubuntu service |
| Safe config flow | Draft/validate/apply/history | `router-agent` | **Отложено** | Вернуть позже как отдельный большой блок |

## 5. Что можно брать напрямую из Mihomo уже сейчас

Это ядро, которое нет смысла насильно тянуть в новый service:
- прокси;
- proxy groups;
- rules;
- rule providers;
- connections;
- часть overview/runtime состояния.

## 6. Что без Ubuntu service не восстановить полноценно

### 6.1. Провайдеры и SSL
Без Ubuntu service не будет полноценного контура:
- периодической проверки TLS/SSL;
- `Обновить SSL-кеш`;
- истории проверок;
- записи в БД;
- next check / last check / job status.

### 6.2. GEO-файлы
Без Ubuntu service не будет:
- last geo update;
- истории обновлений;
- статуса задач GEO;
- хранения источника/результата.

### 6.3. Ресурсы хоста
Без Ubuntu service не будет достоверного Ubuntu-host operational слоя:
- CPU/RAM/load;
- disk/network/systemd;
- хвостов логов;
- сервисного статуса Mihomo на уровне хоста.

### 6.4. Клиенты / QoS / shaping
Без Ubuntu service не вернуть полноценно:
- per-client traffic state;
- routed client markers;
- QoS profiles;
- shaping state;
- историю применений и статус правил.

## 7. Критичные разрывы, которые надо вернуть в первую очередь

### 7.1. Провайдеры
Нужно вернуть:
- живой список провайдеров;
- SSL/TLS статусы;
- дату истечения;
- last check / next check;
- ручные действия `Обновить`, `Обновить SSL-кеш`;
- фоновые проверки по расписанию;
- результат в БД.

### 7.2. Хост
Нужно вернуть:
- ресурсы хоста;
- состояние Mihomo;
- каноничный лог `/var/log/mihomo/mihomo.log`;
- host-oriented wording вместо старого router-era наследия.

### 7.3. Трафик и клиенты
Нужно вернуть:
- графики трафика;
- карточки/таблицы клиентов;
- через Mihomo / bypass / tunnel;
- QoS/shaping markers.

### 7.4. GEO / local rules / top rules
Нужно вернуть:
- дату и результат последнего обновления GEO-файлов;
- локальные правила;
- top rules;
- summary по правиловым потокам.

## 8. Практический вывод по релизам

До появления Ubuntu service не стоит выдавать косметические карточки за полноценную миграцию старого функционала. Правильный порядок такой:
1. docs + audit;
2. provider service foundation;
3. host resources;
4. traffic & clients;
5. GEO/local rules/top rules;
6. QoS/shaping foundation;
7. потом safe config flow.

## 9. Что уже хорошо и не надо ломать

- GitHub release/update flow живой;
- rolling `dist.zip` работает;
- релиз `v0.2.10` подтверждён на сервере;
- Mihomo-centric UI-база сохранена;
- Setup / backend mode groundwork уже есть;
- каноничные Ubuntu paths уже зафиксированы.

## 10. Краткий итог

Главная задача следующего этапа — не просто “докрасить старые экраны”, а вернуть **операционную логику** старой линии на новой Ubuntu-native архитектуре. Иначе UI будет выглядеть знакомо, но по факту потеряет именно тот функционал, ради которого проект вообще стоило переносить.
