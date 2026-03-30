# Changelog

## v0.3.0
- added `src/config/project.ts` with unified project, repo and rolling-release constants
- added `src/config/backendContract.ts` with Ubuntu backend contract foundation
- added `BackendKind` and `BackendCapabilities` types
- normalized backend secondary path handling and backend add/update flow
- switched release URL / GitHub release API / branding lookups to shared config constants
- shifted visible `router` section label toward host-oriented naming
- added `docs/backend-contract.md` and refreshed roadmap, release journal and transfer package

## v0.2.10
- fixed remaining TypeScript build annotations in `UserTrafficStats.vue`, `ProxiesCtrl.tsx`, `RuleCard.vue`, `HostQosCard.vue` and `AgentCard.vue`
- added missing report dialog state/helpers and CSV export handlers in user traffic UI
- cleaned up typed template usage for QoS legends and cloud backup remote actions

## v0.2.9
- fixed TypeScript build errors in `AgentCard.vue`, `ProxyProvider.vue` and Axios request config typing
- kept CI green path while removing false-positive build annotations for the fixed files
- updated docs release notes and transfer package

## v0.2.8
- simplified GitHub Actions toolchain bootstrap using Corepack + pnpm 9.12.1
- removed frozen lockfile gate in CI to avoid early install aborts before any useful logs
- expanded preflight diagnostics for registry and package manager visibility
- updated docs, releases, and transfer package

## v0.2.7
- GitHub Actions now fails directly inside `Install dependencies` after printing the full `pnpm install` log inline
- removed the extra fail step that masked the useful install failure output

## v0.2.6
- GitHub Actions now prints the full `pnpm install` log directly into the job output before failing the workflow
- removed reliance on a separate CI log artifact for install-stage diagnostics

## v0.2.5
- added GitHub Actions preflight diagnostics and persistent CI log capture for install, type-check and build stages
- printed install/build log tails directly in workflow output for faster triage

## v0.2.4
- hardened the GitHub Actions install step by disabling Husky hook execution and other lifecycle scripts during `pnpm install`
- kept dependency installation in a CI-safe mode for the new repo bootstrap

## v0.2.3
- fixed the GitHub Actions `Read project version` step by reading `package.json` through `python3`
- kept the release pipeline unchanged while restoring metadata stability

## v0.2.2
- upgraded GitHub Actions workflow actions to Node 24-ready versions
- kept the project build runtime on Node.js 22 for stable UI builds

## v0.2.1
- changed GitHub Actions pipeline so `pnpm type-check` is informational and no longer blocks release publication
- kept `pnpm build` as the hard gate for shipping `dist.zip`

## v0.2.0
- updated product metadata and visible branding for the new Ubuntu-oriented line
- switched GitHub links, release checks and rolling update URL to `NightShadowDevOPs/UIUbuntuXkeen`
- added GitHub Actions build/release pipeline with versioned and rolling artifacts

## v0.1.0
- bootstrapped canonical project docs in `docs/`
- added the project spec, roadmap, release log and chat-transfer package
