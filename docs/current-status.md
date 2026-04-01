Current release: `v0.6.74`

- v0.6.74: polished provider SSL diagnostics UI for the current `ubuntu-service` contour. SSL status views now clearly show that checks run via the current Ubuntu host route, preserve the last successful certificate snapshot on current timeouts, and use readable dark-theme status pills.
- v0.6.73: provider SSL probe default rolled back to `system-route` after blanket TLS timeouts with the previous forced-direct default.

# Current status — v0.6.74

## Live contour
- Active backend contour: `ubuntu-service`
- Backend service remains the source of truth for provider SSL checks and 3x-ui host state.
- Mihomo bridge stays enabled for provider/proxy/runtime endpoints.

## Current provider SSL reality
- part of the panel endpoints answer normally from vm03;
- part of the panel endpoints still return `TLS handshake timeout` from vm03 while working from another server;
- this points to a route/source-IP specific issue on the current host path, not a universal certificate failure.

## Update v0.6.74
- improved dark-theme readability for provider SSL status pills in `Хосты 3x-ui` and the provider SSL workspace;
- status cards now explicitly explain that checks run via the current Ubuntu host server-side route and do not use the UI-selected proxy-group;
- current timeout states now keep and highlight the last successful certificate snapshot when it exists.
