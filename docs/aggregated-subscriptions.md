# Aggregated subscriptions

UltraUIXkeen can build one client-facing subscription from multiple proxy providers.

Important:
- the router **only serves the subscription URL**;
- the client app connects **directly to provider servers**;
- router-agent must be enabled and reachable from the client device;
- for V2RayTun 5.20.67 the current local `http://.../cgi-bin/api.sh?...` path is **not treated as a finished import channel**.

## Supported outputs

### 1) Mihomo / Clash YAML

Endpoint:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=mihomo
```

What it does:
- generates `proxy-providers` from current Mihomo `proxy-providers` in `config.yaml`;
- emits an explicit `proxy-groups:` section;
- adds ready-made groups:
  - `Manual`
  - `Auto`
  - `Failover`
  - `Balance`
- final `MATCH` rule points to the generated top-level group.

Good for:
- Mihomo
- Clash family clients
- clients that understand remote YAML configs with provider URLs

### 2) Universal V2Ray / Xray subscription

Endpoint:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=b64
```

What it does:
- downloads provider subscription payloads;
- tries to normalize Base64 / plain text share-link payloads;
- merges and deduplicates links;
- returns a Base64 subscription body.

Plain text variant:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=plain
```

Good for:
- v2rayNG
- Hiddify
- other apps that import a subscription URL or share-link list

### 3) V2RayTun experimental local import

Endpoint:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=v2raytun
```

What it does right now:
- merges and deduplicates upstream share links like the plain/base64 export;
- keeps V2RayTun metadata in normal HTTP headers (`profile-title`, `profile-update-interval`, `update-always`);
- duplicates the same metadata inside the body as `#profile-title`, `#profile-update-interval`, `#update-always`, because V2RayTun documents support for body headers too;
- is now exposed again in the UI as a separate local/published URL plus a `v2raytun://import/...` deeplink and QR mode for live LAN testing.

What it is **not** yet:
- not a claim that outside-home auto-update is solved;
- not a replacement for the future normal HTTPS endpoint;
- not yet promoted from experimental local import to finished V2RayTun support.

### 4) JSON preview endpoint (groundwork)

Endpoint:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=json
```

What it does right now:
- returns a JSON manifest with bundle title, provider list and merged share links;
- uses `Content-Type: application/json`;
- is meant as a **preview foundation** for future HTTPS / Xray-style subscription flows.

What it is **not** yet:
- not a finished V2RayTun import endpoint;
- not a final Xray client schema;
- not a replacement for the future normal HTTPS subscription URL.

## Provider filtering

You can limit the exported bundle to specific providers:

```text
&providers=AdminVPS,Play2GoFI,CloudRU
```

Example:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=mihomo&providers=AdminVPS,CloudRU
```

## Custom bundle name

Optional query parameter:

```text
&name=My Bundle
```

Example:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=mihomo&name=Family Bundle
```

## If router-agent token is enabled

Add the token into the subscription URL:

```text
&token=<agent-token>
```

Example:

```text
http://<router-ip>:9099/cgi-bin/api.sh?cmd=subscription&format=b64&token=YOUR_TOKEN
```

## Notes / limitations

- `format=mihomo` does not proxy traffic through the router; it only builds a YAML config that points to provider URLs.
- if a client times out on a local Mihomo/Clash import while the URL itself is reachable, first check that the generated YAML still contains a top-level `proxy-groups:` section.
- `format=b64` works best when upstream provider URLs return normal V2Ray/Xray subscription payloads (Base64 or plain share links).
- if an upstream provider returns only a panel page or another non-subscription format, its links may not appear in `format=b64`.
- if `subscription` returns `{"ok":false,"error":"no-providers"}`, router-agent could not parse `proxy-providers` from the current Mihomo config.
- the project now treats V2RayTun 5.20.67 as **pending** until there is a proper HTTPS endpoint; deeplink / QR tricks on the current local HTTP path are no longer considered a finished solution.

## Deep link notes

- `Mihomo / Clash`: `clash://install-config?url=<encoded-subscription-url>`
- `v2rayNG`: `v2rayng://install-config?url=<encoded-subscription-url>&name=<encoded-name>`
- `Hiddify`: `hiddify://import/<encoded-subscription-url>#<encoded-name>`
- `V2RayTun`: `v2raytun://import/<subscription-link>`

