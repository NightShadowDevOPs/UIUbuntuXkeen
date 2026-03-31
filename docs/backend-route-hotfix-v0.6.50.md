# v0.6.50 — frontend route hotfix for standalone backend

## Что сломалось после живого подключения backend

После выбора backend `ubuntu-service` в `Setup` с `secondaryPath=/api` сам backend успешно подключался и отвечал на `/api/health`, `/api/version`, `/api/capabilities`, `/api/status`, но часть фронтовых запросов продолжала собираться с лишним префиксом `/api`.

Из-за этого UI строил битые адреса вида:

```
http://<host>:18090/api/api/capabilities
```

и экран `Хосты 3x-ui` падал в `capabilities-http-404`, хотя backend уже был живой и выбран активным.

## Что исправлено

- Добавлена нормализация endpoint-ов для standalone backend.
- Если `secondaryPath` уже равен `/api`, фронт больше не дублирует этот префикс в Ubuntu backend вызовах.
- Исправлены прямой probe capabilities и axios-вызовы для `providers`, `provider checks`, `provider SSL cache`, `users inventory`, `status`, `resources`, `services`, `logs`.

## Что это меняет для пользователя

- В `Setup` нужно оставаться на backend `ubuntu-service`.
- `secondaryPath=/api` остаётся корректной настройкой.
- Назад на `direct` переключаться не нужно: проблема была не в выбранном режиме, а в фронтовой сборке маршрутов.

## Что проверять после обновления

```bash
clear
cd /opt/UIUbuntu/app
git pull --ff-only
chmod +x backend/scripts/install.sh
./backend/scripts/install.sh

curl -s http://127.0.0.1:18090/api/version
systemctl status ultra-ui-ubuntu-backend --no-pager
```

После этого в UI проверить экран `Хосты 3x-ui`: warning `capabilities-http-404` должен исчезнуть, а сохранение/чтение должно идти через backend без fallback-плашки.
