## v0.6.36
- kept the v0.6.35 build fix in place: stale transpiled `src/**/*.js` and `src/**/*.d.ts` no longer shadow the real TypeScript / TSX sources;
- returned provider SSL checks to a visible workspace on the **Providers** page;
- persist provider SSL snapshot, cache timestamps and refresh state in the shared users DB;
- added LAN users inventory with `IP / MAC / hostname / source / proxyAccess` fields stored in DB;
- added proxy access policy `allow all` / `allow-list only`;
- restrict denied clients only on Mihomo proxy ports instead of dropping all host traffic;
- extended the bundled agent with `blockipports` / `unblockipports` plus persisted rehydrate support;
- bumped bundled agent version to `0.6.23` in `api.sh` and `router-agent/install.sh`.

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
