# Проверка SSL-сертификатов провайдеров с роутера

Этот файл собирает команды для проверки SSL/TLS у прокси-провайдеров **именно с роутера**. Это важно, потому что роутер и ПК могут видеть разные маршруты, разные ответы балансировщика и разный TLS-контекст.

## Когда это полезно

Используй эти команды, если в UI:
- у провайдера отображается старая дата сертификата;
- дата сертификата пустая;
- есть подозрение на разные сертификаты у `panel URL` и `proxy-provider URL`;
- нужно понять, проблема на сервере провайдера или в кэше `router-agent`.

---

## 1. Быстро посмотреть сертификат, который реально видит роутер

Показывает `subject`, `issuer`, даты действия и SHA256 fingerprint.

```bash
IP="87.121.82.34"
PORT="15905"

OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

echo "=== REMOTE CERT FROM ROUTER ==="
echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" -showcerts 2>/dev/null \
| "$OPENSSL_BIN" x509 -noout -subject -issuer -dates -fingerprint -sha256
```

Смотри в выводе на:
- `issuer`
- `notBefore`
- `notAfter`
- `sha256 Fingerprint`

---

## 2. Посмотреть оба TLS-адреса провайдера сразу

У одного провайдера могут быть разные порты для:
- `panel URL`
- `proxy-provider URL`

Команда проверяет оба порта подряд.

```bash
IP="87.121.82.34"
OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

for PORT in 15905 59631; do
  echo "=== ${IP}:${PORT} ==="
  echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" -showcerts 2>/dev/null \
  | "$OPENSSL_BIN" x509 -noout -subject -issuer -dates -fingerprint -sha256
  echo
done
```

Если на обоих портах fingerprint и даты совпадают — сертификат реально один и тот же.
Если различаются — UI мог показывать данные только по одному из TLS-источников.

---

## 3. Посмотреть подробный TLS-диалог

Полезно, если нужно увидеть handshake, verify state и ошибки проверки.

```bash
IP="87.121.82.34"
PORT="15905"
OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" -brief -state
```

Более подробный вариант:

```bash
IP="87.121.82.34"
PORT="15905"
OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" -showcerts
```

---

## 4. Сохранить сертификат в файл и разобрать отдельно

Если нужно внимательно рассмотреть сертификат, SAN и другие поля.

```bash
IP="87.121.82.34"
PORT="15905"
TMP_CERT="/tmp/provider-cert.pem"
OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" -showcerts 2>/dev/null \
| sed -n '/-----BEGIN CERTIFICATE-----/,/-----END CERTIFICATE-----/p' \
> "$TMP_CERT"

echo "=== saved to $TMP_CERT ==="
"$OPENSSL_BIN" x509 -in "$TMP_CERT" -noout -subject -issuer -dates -fingerprint -sha256 -text | sed -n '1,40p'
```

---

## 5. Проверить SAN / Subject Alternative Name

Удобно, если нужно понять, на что именно выписан сертификат и есть ли нужный IP/DNS в SAN.

```bash
IP="87.121.82.34"
PORT="15905"
OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" 2>/dev/null \
| "$OPENSSL_BIN" x509 -noout -text | grep -A2 "Subject Alternative Name"
```

---

## 6. Проверить несколько раз подряд

Если есть подозрение на балансировщик, разные backend-узлы или неполное обновление сертификатов.

```bash
IP="87.121.82.34"
PORT="15905"
OPENSSL_BIN="$(command -v openssl || echo /opt/bin/openssl)"

for i in 1 2 3 4 5; do
  echo "=== try $i ==="
  echo | "$OPENSSL_BIN" s_client -connect "${IP}:${PORT}" 2>/dev/null \
  | "$OPENSSL_BIN" x509 -noout -fingerprint -sha256 -subject -issuer -dates
  sleep 2
  echo
done
```

Если fingerprint прыгает между попытками, это уже очень похоже на:
- разные backend-сертификаты;
- неполное обновление у провайдера;
- промежуточный TLS-proxy / балансировщик.

---

## 7. Проверить через curl, как TLS выглядит при реальном HTTPS-запросе

Это полезно для panel URL и subscription URL.

```bash
URL="https://87.121.82.34:15905/cQ3dZvmUEQSRxBxdbc"

curl -vkI "$URL" 2>&1 | sed -n '/Server certificate:/,/SSL certificate verify/p'
```

Если `curl` на роутере бедный по выводу, можно так:

```bash
URL="https://87.121.82.34:15905/cQ3dZvmUEQSRxBxdbc"

curl -vk "$URL" -o /dev/null 2>&1 | sed -n '1,80p'
```

---

## 8. Посмотреть, что сейчас держит `router-agent` в SSL-кэше провайдеров

Это нужно, если сервер уже показывает новый сертификат, а UI всё ещё рисует старую дату.

```bash
echo '=== ssl cache ts ==='
cat /opt/zash-agent/var/mihomo-providers-ssl-cache.ts 2>/dev/null || echo 'no ts'

echo
echo '=== ssl cache file ==='
cat /opt/zash-agent/var/mihomo-providers-ssl-cache.tsv 2>/dev/null || echo 'no cache'
```

