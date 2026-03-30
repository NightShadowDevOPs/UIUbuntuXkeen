# Резервное копирование и восстановление

Эта инструкция описывает настройку **локальных** и **облачных** бэкапов для связки:

- **UltraUIXkeen** (внешний UI, подтягивается Mihomo через `external-ui-url`)
- **router-agent** (Entware, порт `9099`), который создаёт бэкапы и умеет восстановление

> rclone **не обязателен**: без него бэкапы будут храниться локально на роутере.

---

## Что входит в бэкап

Скрипт `/opt/zash-agent/backup.sh` собирает архив `zash-backup-<host>-<timestamp>.tar.gz`.

### Mihomo
- `/opt/etc/mihomo/config.yaml`
- GEO базы (если есть):
  - `/opt/etc/mihomo/GeoIP.dat`
  - `/opt/etc/mihomo/GeoSite.dat`
  - `/opt/etc/mihomo/ASN.mmdb`
- Доп. правила (если есть): `/opt/etc/mihomo/rules`

### router-agent
- `/opt/zash-agent/agent.env`
- состояние/база UI:
  - `/opt/zash-agent/var/users-db.json`
  - `/opt/zash-agent/var/users-db.meta.json`
  - `/opt/zash-agent/var/users-db.revs/`
- shaping / блокировки:
  - `/opt/zash-agent/var/shapers.db`
  - `/opt/zash-agent/var/blocks.db`
- лог агента (если есть): `/opt/zash-agent/var/agent.log`

### Опционально: UI (dist.zip)
Если задана переменная `UI_ZIP_URL`, скрипт скачает текущий `dist.zip` и положит его внутрь архива.

> BusyBox `wget` часто не умеет HTTPS — на Ultra используем `/opt/bin/wget`.

---

## Где лежат бэкапы и логи

По умолчанию:

- Локальные бэкапы: `/opt/zash-agent/var/backups/`
- Статус последнего бэкапа: `/opt/zash-agent/var/backup.last.json`
- Лог последнего бэкапа: `/opt/zash-agent/var/backup.last.log`

Для восстановления:

- Статус: `/opt/zash-agent/var/restore.last.json`
- Лог: `/opt/zash-agent/var/restore.last.log`
- Перед восстановлением создаётся **pre-snapshot** текущих файлов:
  - `/opt/zash-agent/var/restore.pre-<host>-<timestamp>.tar.gz`

---

## Шаг 0. Убедиться, что router-agent установлен и живой

Установка/обновление агента:

```sh
/opt/bin/wget -O- "https://raw.githubusercontent.com/NightShadowDevOPs/UltraUIXkeen/main/router-agent/install.sh" | sh
/opt/etc/init.d/S99zash-agent restart
```

Проверка статуса:

```sh
/opt/bin/wget -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=status"
```

Если в `agent.env` задан `TOKEN=...`, то запросы должны идти с заголовком:

`Authorization: Bearer <token>`

---

## Вариант A: только локальные бэкапы (без облака)

### 1) Запустить бэкап вручную

**Через UI:**
- Router → Router agent → **Backup**

**Через CLI на роутере:**

```sh
/opt/zash-agent/backup.sh
```

### 2) Проверить, что архив появился

```sh
ls -lh /opt/zash-agent/var/backups | tail
cat /opt/zash-agent/var/backup.last.json
tail -n 50 /opt/zash-agent/var/backup.last.log
```

---

## Вариант B: загрузка бэкапов в облако (Google Drive / Yandex Disk)

Для облака используется **rclone**.

### 1) Установить rclone (Entware)

```sh
opkg update
opkg install rclone
rclone version
```

### 2) Настроить remote в rclone

Запусти:

```sh
rclone config
```

#### Google Drive (remote name: `gdrive`)

На роутере rclone покажет URL авторизации.

Обычно рабочий сценарий такой:
1) В `rclone config` создаёшь remote типа **drive**.
2) Когда rclone покажет ссылку — **копируешь её** и открываешь на ПК/телефоне в браузере.
3) Разрешаешь доступ, копируешь код/токен и вставляешь обратно в SSH.

Проверка:

```sh
rclone listremotes
rclone lsd gdrive:
```

Проверка текущего remote/конфига:

```sh
rclone config file
rclone listremotes
```

Если агент использует отдельный конфиг, укажи его явно через `RCLONE_CONFIG`.

#### Yandex Disk

Самый простой вариант на роутере — **WebDAV**:
- type: `webdav`
- url: `https://webdav.yandex.ru`
- vendor: `other`
- user: логин Яндекса
- pass: **пароль приложения** (создаётся в Яндекс ID)

Проверка:

```sh
rclone listremotes
rclone lsd yandex:
```

---

## Настройка переменных в agent.env

Открой файл:

```sh
vi /opt/zash-agent/agent.env
```

И задай/проверь блок для бэкапов:

