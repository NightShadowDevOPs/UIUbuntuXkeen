# v0.6.62 — XUI hosts backend-first hydration hotfix

## Problem
`Хосты 3x-ui` could still render an empty list on `ubuntu-service` even when backend `/api/providers` was healthy.

The frontend called users-db fallback loading first:
- `agentUsersDbGetAPI()` / `users_db_get`;
- merged fallback rows;
- only after that tried backend `/api/providers`.

If router-agent CGI was unavailable, fallback loading threw and provider hydration aborted before the real backend request.

## Fix
- make users-db fallback safe (`safeListProvidersFromUsersDb()`);
- for `ubuntu-service`, call backend `/api/providers` first;
- treat users-db/local fallback rows as best-effort merge/reseed sources, not as a hard prerequisite.

## Expected result
- a healthy standalone backend can render saved 3x-ui hosts even when router-agent fallback is down;
- page hydration no longer depends on `users_db_get` availability;
- backend provider storage remains the source of truth.