Что здесь смотреть:
- timestamp в `mihomo-providers-ssl-cache.ts`
- даты в `mihomo-providers-ssl-cache.tsv`

Если прямой `openssl` уже видит новый cert, а `tsv` всё ещё старый — проблема не на сервере, а в кэше `router-agent`.

---

## 9. Посмотреть, что реально отдаёт API `mihomo_providers`

Это именно тот слой, который использует UI.

```bash
WGET_BIN="$(command -v wget || echo /opt/bin/wget)"

"$WGET_BIN" -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=mihomo_providers" \
| sed 's/},{/},\
{/g'
```

Полезные поля:
- `sslNotAfter`
- `panelSslNotAfter`
- `sslCacheReady`
- `sslCacheFresh`
- `sslRefreshing`
- `sslRefreshPending`

---

## 10. Принудительно пересобрать SSL-кэш провайдеров

Используй это, если в кэше зависла старая дата или после очистки нужно заново прогреть значения.

### Вариант через API router-agent

```bash
WGET_BIN="$(command -v wget || echo /opt/bin/wget)"

"$WGET_BIN" -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=ssl_cache_refresh"
```

### Ручной вариант через удаление файлов кэша

```bash
rm -f /opt/zash-agent/var/mihomo-providers-ssl-cache.ts
rm -f /opt/zash-agent/var/mihomo-providers-ssl-cache.tsv

/opt/etc/init.d/S99zash-agent restart
sleep 3
```

После этого удобно один-два раза прогреть список провайдеров:

```bash
WGET_BIN="$(command -v wget || echo /opt/bin/wget)"

for i in 1 2 3; do
  echo "--- pass $i ---"
  "$WGET_BIN" -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=mihomo_providers" | sed 's/},{/},\
{/g'
  sleep 2
done
```

Пояснение:
- сразу после очистки UI может временно показать пустые даты SSL;
- это нормальное переходное состояние, пока `router-agent` заново собирает кэш;
- после завершения refresh даты должны появиться снова.

---

## 11. Практическая последовательность проверки, если UI показывает “старый сертификат”

1. Сначала проверить реальный сертификат с роутера через `openssl`.
2. Потом проверить оба порта провайдера (`panel URL` и `proxy-provider URL`).
3. Затем посмотреть `mihomo-providers-ssl-cache.tsv`.
4. Потом посмотреть ответ `cmd=mihomo_providers`.
5. Если `openssl` уже видит новый cert, а API/UI ещё старый — пересобрать SSL-кэш.

---

## 12. Важный нюанс про URL по IP

Если provider URL использует **IP-адрес**, а не доменное имя:

- SNI по имени хоста здесь нет;
- сервер может отдавать дефолтный сертификат для этого `IP:PORT`;
- при балансировщике или неполном обновлении cert может отличаться между backend-узлами.

Пример такого URL:

```text
https://87.121.82.34:15905/...
```

---

## 13. Диагностика по типовым сценариям

### Сценарий A
`openssl` и `mihomo_providers` показывают одинаковую свежую дату.

Значит всё нормально, UI должен отображать актуальные данные.

### Сценарий B
`openssl` показывает новый cert, а `mihomo_providers` — старый.

С высокой вероятностью завис SSL-кэш `router-agent`.

### Сценарий C
`panel URL` и `proxy-provider URL` показывают разные даты / fingerprint.

Значит проблема уже на стороне TLS-источников провайдера, а не в UI.

### Сценарий D
После очистки кэша UI временно показывает пусто.

Это нормальный переходный этап, пока `router-agent` пересобирает SSL-кэш асинхронно.


### Важно

Начиная с `router-agent 0.5.65` ручной `ssl_cache_refresh` больше **не удаляет** текущий кэш перед обновлением. Старые значения остаются видимыми, пока новые даты тихо пересобираются в фоне.

---

## 14. Проверить фоновой refresh SSL-кэша и cron-задание

Начиная с `router-agent 0.5.65` для SSL-кэша по умолчанию ставится фоновый refresh раз в **6 часов**. Проверить можно так:

```bash
echo '=== zash ssl cron ==='
grep 'zash-ssl-cache-refresh' /opt/etc/crontabs/root /opt/var/spool/cron/crontabs/root /etc/crontabs/root /var/spool/cron/crontabs/root 2>/dev/null || echo 'cron entry not found'

echo
echo '=== next refresh hint from API ==='
WGET_BIN="$(command -v wget || echo /opt/bin/wget)"
"$WGET_BIN" -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=mihomo_providers" | sed 's/},{/},\
{/g'
```

Что смотреть:
- наличие строки `zash-ssl-cache-refresh` в cron;
- поле `sslCacheNextRefreshAtSec` в ответе `mihomo_providers`;
- поле `nextRefreshAtSec` в ответе `ssl_cache_refresh`.

---

## 15. Если нужно прямо сейчас мягко обновить SSL-кэш без очистки

```bash
WGET_BIN="$(command -v wget || echo /opt/bin/wget)"
"$WGET_BIN" -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=ssl_cache_refresh"

sleep 2

"$WGET_BIN" -qO- "http://192.168.0.1:9099/cgi-bin/api.sh?cmd=mihomo_providers" | sed 's/},{/},\
{/g'
```

Это запускает пересборку в фоне, но не делает UI пустым на время refresh.
