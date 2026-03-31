# v0.6.49 — backend install hotfix

## Что сломалось в v0.6.48

На живом сервере install-flow падал на строке генерации systemd unit с ошибкой:

```
ULTRA_UI_HOST: unbound variable
```

Из-за этого backend не доходил до шага `systemctl enable --now`, а unit `ultra-ui-ubuntu-backend.service` вообще не создавался.

## Что исправлено

- `backend/scripts/install.sh` больше не генерирует unit через heredoc с разворачиванием shell-переменных.
- Unit ставится копированием готового шаблона `backend/deploy/ultra-ui-ubuntu-backend.service`.
- Новый `/etc/ultra-ui-ubuntu/agent.env` создаётся сразу с `ULTRA_UI_HOST=0.0.0.0`.
- Если env уже существовал и содержал `ULTRA_UI_HOST=127.0.0.1`, install/update автоматически меняет его на `0.0.0.0`.

## Что проверено

- синтаксис исправленного `install.sh`;
- synthetic install-run с подменой `systemctl`: env-файл создаётся, service file пишется, падения на `set -u` больше нет;
- synthetic update-run: старое значение `ULTRA_UI_HOST=127.0.0.1` автоматически обновляется на `0.0.0.0`.

## Команда установки/обновления

```bash
clear
cd /opt/UIUbuntu/app
chmod +x backend/scripts/install.sh
./backend/scripts/install.sh

curl -s http://127.0.0.1:18090/api/health
curl -s http://127.0.0.1:18090/api/version
curl -s http://127.0.0.1:18090/api/capabilities

systemctl status ultra-ui-ubuntu-backend --no-pager
```
