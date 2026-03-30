# UIUbuntuXkeen — сообщение для нового чата

Вставь этот файл целиком в новый чат.

---

Мы продолжаем проект **UIUbuntuXkeen**.

## Что это за проект

UIUbuntuXkeen — это отдельный Ubuntu-oriented веб-интерфейс для управления **Mihomo** на Ubuntu-хосте/сервере.

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
5. в каждом релизе обязательно обновляешь этот transfer-файл для нового чата.

## Обязательные документы в docs

В `docs/` всегда должны быть:
- `project-spec.md` — полное ТЗ;
- `roadmap.md` — план работ по релизам;
- `releases.md` — журнал выполненных релизов;
- `chat-transfer.md` — актуальный перенос в новый чат.

## Текущий статус

Текущий релиз: **v0.2.4**

Что уже сделано:
- залита стартовая база нового репозитория;
- docs приведены к одному каноничному комплекту;
- сформировано полное ТЗ Ubuntu-линии;
- сформирован roadmap переноса;
- сформирован единый transfer-файл;
- удалены лишние устаревшие документы из `docs/`;
- обновлены project metadata и branding новой Ubuntu-линии;
- добавлен GitHub Actions pipeline сборки и публикации релизов;
- настроен rolling release `dist.zip` для обновления UI через кнопку «Обновить»;
- после hotfix `v0.2.1` шаг `pnpm type-check` больше не блокирует выпуск артефакта при типовом `Exit code 2`;
- в `v0.2.2` GitHub Actions переведены на Node 24-ready версии official actions, чтобы убрать предупреждения про deprecated Node 20 runtime.
- в `v0.2.3` исправлен шаг GitHub Actions **Read project version**: версия теперь читается напрямую из `package.json` через `python3`, без хрупкой inline-команды через `node -p`.
- в `v0.2.4` шаг **Install dependencies** переведён в CI-safe режим: `CI=true`, `HUSKY=0`, установка через `pnpm install --frozen-lockfile --ignore-scripts`, чтобы Husky/prepare и другие lifecycle-хуки не валили pipeline на установке зависимостей.

## Архитектурные правила проекта

### Ubuntu paths
Используем только Ubuntu-ориентированную модель путей:
- `/etc/mihomo/config.yaml`
- `/var/lib/ultra-ui-ubuntu/`
- `/var/lib/ultra-ui-ubuntu/config/`
- `/var/log/ultra-ui-ubuntu/`
- `/etc/ultra-ui-ubuntu/agent.env`

Старые Xkeen/Entware пути не считаются каноничными для новой линии.

### Что переносим из старого проекта
- лучшие части текущего UI;
- Mihomo Workspace;
- safe config flow;
- structured editors;
- traffic / providers / rules / subscriptions / diagnostics.

### Что перепроектируем
- `router-agent` shell/cgi;
- роутерные пути и роутерную системную модель;
- host/runtime контур под Ubuntu;
- QoS/shaping под Ubuntu.

## Текущий roadmap

Ближайшие релизы:
- `v0.3.0` — Backend contract foundation
- `v0.4.0` — Runtime / Setup / Observability foundation
- `v0.5.0` — Safe config core
- `v0.6.0` — Structured editors MVP
- `v0.7.0` — Operational parity I
- `v0.8.0` — Operational parity II
- `v0.9.0` — Backup / Restore / Diagnostics
- `v1.0.0` — Ubuntu MVP complete

## Что важно помнить в следующем чате

- docs нужно обновлять **в каждом релизе**;
- не плодить пачку отдельных transfer-файлов по патчам;
- не тащить Xkeen-пути в Ubuntu-линейку как основную архитектуру;
- переход делать этапами, а не одним безумным прыжком через пропасть.
