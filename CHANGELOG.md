## v0.6.25 - 2026-03-31

- hardened GitHub Actions workflow diagnostics around the pre-build steps
- moved preflight diagnostics before version read so failures show working directory, file list, node and pnpm versions
- made project version read resilient and explicit via `node:fs` JSON parse
- made `Show build log on failure` safe when `build-ui.log` does not exist yet

## v0.6.24 - 2026-03-31

- added explicit pnpm bootstrap in GitHub Actions workflow before install/build
- kept verbose `vite build --debug` logging to surface real bundling errors on failure
