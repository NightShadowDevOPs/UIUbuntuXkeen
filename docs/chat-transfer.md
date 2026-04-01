Prepared release: v0.6.68. The active contour stays on `ubuntu-service`; this hotfix adds short retries for transient Mihomo controller startup races, so `/api/providers/proxies` stops throwing false 502 right after `mihomo` restart.
Актуальный релиз для переноса: **v0.6.68**

## Update v0.6.68
- backend bridge retries transient `Connection refused` / timeout errors against the live Mihomo controller before returning 502
- retry diagnostics are preserved in the 502 payload for easier troubleshooting
- previous controller-resolution hardening from v0.6.67 stays in place
