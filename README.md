# UltraUIXkeen

**UltraUIXkeen** — веб-интерфейс для роутеров **Netcraze Ultra** (Entware + ядро **Mihomo**) с расширениями через `router-agent`.

Цель репозитория — дать удобный веб‑интерфейс для Mihomo на Ultra, обновления через GitHub Releases и расширенные функции через **router-agent** (то, чего нет в стандартном Clash/Mihomo API).

> ⚠️ В этом форке целевое окружение — **только Mihomo** (Ultra). Sing-box и прочие ядра здесь не поддерживаются.

<p align="center">
  <img src="./readme/pc.png" height="280">
  <img src="./readme/mobile.png" height="280">
</p>

---

## Быстрый старт на роутере (Netcraze Ultra + Mihomo)

### 1) Подключить UI через Mihomo (rolling dist.zip)

Открой `/opt/etc/mihomo/config.yaml` и проверь/добавь настройки (пример):

```yaml
external-controller: 0.0.0.0:9090
secret: ""          # если используешь — укажи здесь и в UI

# Mihomo будет хранить UI в локальной папке (обычно ./ui)
external-ui: ui

# UI будет скачиваться из GitHub Release
external-ui-url: https://github.com/NightShadowDevOPs/UltraUIXkeen/releases/download/rolling/dist.zip
```

Перезапусти Mihomo.

Открытие UI обычно выглядит так:

`http://<router-ip>:9090/ui`

Если кеш мешает обновлению — можно временно добавить анти‑кэш:

`.../dist.zip?v=1730000000`

### 2) (Опционально) Установить router-agent (Entware)

Router-agent нужен для функций, которых нет в Mihomo API (например, shaping per‑client, бэкапы/восстановление и т.п.).

На роутере (Busybox wget не умеет https → используем `/opt/bin/wget`):

```sh
/opt/bin/wget -O- "https://raw.githubusercontent.com/NightShadowDevOPs/UltraUIXkeen/main/router-agent/install.sh" | sh
/opt/etc/init.d/S99zash-agent restart
```

Проверка статуса агента:

```sh
/opt/bin/wget -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=status"
```

В UI: **Router → Router agent** → включить и указать URL:

`http://<router-ip>:9099`

Подробности: `router-agent/README.md`.

---

## Что умеет UltraUIXkeen

Фокус — удобство на **Ultra/Mihomo**:

- **Прокси → Провайдеры**: карточки провайдеров responsive (нормально масштабируются под ширину экрана).
- **Подписки**: отдельная вкладка для агрегированных клиентских подписок и QR-кодов (Mihomo/Clash и V2Ray/Xray), при этом трафик клиента идёт напрямую к серверам провайдеров.
- **Подписки**: можно указать публичную HTTPS-базу для опубликованного reverse proxy и собирать клиентские ссылки/QR уже из неё, а `format=json` умеет возвращать канонические публичные URL через `X-Forwarded-*`.
- **Прокси → Провайдеры**: настройка «показать/скрыть протоколы» (DIRECT/REJECT/VLESS/…)
  - сохранение (persist)
  - пресеты: «Показать всё», «Скрыть DIRECT+REJECT».
- Исправления UX (прозрачность/читаемость выпадающих меню).
- **Router-agent** (Entware): API для расширенных функций и **бэкапы** (в т.ч. в облако через rclone).
- **Router → Host QoS priority**: заготовка приоритизации трафика для LAN-хостов (High / Normal / Low) через `tc` на роутере, без обязательных ручных правок в конфиге.

---

## Резервное копирование (UI + конфиги Mihomo + состояние агента)

Router-agent устанавливает `/opt/zash-agent/backup.sh`.

Он собирает архив:
- `/opt/etc/mihomo/config.yaml` и GEO/правила (если есть),
- состояние агента (`/opt/zash-agent/var/*`, включая `users-db.json`),
- **опционально**: скачивает текущий `dist.zip` UI внутрь бэкапа.

Загрузка в облако делается через **rclone** (Google Drive / Yandex Disk WebDAV).

В UI: **Router → Router agent → Backup schedule** можно задать время (по умолчанию **04:00**) и применить cron на роутере.

Подробная инструкция: `docs/backup.md`
Если в `RCLONE_REMOTE` / `RCLONE_REMOTES` остались старые имена remote, router-agent теперь умеет fallback на реальные remotes из `rclone.conf`: не только для облачной истории/restore в UI, но и для самой выгрузки новых архивов через `backup.sh` / cron.

Справка по агенту: `router-agent/README.md`.

---

## Обновления (как мы работаем)

1) ChatGPT готовит архив дистрибутива (файлы сразу в корне архива).
2) Денис распаковывает поверх локального репо → commit & push.
3) Роутер подтягивает UI из GitHub Release `rolling/dist.zip`.

---

## Разработка (локально)

```sh
pnpm i
pnpm dev
pnpm build
```

---

## Upstream

Основа: **Zephyruso/zashboard**. UltraUIXkeen остаётся форком с адаптацией под **Netcraze Ultra + Mihomo**.


- На вкладке `Подписки` отдельно разведены режимы `Разовый импорт дома` и `Обновляемая подписка`, чтобы было видно, когда сохранённый клиентом локально конфиг можно использовать вне дома и когда для обновления всё ещё нужен доступ к `router-agent`.
- В `router-agent` исправлена генерация `format=mihomo`: секция `proxy-groups:` теперь выводится явно, чтобы Clash/Mihomo/Hiddify не получали поломанный YAML с группами `Manual / Auto / Failover / Balance` в неправильном месте.
- Для V2RayTun на вкладке `Подписки` теперь снова выведены отдельный `format=v2raytun` URL, deeplink `v2raytun://import/...` и QR-режим для живой LAN-проверки; при этом релиз честно оставляет этот поток в статусе экспериментального локального импорта, а не финальной внешней подписки.
