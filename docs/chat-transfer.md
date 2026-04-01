Prepared release: v0.6.63. The active contour stays on `ubuntu-service`; this hotfix fixes the case where `Хосты 3x-ui` stay empty even though backend `/api/providers` and SQLite already contain provider rows.
Актуальный релиз для переноса: **v0.6.63**

## Update v0.6.63

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
