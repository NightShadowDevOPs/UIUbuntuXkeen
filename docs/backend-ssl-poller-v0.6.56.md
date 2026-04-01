# v0.6.56 — Provider SSL poller defaults and certificate details

Что изменено
- warning threshold по умолчанию закреплён как 2 дня (`ULTRA_UI_SSL_WARN_DAYS=2`);
- backend scheduler больше не ждёт только TTL: если для provider host нет SSL state или panel URL изменился, SSL-проверка считается обязательной;
- после сохранения `Хосты 3x-ui` UI сразу инициирует refresh SSL-кеша;
- SSL probe теперь старается дочитать сертификат даже после failed verified handshake, чтобы получить даты/issuer/fingerprint и отдельно сохранить verification diagnostics.

Что это даёт
- короткоживущие IP-сертификаты на 6 дней попадают в warning вовремя, а не за неделю;
- после добавления/обновления host информация о сертификате появляется сразу, а не через несколько часов;
- при expired сертификате backend всё равно может показать дату окончания и fingerprint, а не только абстрактную TLS-ошибку.

Server defaults
- `ULTRA_UI_SSL_CHECK_INTERVAL_SECS=14400`
- `ULTRA_UI_SSL_WARN_DAYS=2`

Проверка после релиза
1. Сохранить `Хосты 3x-ui`.
2. Убедиться, что сразу пошёл refresh SSL state.
3. Открыть `Детали` и проверить наличие `valid from`, `expires at`, `issuer`, `subject`, `SAN`, `fingerprint`, `verify diagnostics`.
4. Для сертификата с остатком <= 2 дней увидеть warning, для expired — `Просрочен`.
