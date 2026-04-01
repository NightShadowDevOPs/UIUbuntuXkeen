# v0.6.58 — provider SSL action routing hotfix

This hotfix fixes the frontend REST routing for provider SSL actions on `ubuntu-service`. The UI now targets the full standalone backend origin instead of relative Mihomo UI `/api/...` paths, and `Хосты 3x-ui` forces a fresh capability probe on mount to avoid stale `capability-missing` state.
