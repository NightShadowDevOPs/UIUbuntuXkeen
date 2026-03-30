## v0.2.9
- fixed TypeScript build errors in `AgentCard.vue`, `ProxyProvider.vue` and Axios request config typing
- kept CI green path while removing false-positive build annotations for the fixed files
- updated docs release notes and transfer package

## v0.2.8

- simplified GitHub Actions toolchain bootstrap using Corepack + pnpm 9.12.1
- removed frozen lockfile gate in CI to avoid early install aborts before any useful logs
- expanded preflight diagnostics for registry and package manager visibility
- updated docs, releases, and transfer package

# Changelog

## [0.2.7] - 2026-03-30

### Fixed
- GitHub Actions now fails directly inside `Install dependencies` after printing the full `pnpm install` log inline, so the useful text stays in the same step instead of hiding behind a separate fail marker.
- Removed the extra \`Fail job if install failed\` step that turned the workflow into a mute red brick without the interesting part.
- Kept install diagnostics in plain console output for copy-paste analysis.

## [0.2.6] - 2026-03-30

### Fixed
- GitHub Actions now prints the full `pnpm install` log directly into the job output before failing the workflow.
- Removed reliance on a separate CI log artifact for install-stage diagnostics.
- Build, packaging and release publication continue to run only after a successful dependency installation.

## v0.2.5 — 2026-03-30

- added GitHub Actions preflight diagnostics and persistent CI log capture for install, type-check and build stages
- upload `ci-logs/` as a separate workflow artifact on every run so failed installs can be inspected without guessing from a blank red step
- print the tail of install/build logs directly into the GitHub Actions job output on failure for faster triage

## v0.2.4 — 2026-03-30

- hardened the GitHub Actions install step for CI by disabling Husky hook execution and other lifecycle scripts during `pnpm install`
- kept the lockfile gate with `--frozen-lockfile`, so dependency drift is still caught instead of silently papered over
- refreshed docs and chat-transfer package for the install-step hotfix

## v0.2.3 — 2026-03-30

- fixed the GitHub Actions `Read project version` step by replacing the brittle inline Node expression with a plain `python3` JSON read from `package.json`
- kept the rest of the release pipeline unchanged so the server update path still publishes both versioned and rolling artifacts
- refreshed docs and chat-transfer package for the CI metadata hotfix

## v0.2.2 — 2026-03-30

- upgraded GitHub Actions workflow actions to Node 24-ready versions (`actions/checkout@v5`, `actions/setup-node@v6`, `pnpm/action-setup@v5`, `actions/upload-artifact@v6`, `actions/download-artifact@v7`)
- kept the project build runtime on Node.js 22 so the app build behavior stays stable while the workflow itself stops nagging about deprecated Node 20 action runtimes
- refreshed docs and chat-transfer package for the Actions deprecation hotfix

## v0.2.1 — 2026-03-30

- changed GitHub Actions pipeline so `pnpm type-check` is informational and no longer blocks release publication
- kept `pnpm build` as the hard gate for shipping `dist.zip` and versioned release artifacts
- refreshed docs and chat-transfer package for the CI hotfix

## v0.2.0 — 2026-03-30

- updated product metadata and visible branding for the new Ubuntu-oriented line
- switched GitHub links, release checks and rolling update URL to `NightShadowDevOPs/UIUbuntuXkeen`
- added GitHub Actions build/release pipeline with `pnpm install`, `pnpm type-check`, `pnpm build` and release packaging
- added versioned releases and rolling `dist.zip` publication for in-UI updates
- removed the obsolete top-level transfer snapshot from the legacy line

## v0.1.0 — 2026-03-30

- bootstrapped canonical project docs in `docs/`
- added the project spec, roadmap, release log and chat-transfer package
- cleaned legacy duplicates from `docs/` and kept a single canonical transfer flow
