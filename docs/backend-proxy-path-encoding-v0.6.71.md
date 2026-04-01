# v0.6.71 — backend proxy path encoding hotfix

## Problem
`ubuntu-service` proxied decoded FastAPI path params directly into `urllib`. Names with spaces / Cyrillic / emoji (for example `Остальной трафик`) produced upstream URLs such as `/proxies/Остальной трафик`, which raised `http.client.InvalidURL` instead of reaching Mihomo.

## Fix
- added segment-wise percent-encoding for upstream Mihomo paths
- reused the helper for both HTTP and WebSocket upstream URL builders

## Result
Proxy/group/rule actions with non-ASCII names no longer crash the standalone backend contour with `InvalidURL`.
