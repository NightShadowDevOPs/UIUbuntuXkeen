- v0.6.69: provider TLS probe now retries SNI / no-SNI / TLS 1.2 fallback paths and dark-theme SSL pills are readable again.
- v0.6.68: ubuntu-service Mihomo bridge now retries transient post-restart controller connect failures, reducing false 502 on `/api/providers/proxies`.
# Current status — v0.6.69

## Focus now
- stabilize Ubuntu-host Mihomo controller bridge after restarts
- keep provider SSL checks and 3x-ui host list stable
- polish dark-theme status badges after backend bridge stops flapping

## Update v0.6.69
- bridge retries transient connect-refused/timeouts before failing the request
- diagnostics still include all attempts if the controller remains unavailable