```sh
# куда складывать локальные архивы
BACKUP_TMP_DIR="/opt/zash-agent/var/backups"

# локальная ротация (удалять локальные файлы старше N дней)
BACKUP_KEEP_DAYS="30"

# (опционально) положить внутрь архива текущий UI dist.zip
UI_ZIP_URL="https://github.com/NightShadowDevOPs/UltraUIXkeen/releases/download/rolling/dist.zip"

# облако через rclone
RCLONE_CONFIG="/opt/etc/rclone.config"   # опционально, если нужен явный путь к конфигу
RCLONE_REMOTE="gdrive"                   # или yandex
RCLONE_PATH="NetcrazeBackups/zash-agent"
RCLONE_KEEP_DAYS="30"                    # удалять из облака старше N дней (best-effort)
```

> Локальная ротация включена: установи `BACKUP_KEEP_DAYS` (в днях), чтобы удалять локальные архивы старше указанного срока.

Перезапусти агент:

```sh
/opt/etc/init.d/S99zash-agent restart
```

---

## Расписание (cron)

### Через UI (рекомендуется)

Router → Router agent:
- блок **Cloud backup** покажет, видит ли агент `rclone`, какой `remote:path` используется и какой путь к `rclone` config обнаружен
- в списках **Backup history** и **Cloud backups** можно выбрать архив для восстановления или удалить его прямо из UI
- если в `RCLONE_REMOTE` / `RCLONE_REMOTES` остались старые имена remote, агент теперь умеет fallback на реальные remotes из `rclone.conf`: это касается не только истории облачных архивов и restore в UI, но и самой выгрузки новых архивов через `backup.sh` / cron
- блок **Backup schedule** позволяет менять время (по умолчанию **04:00**) и применять cron‑строку на роутере (`# zash-backup`)

### Вручную

Открой crontab (в зависимости от системы путь может отличаться):

```sh
crontab -e
```

Пример: ежедневно в 04:00

```cron
0 4 * * * /opt/zash-agent/backup.sh >/opt/zash-agent/var/backup.cron.log 2>&1 # zash-backup
```

---

## Восстановление (Restore)

> Восстановление **перезаписывает файлы**. Перед применением скрипт делает **pre-snapshot** текущих файлов.

### Через UI

Router → Router agent → **Restore**:
- file: `latest` или выбрать файл из списка
- scope:
  - `all` — Mihomo + агент
  - `mihomo` — только Mihomo
  - `agent` — только агент
- include env: восстанавливать ли `agent.env` (по умолчанию **выключено**)

После восстановления может понадобиться перезапуск:

```sh
# если меняли конфиги Mihomo
/opt/etc/init.d/S99mihomo restart

# если меняли агент
/opt/etc/init.d/S99zash-agent restart
```

(точные имена init‑скриптов зависят от сборки/Entware, если у тебя другие — используй свои.)

### Через CLI

```sh
# latest + всё
/opt/zash-agent/restore.sh latest all 0

# восстановить только mihomo
/opt/zash-agent/restore.sh latest mihomo 0

# восстановить только agent (без agent.env)
/opt/zash-agent/restore.sh latest agent 0

# восстановить agent вместе с agent.env (осторожно)
/opt/zash-agent/restore.sh latest agent 1
```

Логи/статус:

```sh
cat /opt/zash-agent/var/restore.last.json
tail -n 100 /opt/zash-agent/var/restore.last.log
```

---

## Безопасность

- Агент слушает LAN (`br0`) на `9099`. Не пробрасывай этот порт в интернет.
- Рекомендуется задать токен:

```sh
# /opt/zash-agent/agent.env
TOKEN="long-random-token"
```

Тогда UI будет отправлять `Authorization: Bearer ...`.

---

## Быстрая диагностика

### Бэкап не грузится в облако

1) Проверь, что rclone установлен:

```sh
command -v rclone && rclone version
```

2) Проверь remote:

```sh
rclone listremotes
```

3) Проверь переменные в `agent.env`: `RCLONE_REMOTE`, `RCLONE_REMOTES`, `RCLONE_PATH`. Если там остались старые имена remote, новые версии agent умеют fallback на живые remotes из `rclone.conf`, но сами env-переменные всё равно лучше привести в порядок.

4) Посмотри лог:

```sh
tail -n 200 /opt/zash-agent/var/backup.last.log
```

### Не скачивается UI dist.zip внутрь бэкапа

- Проверь `UI_ZIP_URL`.
- Проверь, что есть `/opt/bin/wget` (HTTPS):

```sh
ls -l /opt/bin/wget
```

---

## Полезные команды

Список локальных архивов:

```sh
ls -1t /opt/zash-agent/var/backups/zash-backup-*.tar.gz | head
```

Сколько места занимают бэкапы:

```sh
du -sh /opt/zash-agent/var/backups
```


## Что видно в UI

В разделе **Router → Router agent** отображаются:
- локальная история архивов на роутере;
- облачная история архивов из `RCLONE_REMOTE:RCLONE_PATH` (через `rclone`);
- метки, есть ли тот же архив локально.


## Восстановление из облака

После настройки `rclone` и переменных `RCLONE_REMOTE` / `RCLONE_PATH` можно восстановить архив прямо из облака:

```sh
/opt/zash-agent/restore-cloud.sh latest all 0
```

Или конкретный архив:

```sh
/opt/zash-agent/restore-cloud.sh zash-backup-router-20260306-120000.tar.gz all 0
```

`RCLONE_PATH` можно задавать как `backup/Zash` или `/backup/Zash` — агент теперь нормализует путь автоматически.
