# Agent instructions

## Version bumps

Bump `package.json` version in the same commit/PR as any change to:

- `src/**` (CLI behavior, commands, formatting, API client)
- `test/**` (when tests reflect changed behavior)
- runtime dependencies in `package.json`

Use semver patch by default (`0.1.9` → `0.1.10`). Use minor/major only when the change warrants it.

`src/version.ts` imports the version from `package.json` — update `package.json` only.

Skip version bumps only for docs-only or CI-only changes that do not affect the published `@useagents/cli` package.
