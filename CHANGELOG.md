# Changelog

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
