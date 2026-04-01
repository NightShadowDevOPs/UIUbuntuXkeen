# UIUbuntuXkeen backend

Версия: **v0.6.56**

Что это:
- отдельный Ubuntu backend/service для UIUbuntuXkeen;
- FastAPI + SQLite;
- systemd service;
- хранение `3x-ui Hosts`, `Users inventory`, `jobs`;
- SSL/TLS-проверка панелей 3x-ui по `panelUrl`.

## Локальный запуск

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./scripts/run-dev.sh
```

По умолчанию backend слушает `0.0.0.0:18090` в dev-режиме.

## Установка на Ubuntu

```bash
cd backend
./scripts/install.sh
```

Скрипт:
- копирует backend в `/opt/ultra-ui-ubuntu-backend`;
- создаёт `.venv`;
- устанавливает зависимости;
- создаёт `/etc/ultra-ui-ubuntu/agent.env` c `ULTRA_UI_HOST=0.0.0.0` и `ULTRA_UI_SSL_WARN_DAYS=2`;
- при update автоматически переводит старый `ULTRA_UI_HOST=127.0.0.1` на `0.0.0.0`;
- регистрирует и запускает systemd unit `ultra-ui-ubuntu-backend.service` из шаблона `backend/deploy/ultra-ui-ubuntu-backend.service`.

## Главные endpoints

- `GET /api/health`
- `GET /api/version`
- `GET /api/capabilities`
- `GET /api/status`
- `GET /api/providers`
- `PUT /api/providers`
- `GET /api/providers/checks`
- `GET /api/providers/checks/history`
- `POST /api/providers/checks/run`
- `POST /api/providers/ssl-cache/refresh`
- `GET /api/providers/ssl-cache/status`
- `GET /api/users/inventory`
- `PUT /api/users/inventory`
- `GET /api/jobs`


Примечание `v0.6.56`: backend работает как основной `ubuntu-service` контур. Для 3x-ui host SSL warning threshold по умолчанию закреплён как 2 дня, а сохранение списка host запускает refresh SSL state без ожидания следующего длинного TTL.
