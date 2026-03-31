## v0.6.48
- added a new standalone Ubuntu backend in `backend/` based on FastAPI + SQLite instead of reviving the dead `/cgi-bin/api.sh` contour
- implemented real backend endpoints for `health`, `version`, `capabilities`, `status`, `providers`, `users inventory`, and `jobs`
- implemented server-side storage for `3x-ui Hosts` (`provider_hosts`) and `Users inventory` (`users_inventory`)
- added real TLS/SSL checks for provider panel URLs using Python `ssl` + `socket`, with state/history persisted in SQLite
- added scheduler groundwork, install script, dev run script, and a systemd service template for Ubuntu deployment
- updated project docs, transfer docs, change-request log, and worklog so the backend step is fully recorded

## v0.6.47
- stopped faking backend capabilities when `/api/capabilities` and `/cgi-bin/api.sh?cmd=capabilities` are absent or return errors; the UI now switches to an honest local fallback mode instead of pretending that `api.sh` is available
- `Хосты 3x-ui` now show a clear warning when the server-side backend route is unavailable and keep working from local UI data without a fake live SSL state
- `Пользователи` now show the same warning and keep working with local UI data instead of claiming that shared users DB is already connected
- provider health error now surfaces the actual backend-route failure instead of a vague `capability-missing` placeholder
- removed stale `backend:dev` / `backend:smoke` scripts that still referenced the phantom `ubuntu-service`
