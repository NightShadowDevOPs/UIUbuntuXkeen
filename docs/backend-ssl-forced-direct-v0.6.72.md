# v0.6.72 — provider SSL forced DIRECT route

- backend provider SSL probe now supports `forced-direct`: the checker binds TLS probes to the detected default outbound interface/source IP instead of blindly following the host's current tunnel/transparent route.
- install/update writes `ULTRA_UI_SSL_PROBE_ROUTE_MODE=forced-direct` plus detected `ULTRA_UI_SSL_PROBE_DIRECT_INTERFACE` and `ULTRA_UI_SSL_PROBE_DIRECT_SOURCE_IP` into `/etc/ultra-ui-ubuntu/agent.env` when available.
- Xui Hosts and the provider SSL workspace now show the active probe route (`forced DIRECT`, interface, source IP) and use high-contrast status pills in dark theme.
