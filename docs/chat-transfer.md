# UIUbuntuXkeen — перенос в новый чат

Актуальный релиз для переноса: **v0.4.1**

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
5. в каждом релизе обязательно обновляешь этот transfer-файл для нового чата;
6. в каждом релизе даёшь отдельный архив для переноса проекта в новый чат.

## Обязательные документы в docs

В `docs/` всегда должны быть:
- `project-spec.md` — полное ТЗ;
- `backend-contract.md` — Ubuntu backend contract;
- `roadmap.md` — план работ по релизам;
- `releases.md` — журнал выполненных релизов;
- `chat-transfer.md` — актуальный перенос в новый чат.

## Текущий статус

- Текущий релиз линии: **v0.4.1**
- Последний подтверждённо рабочий релиз на сервере: **v0.2.10**
- Текущий релиз `v0.4.1` подготовлен, но ещё не подтверждён пользователем.

Что уже сделано:
- залита стартовая база нового репозитория;
- docs приведены к одному каноничному комплекту;
- сформировано полное ТЗ Ubuntu-линии;
- настроен GitHub Actions pipeline и rolling release `dist.zip`;
- подтверждён рабочий server-side update flow на релизе `v0.2.10`;
- в `v0.3.0` добавлен foundation-слой Ubuntu backend contract: project constants, release constants, backend kinds/capabilities и normalization layer для setup/backend entries.
- в `v0.3.1` setup/edit backend получил явный выбор backend mode, рекомендуемый secondary path и визуальное разделение direct Mihomo vs Ubuntu service.
- в `v0.3.2` Setup и Edit Backend показывают backend contract preview: base URL, expected probe/runtime endpoint-ы и каноничные Ubuntu paths; runtime workspace начал менять видимый смысл между router-oriented и host-oriented режимом.
- в `v0.4.1` Setup, Edit Backend и раздел «Роутер / рантайм» дополнительно показывают каноничный путь к логу Mihomo: `/var/log/mihomo/mihomo.log`.

## Архитектурные правила проекта

### Ubuntu paths
Используем только Ubuntu-ориентированную модель путей:
- `/etc/mihomo/config.yaml`
- `/var/lib/ultra-ui-ubuntu/`
- `/var/lib/ultra-ui-ubuntu/config/`
- `/var/log/ultra-ui-ubuntu/`
- `/etc/ultra-ui-ubuntu/agent.env`

Старые Xkeen/Entware пути не считаются каноничными для новой линии.

### Backend contract
Сейчас допустимы два режима:
- `compatibility-bridge` — переходный режим для существующей UI-базы;
- `ubuntu-service` — целевой режим нового продукта.

Минимальный foundation endpoint set:
- `/api/status`
- `/api/health`
- `/api/version`
- `/api/capabilities`
- `/api/system/metrics`
- `/api/system/connections`
- `/api/system/logs`
- `/api/mihomo/config/active`
- `/api/mihomo/config/draft`
- `/api/mihomo/config/history`
- `/api/mihomo/config/validate`
- `/api/mihomo/config/apply`
- `/api/mihomo/config/rollback`

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
- для встроенного обновления сервера использовать **постоянную rolling-ссылку**, а не менять URL на каждую новую версию;
- переход делать этапами, а не одним безумным прыжком через пропасть.

## Последние релизы

- `v0.2.10` — первый подтверждённо рабочий релиз: сборка прошла, сервер обновился через кнопку **«Обновить»**.
- `v0.3.0` — foundation-релиз backend contract: единые project/release constants, backend kinds/capabilities и normalization layer.
- `v0.3.1` — hybrid backend setup polish: выбор backend mode, рекомендуемый secondary path и badge-ы режима в Setup.
- `v0.3.2` — runtime/setup contract preview: backend contract preview в Setup/Edit Backend и первые host-oriented runtime заголовки для режима `ubuntu-service`.
- `v0.4.1` — observability log-path polish: в Setup, Edit Backend и разделе «Роутер / рантайм» показан каноничный лог Mihomo `/var/log/mihomo/mihomo.log`.
