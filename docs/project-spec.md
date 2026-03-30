# UIUbuntuXkeen — полное ТЗ проекта

Актуальная версия документа: **v0.4.1**  
Дата актуализации: **2026-03-30**

## 0. Статус документа

Документ соответствует релизу **v0.4.1**. На этом этапе уже зафиксированы release-flow новой линии, foundation backend contract, hybrid backend setup flow и runtime/setup/observability foundation: Setup, Edit Backend и Runtime теперь показывают backend contract preview, data flow модель и каноничный путь к логу Mihomo на Ubuntu: `/var/log/mihomo/mihomo.log`.

## 1. Назначение проекта

**UIUbuntuXkeen** — это отдельный Ubuntu-oriented продукт для управления **Mihomo** на Ubuntu-хосте или Ubuntu-сервере.

Проект создаётся на основе линии **UltraUIXkeen / UI Mihomo / Ultra**, но не должен оставаться роутерным форком с косметическим ребрендингом. Цель — превратить лучший опыт текущего UI в самостоятельный operational-интерфейс под Ubuntu.

Проект должен:
- сохранить сильные стороны текущего UI Mihomo;
- отказаться от жёсткой привязки к Netcraze Ultra / Entware / BusyBox / CGI;
- перейти на Ubuntu-native модель путей, сервисов и системной интеграции;
- безопасно работать с `config.yaml` Mihomo;
- быть удобным для постоянной desktop/web эксплуатации.

## 2. Базовый источник требований

Исходная база:
- проект-источник: **UltraUIXkeen**;
- технологическая база: **Vue 3 + TypeScript**;
- функциональный ориентир: UI для Mihomo с расширениями через `router-agent`;
- стартовая кодовая основа для нового проекта: линия **1.2.106**.

Для Ubuntu-линии источником требований считаются:
- текущий UI и его рабочие модули;
- пакет переноса проекта под Ubuntu;
- зафиксированный roadmap переноса;
- требования по безопасному редактированию конфигурации Mihomo.

## 3. Цель MVP

Первый полноценный MVP Ubuntu-линии должен уметь:
1. Подключаться к Mihomo на Ubuntu.
2. Показывать operational dashboard.
3. Давать безопасный контур редактирования `config.yaml`.
4. Показывать прокси, провайдеры, правила, соединения, логи и базовые метрики.
5. Работать через Ubuntu-native backend/service API, а не через router CGI.
6. Делать backup/restore.
7. Быть удобным для desktop/web эксплуатации.

## 4. Платформа и пути Ubuntu

Новый проект работает под **Ubuntu Server / Ubuntu Desktop**.

### Канонические пути

- активный конфиг Mihomo: `/etc/mihomo/config.yaml`
- состояние приложения: `/var/lib/ultra-ui-ubuntu/`
- safe-config state: `/var/lib/ultra-ui-ubuntu/config/`
- логи приложения: `/var/log/ultra-ui-ubuntu/`
- конфиг backend-service: `/etc/ultra-ui-ubuntu/agent.env`
- backend contract foundation: `docs/backend-contract.md`
- systemd unit-файлы и timers — штатный способ запуска и фоновых задач

### Платформенные ожидания

- сервисный менеджер: `systemd`
- системные утилиты: `ip`, `ss`, `tc`, `nft`, `iptables` (fallback), `curl`, `openssl`
- журналы: `journalctl` и/или файловые логи
- фоновые задачи: `systemd timers` предпочтительно, cron как fallback

**Важно:** старые пути Xkeen/Entware не считаются основной архитектурой и не должны использоваться как канон для новой Ubuntu-линии.

## 5. Архитектура решения

### Frontend
- Vue 3
- TypeScript
- существующая UI-база UltraUIXkeen как стартовая основа
- развитие в сторону более чистого Ubuntu-friendly operational UI

### Backend / service layer
- отдельный backend-service под Ubuntu
- предпочтительный стек: FastAPI или Go
- shell/cgi допускаются только как временный переходный мост, но не как основа продукта

### Storage / state
На этапе MVP допускается file-based state, позже возможно вынесение части состояния в SQLite/PostgreSQL, если это даст практическую пользу для history, audit, jobs, users и limits.

