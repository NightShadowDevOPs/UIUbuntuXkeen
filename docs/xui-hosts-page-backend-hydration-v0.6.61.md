# v0.6.61 — XUI hosts page backend hydration fix

## Problem
Backend `/api/providers` returned saved 3x-ui hosts and SQLite `provider_hosts` contained rows, but the `Хосты 3x-ui` screen still rendered an empty table. Network logs showed the page was not issuing `GET /api/providers` during the broken state.

## Fix
- force `XuiHostsPage` to reload provider rows directly from `fetchUbuntuProvidersAPI()` for `ubuntu-service`;
- add extra reload triggers when the active backend changes and when backend capabilities refresh;
- on mount, fetch provider rows before and after runtime refresh to avoid stale empty local fallback state winning over backend storage.

## Result
When `provider_hosts` already contains saved rows, the page should render them directly from backend storage instead of showing an empty list.
