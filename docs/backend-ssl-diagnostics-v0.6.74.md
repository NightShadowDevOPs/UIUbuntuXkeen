# v0.6.74 — provider SSL diagnostics UI polish

## What changed
- improved dark-theme readability for provider SSL status pills on `Хосты 3x-ui` and the provider SSL workspace;
- clarified that provider SSL checks use the current Ubuntu host server-side route and do not depend on the user-selected proxy-group;
- when current checks time out but a previous successful certificate exists, the UI now keeps that successful snapshot visible and explains that the timeout may be specific to the current host/network path;
- added compact route/context hints (host / iface / src when available) to SSL status views.

## Why
vm03 can read some provider certificates and time out on others. That means the UI must stop presenting every timeout like a broken certificate and instead show that the current host route may be the limiting factor.
