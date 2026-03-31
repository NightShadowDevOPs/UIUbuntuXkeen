# Build hotfix v0.6.32

This release fixes the packaging mismatch from v0.6.31: the archive still contained the older GitHub Actions workflow even though the release notes claimed that `build-ui.yml` had been simplified.

## What changed
- `.github/workflows/build-ui.yml` is now actually replaced in the archive
- dependency install output is written to `install-deps.log` and printed inline on failure
- Vite build output is written to `build-ui.log` and printed inline on failure
- the noisy `Check lockfile drift` step is removed

## Goal
After this release, GitHub Actions should no longer fail with a silent `Build UI: Error code 1` caused by the stale workflow file. The next CI run should either pass or reveal the real first build error.