### Transport
- REST API
- SSE/WebSocket для live metrics, jobs, long-running operations

### Auth
- bearer token
- опциональный trusted LAN mode для локальной среды

## 6. Функциональные модули

### 6.1 Overview
Сводный operational dashboard:
- состояние Mihomo;
- состояние backend-service;
- CPU / RAM / uptime / load;
- базовые health-индикаторы;
- краткая сводка по трафику, соединениям и журналу.

### 6.2 Runtime / Host
Ubuntu-версия раздела Router:
- host runtime;
- сетевой статус;
- системные сервисы;
- runtime capabilities;
- диагностика backend-service.

### 6.3 Mihomo Workspace
Ключевой рабочий раздел проекта.

Должен объединять:
- Runtime;
- Proxies;
- Proxy Providers;
- Proxy Groups;
- Rules;
- Rule Providers;
- Config;
- Diagnostics / History / Compare.

### 6.4 Proxies / Providers / Rules
UI должен поддерживать:
- список прокси и групп;
- переключение активных групп;
- latency preview;
- статусы и бейджи;
- proxy providers и rule providers;
- правила и их связь с policy/target.

### 6.5 Connections / Logs / Traffic
- живые соединения;
- фильтрация и детализация;
- live/log views;
- traffic statistics;
- подготовка контура QoS / shaping / policy operations.

### 6.6 Subscriptions
- клиентские подписки;
- генерация output-форматов;
- QR-коды;
- подготовка к публикации через внешний HTTPS-контур.

### 6.7 Users / Policies / Limits
- список пользователей / хостов / клиентов;
- labels и операционная логика;
- limits / policies как отдельный развиваемый контур.

### 6.8 Jobs / Tasks
- сервисные операции;
- долгие фоновые задачи;
- import/export/maintenance workflows;
- visible progress и состояния выполнения.

### 6.9 Setup / Settings
- первичная настройка подключения к Mihomo и backend-service;
- прикладные настройки UI;
- capabilities;
- режимы работы;
- системные параметры проекта.

### 6.10 Global Search / Command Palette
- быстрый поиск сущностей;
- быстрые переходы по разделам;
- быстрый запуск действий уровня оператора.

## 7. Критичный контур: безопасное управление `config.yaml`

Редактор конфигурации — отдельный критичный контур продукта, а не просто текстовое поле.

### Обязательные принципы

- active config и draft разделены;
- все изменения сначала попадают в draft;
- draft валидируется локальным Mihomo binary;
- перед apply создаётся snapshot текущего рабочего состояния;
- после apply доступен rollback;
- есть baseline для аварийного восстановления;
- ведётся history ревизий и журнал операций.

### Safe flow
1. Читать active config.
2. Создавать/обновлять draft.
3. Показывать diff active vs draft.
4. Validate draft.
5. Apply validated draft.
6. При неуспешном запуске выполнять rollback.
7. Сохранять revision/history/audit trail.

### Structured editors
Structured-редакторы должны стать основным путём работы, а raw YAML остаётся fallback-режимом.

Первый обязательный набор:
- DNS
- Rules
- Proxies

Далее:
- Proxy Groups
- Proxy Providers
- Rule Providers
- Tun / Profile / Sniffer
- дополнительные nested-поля

Редкие поля можно временно держать в `extra YAML`, но мастер создания сущности не должен напрямую ломать весь YAML.

## 8. Требования к backend-service API

На релизах `v0.3.0–v0.4.1` в проекте уже зафиксирован foundation backend contract: режимы `compatibility-bridge` и `ubuntu-service`, каноничные Ubuntu paths, стартовый набор endpoint groups, явный выбор backend mode, UI-preview backend contract в setup/edit flow, наглядная data flow модель и каноничный путь к логу Mihomo `/var/log/mihomo/mihomo.log` в runtime/setup экранах. Это ещё не финальная реализация Ubuntu service, но уже каноничная точка для дальнейшего развития API, hybrid data model, capability-driven UI и observability-модели.


