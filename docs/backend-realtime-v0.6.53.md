# v0.6.53 — realtime telemetry on ubuntu-service

## Why this release exists
After the live switch to `ubuntu-service`, the UI lost realtime charts because it tried to open WebSocket routes (`/api/traffic`, `/api/memory`, `/api/connections`, `/api/logs`) that the standalone backend did not implement yet.

## What changed
- Added WebSocket endpoints for `traffic`, `memory`, `connections`, and `logs`.
- Added compatibility aliases for direct and doubled `/api` path variants.
- Added lightweight host telemetry sampling:
  - memory from `/proc/meminfo`;
  - aggregate traffic from `/proc/net/dev`;
  - best-effort active socket snapshot via `ss -tunH`.
- Exposed `connections` and `logs` in backend capabilities.

## Operational note
The backend still runs as `ultra-ui-ubuntu-backend.service` and should remain selected in Setup as `ubuntu-service`. This release does not change the architecture; it only fills the missing realtime contour for the existing backend.
