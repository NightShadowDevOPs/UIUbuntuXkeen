## v0.6.34
- update GitHub Actions to `actions/checkout@v5` and `actions/setup-node@v6` to remove the Node.js 20 deprecation warning
- capture `pnpm install`, `pnpm type-check` and `pnpm exec vite build --debug` logs into files, job summary and uploaded artifact `ui-build-logs`
- keep the job alive until diagnostics are printed, then fail it in a final guard step with explicit install/build exit-code reporting

## v0.6.33
- switch GitHub Actions to `pnpm/action-setup` + `actions/setup-node@v4` with pnpm cache and raw `pnpm build --debug` output
- remove `flag-icons`/`import.meta.glob('/node_modules/...')` from provider badges and render country flags through emoji fonts already shipped with the UI
- keep SSL certificate checks untouched

## v0.6.32
- actually replace `.github/workflows/build-ui.yml` with the simplified inline-log workflow
- remove stale `Check lockfile drift` / preflight-heavy workflow content that remained in the previous archive
- keep inline `install-deps.log` and `build-ui.log` printing so GitHub Actions can finally show the first real build failure

## v0.6.32

- replaced the GitHub Actions `build-ui.yml` with a simplified workflow that prints `install-deps.log` and `build-ui.log` inline on failure
- removed the noisy lockfile drift step from CI so the first real install/build error is visible
- kept explicit pnpm bootstrap and informational type-check before the final Vite build

## v0.6.30
- Fixed YAML syntax in `.github/workflows/build-ui.yml` after the broken `Check lockfile drift` step in v0.6.29.
- Rewrote the workflow block with valid multiline shell commands so GitHub Actions can parse and run the file again.
- Kept the CI diagnostics and pnpm bootstrap path from the previous hotfixes.

## v0.6.29

- simplify GitHub Actions install/build steps so raw pnpm/vite errors print directly to the job log
- switch CI dependency bootstrap to `pnpm install --no-frozen-lockfile` to get past package/lock drift
- add explicit lockfile drift diagnostics before install
- keep Husky disabled in CI

## v0.6.28

- harden GitHub Actions dependency installation step with inline failure log output
- disable Husky during CI install to avoid non-build bootstrap noise
- keep workflow diagnostics focused on the first real install/build failure

## v0.6.27 - 2026-03-31

- replaced `pnpm/action-setup` with explicit `npm install -g pnpm@9.12.1` in GitHub Actions
- removed the deprecated Node 20 based pnpm action from the workflow path
- made `Build UI` print `build-ui.log` inside the same failing step so the primary Vite error is visible immediately
- kept preflight diagnostics and resilient project version read before install/build

## v0.6.25 - 2026-03-31

- hardened GitHub Actions workflow diagnostics around the pre-build steps
- moved preflight diagnostics before version read so failures show working directory, file list, node and pnpm versions
- made project version read resilient and explicit via `node:fs` JSON parse
- made `Show build log on failure` safe when `build-ui.log` does not exist yet

## v0.6.24 - 2026-03-31

- added explicit pnpm bootstrap in GitHub Actions workflow before install/build
- kept verbose `vite build --debug` logging to surface real bundling errors on failure
