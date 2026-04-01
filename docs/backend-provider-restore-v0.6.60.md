# v0.6.60 — provider restore and legacy status bridge

## What changed
- Restored `3x-ui Hosts` persistence for `ubuntu-service` when backend `/api/providers` comes back empty but the browser/users-db fallback still contains known provider panel URLs.
- Hardened backend provider replacement so an accidental empty save does not wipe an existing server-side provider list.
- Added backend self-healing: `provider_hosts` can be rebuilt from persisted SSL state/history if the main provider table is empty.
- Bridged `agentStatusAPI()` to `/api/status` while `ubuntu-service` is active, so old pages stop treating `:9099/cgi-bin/api.sh?cmd=status` as their primary status route.

## Why this release exists
Live testing showed two separate problems:
1. backend `/api/providers` returned an empty list, so `3x-ui Hosts` disappeared and SSL checks had `resultCount: 0`;
2. some pages still polled the dead direct status route on port `9099`, which added noise and stale offline signals.

## Expected result after deploy
- `3x-ui Hosts` should repopulate from local/browser/users-db fallback into backend storage automatically on first load if backend list is empty;
- subsequent `GET /api/providers` should return real rows instead of `[]`;
- UI pages that rely on `agentStatusAPI()` should use `/api/status` while `ubuntu-service` is active and stop spamming the dead direct status CGI route as their main probe.
