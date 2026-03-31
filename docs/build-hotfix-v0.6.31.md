# Build hotfix v0.6.31

- Replaced `.github/workflows/build-ui.yml` with a simplified workflow provided after inspecting the live failing file from the repository.
- `pnpm install` now writes to `install-deps.log` and prints that log inline on failure and on success.
- `pnpm exec vite build --debug` now writes to `build-ui.log` and prints that log inline on failure and on success.
- Removed the `Check lockfile drift` step from CI to stop masking the first real install/build error.
- Kept explicit `pnpm` bootstrap and an informational `pnpm type-check` step.