Backend-service должен обеспечивать:
- status / health / version / capability discovery;
- системные метрики;
- config active / draft / baseline / history;
- validate / apply / rollback;
- backup / restore;
- subscriptions;
- QoS / shaping / policy operations;
- users / limits / related state;
- provider SSL diagnostics;
- jobs / task status.

### Минимальные endpoint-группы
- `/api/status`
- `/api/health`
- `/api/version`
- `/api/mihomo/config/*`
- `/api/mihomo/proxies`
- `/api/mihomo/proxy-providers`
- `/api/mihomo/rules`
- `/api/mihomo/rule-providers`
- `/api/system/metrics`
- `/api/system/network`
- `/api/system/connections`
- `/api/system/logs`
- `/api/traffic`
- `/api/qos`
- `/api/users`
- `/api/limits`
- `/api/subscriptions`
- `/api/backups`
- `/api/jobs`

## 9. UX-требования

Интерфейс должен:
- не быть бесконечной простынёй;
- раскладывать крупные разделы на вкладки и подвкладки;
- явно показывать опасные действия: Validate, Apply, Rollback, Restore;
- показывать progress/state для долгих операций;
- быть удобным на desktop/web под Ubuntu;
- сохранять быстрый доступ к главным действиям;
- поддерживать global search / command palette.

## 10. Нефункциональные требования

- надёжность: конфиг не должен ломать рабочий Mihomo без rollback;
- безопасность: bearer token, audit trail, ограничение destructive actions;
- производительность: virtualized tables/lists для больших логов и соединений;
- наблюдаемость: health endpoints, capability diagnostics, сервисные логи;
- отказоустойчивость: backend-service не зависит от перезапуска UI;
- локализация: RU обязательно, EN желательно;
- темы: светлая и тёмная;
- обновляемость: простой release flow;
- тестируемость: validate/apply/rollback и YAML parsing/building должны иметь автоматические тесты.

## 11. Что переносим, а что перепроектируем

### Переносим почти как есть
- базовую навигацию;
- Mihomo Workspace;
- сильные UI-паттерны текущего проекта;
- raw YAML fallback;
- global search.

### Адаптируем под Ubuntu
- structured editors;
- backup/restore;
- subscriptions;
- setup/settings;
- traffic / users / diagnostics.

### Перепроектируем
- `router-agent` shell/cgi;
- host/runtime контур под Ubuntu;
- QoS/shaping модель под Ubuntu;
- системную интеграцию с файлами, журналами и сервисами.

## 12. Критерии приёмки первого полноценного релиза

Первый полноценный релиз Ubuntu-линии считается готовым, когда:
1. UI подключается к Mihomo на Ubuntu и показывает статус.
2. Есть разделы Overview, Runtime, Proxies, Proxy Providers, Rules, Mihomo, Settings.
3. Есть safe config flow: draft / validate / apply / rollback / history.
4. Structured editors покрывают минимум DNS, Rules и Proxies.
5. Ошибка в конфиге не оставляет систему без rollback.
6. Есть live connections, logs и базовые metrics.
7. Есть backup/restore в локальный каталог.
8. Есть bearer-token auth для backend-service.
9. UI ощущается как Ubuntu-продукт, а не как роутерная панель, открытая в браузере.

## 13. Release flow проекта

Порядок работы по релизу:
1. ChatGPT готовит дистрибутив проекта.
2. Вместе с релизом отдаёт commit message.
3. Пользователь заливает изменения в репозиторий через GitHub Desktop.
4. Пользователь проверяет GitHub Actions.
5. Пользователь обновляет UI на сервере через кнопку **«Обновить»** в самом UI.
6. В релиз обязательно входят обновлённые документы в `docs/`.
7. В релиз обязательно входит актуальный файл переноса в новый чат.

## 14. Обязательные документы в каждом релизе

В папке `docs/` всегда должны быть:
- полное ТЗ проекта;
- план работ/roadmap;
- журнал выполненных релизов;
- актуальный transfer-файл для нового чата.

## 15. Roadmap после MVP

После закрытия MVP проект развивается в сторону:
- расширенных мастеров создания сущностей;
- редких nested structured editors;
- audit views;
- продвинутых policy / automation сценариев;
- multi-instance support;
- optional desktop wrapper;
- cluster/fleet сценариев при необходимости.
