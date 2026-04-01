# v0.6.57 — provider SSL actions hotfix

## What was fixed
- `Проверить сейчас` and `Обновить SSL-кэш` no longer rely on a single long blocking HTTP request for all 3x-ui hosts.
- Backend now starts provider SSL checks in the background and returns the current refresh/job state immediately.
- Frontend polls provider check state until the backend refresh job settles, then reloads rows and SSL details/history.
- Capability gating for `ubuntu-service` was relaxed so the active standalone backend does not block the SSL buttons with a false `capability-missing`.

## Why it mattered
Short-lived ACME/IP certificates in this project live for 6 days, and the default warning threshold is 2 days. A non-working SSL action flow defeats the whole point of this screen.
