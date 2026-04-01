# v0.6.67 — Mihomo controller fallback hardening

## Problem
The standalone Ubuntu backend could still return `502` on `/api/providers/proxies` after v0.6.66 because `load_mihomo_controller()` treated `MIHOMO_CONTROLLER_URL` from `agent.env` as authoritative. If a stale loopback value such as `http://127.0.0.1:9090` remained in env while Mihomo actually listened on `192.168.5.23:9090`, bridge requests still hit the dead loopback controller and failed with `ConnectionRefusedError`.

## Changes
- controller discovery now reads both the env-pinned URL and the current `external-controller` from `/etc/mihomo/config.yaml`;
- when env still points at loopback but config points at a non-loopback host bind, the config controller becomes the primary candidate;
- proxy HTTP requests retry across controller candidates before returning `502`;
- failed bridge payloads now include all attempted controller URLs/errors;
- install helper parsing for `MIHOMO_ACTIVE_CONFIG` now uses env-style `KEY=VALUE` parsing instead of YAML parsing.

## Expected result
- `/api/providers/proxies` and related ubuntu-service bridge routes stop depending on a single stale controller URL;
- smoke checks show which candidate controller URL failed and which one succeeded;
- future controller bind changes are less brittle during install/update cycles.
