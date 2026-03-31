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
