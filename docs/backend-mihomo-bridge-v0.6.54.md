# Backend Mihomo bridge — v0.6.54

## Что фиксируем

На `v0.6.53` standalone Ubuntu backend уже держал realtime websocket-каналы (`traffic`, `memory`, `connections`, `logs`), но `Обзор / Топология соединений` по-прежнему не видел реальную модель Mihomo.

Причина:
- UI на `ubuntu-service` запрашивал базовые Mihomo endpoints (`/api/configs`, `/api/proxies`, `/api/providers/proxies`, `/api/providers/rules`, `/api/rules`);
- backend их не обслуживал и отвечал `404`;
- `/api/connections` в backend отдавал только host-local snapshot из `ss -tunH`, поэтому диаграмма видела в основном сам Ubuntu-хост.

## Что сделано

- добавлен bridge к локальному Mihomo controller;
- backend теперь читает `external-controller` и `secret` из `MIHOMO_ACTIVE_CONFIG` (`/etc/mihomo/config.yaml`) либо использует env overrides `MIHOMO_CONTROLLER_URL` / `MIHOMO_CONTROLLER_SECRET`;
- добавлены proxy endpoints:
  - `GET /api/configs`
  - `GET /api/proxies`
  - `GET /api/providers/proxies`
  - `GET /api/providers/rules`
  - `GET /api/rules`
- websocket `/api/connections` теперь relay-ит реальный Mihomo поток, если локальный controller доступен;
- прежний host-local snapshot оставлен как fallback only на случай, если bridge временно недоступен.

## Что проверять после релиза

1. В `Setup` активен backend `ubuntu-service`.
2. `curl http://127.0.0.1:18090/api/version` возвращает `0.6.54`.
3. В `journalctl -u ultra-ui-ubuntu-backend` больше нет `404` на:
   - `/api/configs`
   - `/api/proxies`
   - `/api/providers/proxies`
   - `/api/rules`
4. На `Обзор / Топология соединений` появляются реальные клиенты/хосты, а не только сам Ubuntu-хост.
