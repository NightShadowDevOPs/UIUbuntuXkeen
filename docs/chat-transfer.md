Prepared release: v0.6.65. The active contour stays on `ubuntu-service`; this hotfix restores missing provider action passthrough routes, keeps the latest successful certificate visible after timeout-heavy TLS checks, and improves dark-theme TLS badges on `Хосты 3x-ui`.
Актуальный релиз для переноса: **v0.6.65**

## Update v0.6.65
- added missing ubuntu-service passthrough routes for provider update/health-check and nested proxy delay actions.
- provider SSL payload now carries the last successful certificate snapshot separately from the latest failed attempt.
- `Хосты 3x-ui` now uses short outlined TLS badges and shows a dedicated "Последний успешный сертификат" block in details.

- Latest hotfix: v0.6.64 fixes provider panel URL loss after restart/users-db sync and auto-upgrades stale backend profiles to ubuntu-service when host path clearly points to /api.
Prepared release: v0.6.64. The active contour stays on `ubuntu-service`; this hotfix fixes the case where `Хосты 3x-ui` stay empty even though backend `/api/providers` and SQLite already contain provider rows.
Актуальный релиз для переноса: **v0.6.64**

## Update v0.6.64

- Provider inventory on the `Хосты 3x-ui` page now has a same-origin fallback to `/api/providers`.
- SSL actions and history on the same page also try same-origin `/api/*` provider endpoints.
- The page no longer refuses backend loading only because the saved frontend backend profile is still marked as compatibility bridge.

## Quick verification

```bash
clear
curl -s http://127.0.0.1:18090/api/version
echo
curl -s http://127.0.0.1:18090/api/providers
echo
```

Then open the UI and hard-refresh the `Хосты 3x-ui` page once after update so the new bundle replaces the cached one.
