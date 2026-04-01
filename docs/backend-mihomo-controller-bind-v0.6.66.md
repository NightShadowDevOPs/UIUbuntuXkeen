# UIUbuntuXkeen v0.6.66 — Mihomo controller bind hotfix

## Что сломалось

На живом Ubuntu-хосте `external-controller` в `/etc/mihomo/config.yaml` слушает только `192.168.5.23:9090`, а `127.0.0.1:9090` закрыт.
Из-за этого standalone backend (`ubuntu-service`) мог заваливать bridge-запросы (`/api/providers/proxies`, `/api/proxies`, и т.д.) `ConnectionRefusedError`, если runtime не доходил до корректного controller URL и пытался стучаться в локальный дефолт.

## Что исправлено

- `backend/scripts/install.sh` теперь читает `external-controller` и `secret` из `/etc/mihomo/config.yaml` и фиксирует их в `/etc/ultra-ui-ubuntu/agent.env` как `MIHOMO_CONTROLLER_URL` / `MIHOMO_CONTROLLER_SECRET`.
- В `mihomo_bridge.py` добавлена обработка `urllib.error.URLError`: backend теперь возвращает структурированный `502` JSON с `mihomo-controller-connect-failed` и адресом upstream вместо падения ASGI-обработчика.

## Проверка

```bash
clear
grep -E '^(MIHOMO_ACTIVE_CONFIG|MIHOMO_CONTROLLER_URL|MIHOMO_CONTROLLER_SECRET)=' /etc/ultra-ui-ubuntu/agent.env || true
echo
curl -s http://127.0.0.1:18090/api/version
echo
curl -s http://127.0.0.1:18090/api/providers/proxies | head -c 400
echo
```