The UI still URL-encodes subscription links before building deep links for Mihomo / Clash, v2rayNG and Hiddify. For V2RayTun the new deeplink follows the documented `v2raytun://import/{subscription_link}` pattern and uses the dedicated `format=v2raytun` URL.

## V2RayTun compatibility status

Current project status for V2RayTun 5.20.67:

- **not marked as ready** on the current local HTTP `router-agent` URL;
- the main UI now exposes a clearly marked experimental local `format=v2raytun` URL, deeplink and QR mode for live LAN testing;
- `format=v2raytun` still is **not** treated as solved import support; it is now exposed again only as an experimental local import path;
- the next real step is a normal **HTTPS subscription endpoint**, then a more specific **JSON-based client flow** if needed.


## Published HTTPS endpoint (optional)

For a normal router-only LAN setup you do **not** need this at all. Leave the publication field empty and the UI will keep building links from the local `router-agent` URL.

Use a published HTTPS base only when you really put `router-agent` behind a normal HTTPS reverse proxy, tunnel, or separate external host. In the UI this now belongs to the advanced publication settings on the `Subscriptions` page:

```text
Configure external HTTPS -> Published HTTPS base (optional) = https://sub.example.com
```

Buttons are now phrased as `Copy current URL` / `Copy current JSON URL`, so the page no longer uses the vague `best URL` wording.

When this base is set, the UI prefers it for:
- client-facing subscription URLs;
- QR codes;
- deeplinks for Clash / v2rayNG / Hiddify.

On the `Subscriptions` page the UI now also shows an explicit `Currently used` / `Сейчас используется` badge above the client actions, so it is obvious whether copy/QR/deeplink uses the local router URL or the published HTTPS URL.

### Reverse proxy notes

Best practice:
- keep the backend CGI path as `/cgi-bin/api.sh`;
- preserve the query string;
- pass `X-Forwarded-Proto`, `X-Forwarded-Host` and, if you publish under a prefix, `X-Forwarded-Prefix`.

Then `format=json` can return canonical public URLs in its `request` / `urls` fields.

### Example: Caddy

```caddy
sub.example.com {
  reverse_proxy 192.168.0.1:9099 {
    header_up X-Forwarded-Proto {scheme}
    header_up X-Forwarded-Host {host}
    header_up X-Forwarded-Prefix ""
  }
}
```

This assumes the public path is the same as on router-agent, for example:

```text
https://sub.example.com/cgi-bin/api.sh?cmd=subscription&format=b64
```

### Example: Nginx

```nginx
server {
    listen 443 ssl http2;
    server_name sub.example.com;

    location /cgi-bin/api.sh {
        proxy_pass http://192.168.0.1:9099/cgi-bin/api.sh;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-Prefix "";
    }
}
```

## JSON preview additions

When router-agent is reached through a forwarded HTTPS request, `format=json` now also includes:
- `request.publicBase`
- `request.apiUrl`
- `request.forwarded`
- `urls.mihomo`
- `urls.b64`
- `urls.plain`
- `urls.json`

This still does **not** mean V2RayTun support is declared finished; it only means the groundwork now knows about a normal published HTTPS endpoint.


## Сценарии использования

### 1. Разовый импорт дома
- открыть URL подписки или QR-код в домашней сети;
- импортировать профиль в клиент;
- после сохранения профиля клиент использует конфиг локально и может работать вне дома без доступа к роутеру;
- это не даёт автообновления подписки вне дома.

### 2. Обновляемая подписка
- если клиент должен сам обновлять подписку, ему всё равно нужен путь к `router-agent`;
- это может быть LAN, VPN домой или опубликованный HTTPS endpoint;
- без такого пути вне дома будет работать только уже сохранённый конфиг.

### Совместимость
- `Mihomo / Clash` — готово для разового импорта дома и дальнейшего использования вне дома;
- `v2rayNG / Hiddify` — подходит для URL/deeplink и разового импорта дома;
- `V2RayTun` — пока не считать готовым: текущий локальный HTTP endpoint не объявляется финальным решением.
