# Build hotfix v0.6.30

This release repairs the invalid YAML syntax introduced in `v0.6.29` inside `.github/workflows/build-ui.yml`.

What changed:
- removed the malformed multiline JavaScript snippet from the `Check lockfile drift` step;
- rewrote the step as valid shell commands that GitHub Actions can parse;
- kept explicit `pnpm` bootstrap and simple CI diagnostics.

Expected result:
- GitHub Actions should parse the workflow file again;
- the next failed run, if any, should report a real install/build error instead of a YAML parser failure.
