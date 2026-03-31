## v0.6.47
- stopped faking backend capabilities when `/api/capabilities` and `/cgi-bin/api.sh?cmd=capabilities` are absent or return errors; the UI now switches to an honest local fallback mode instead of pretending that `api.sh` is available
- `Хосты 3x-ui` now show a clear warning when the server-side backend route is unavailable and keep working from local UI data without a fake live SSL state
- `Пользователи` now show the same warning and keep working with local UI data instead of claiming that shared users DB is already connected
- provider health error now surfaces the actual backend-route failure instead of a vague `capability-missing` placeholder
- removed stale `backend:dev` / `backend:smoke` scripts that still referenced the phantom `ubuntu-service`

## v0.6.46
- fixed the 3x-ui Hosts bridge: the page now merges real Mihomo provider names with saved panel URLs, so hosts are visible even when the shared DB map is still empty and panel URLs already exist in Proxy Providers.
