Latest hotfix: `v0.6.74` polished provider SSL diagnostics for the `ubuntu-service` contour.
Prepared release: v0.6.74. The active contour remains `ubuntu-service`; the hotfix improves dark-theme readability for SSL status cards, keeps the last successful certificate snapshot visible on current TLS timeouts, and explicitly marks checks as server-side route checks from the current Ubuntu host.
Актуальный релиз для переноса: **v0.6.74**

## Update v0.6.74
- softened and cleaned SSL status pills in `Хосты 3x-ui` and provider SSL workspace for dark theme
- current TLS timeouts now keep the last successful certificate snapshot visible instead of looking like the certificate never worked
- SSL hints now explicitly say that the check runs via the current Ubuntu host route and does not depend on the user-selected proxy-group

## Context
- current backend contour: `ubuntu-service`
- provider SSL checks run server-side from vm03 and some endpoints still time out only from that host while succeeding from another server
- keep `system-route` as the default probe mode; do not re-enable forced-direct as default
