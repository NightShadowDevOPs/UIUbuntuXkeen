# v0.6.69 — provider TLS probe hardening and dark-theme status pills

- Probe now tries verified TLS, insecure TLS with SNI, insecure TLS without SNI, and TLS 1.2 fallback variants before returning a timeout.
- Raw SSL payload stores all attempts for later diagnostics.
- Xui Hosts and provider SSL workspace use readable custom pills on dark theme.
