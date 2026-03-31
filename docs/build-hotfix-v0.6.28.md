# Build hotfix v0.6.28

This release hardens the GitHub Actions `Install dependencies` step.

Changes:
- capture `pnpm install --frozen-lockfile` output into `install-deps.log`;
- print the install log inline on failure;
- set `HUSKY=0` during CI install to avoid Husky bootstrap noise.

Goal: expose the first real dependency/setup failure instead of another opaque `exit code 1`.
