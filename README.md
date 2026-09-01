# UseAgents CLI

Search the public UseAgents registry, fetch rich tool context, search a tool's official docs, and run snippets in a sandbox.

```bash
bun install
bun run src/index.ts search "mcp server frameworks"
bun run src/index.ts context drizzle-orm --language ts
bun run src/index.ts docs resend "how do I send attachments"
bun run src/index.ts test --runtime node --language typescript --package resend --file src/index.ts --slug resend
```

Install from npm with `npm install -g @useagents/cli`; the executable is `useagents`.

On macOS or Linux, install a checksum-verified binary with:

```bash
curl -fsSL https://useagents.site/cli/install.sh | sh
```

The installer prints the detected platform, install directory, download URL, checksum verification, and whether it is installing or updating. The binary is installed to `${XDG_BIN_HOME:-$HOME/.local/bin}`. Releases and `SHA256SUMS` are published on GitHub. The installer uses GitHub's latest-release download redirects, so it does not require the GitHub API. Set `USEAGENTS_VERSION` to pin a release.

## Output formats

| Format | Flag | When to use |
| ------ | ---- | ----------- |
| **human** | `--format human` (default in a TTY) | Readable terminal output |
| **json** | `--format json` or `--json` (default when piped) | Scripts and automation |
| **toon** | `--format toon` | Token-efficient structured output for LLMs ([toonformat.dev](https://toonformat.dev)) |

`--format` wins over `--json` and over the pipe default. JSON success always uses:

```json
{"command":"search","query":"mcp","data":{"results":[]},"meta":{"count":0,"total":0}}
```

Toon uses the same envelope shape, encoded as Toon text. Errors use `{"error":{"message":"...","code":"..."}}` and exit with code 1 for known API/user errors (2 for unexpected failures). Spinner/progress output is always stderr.

Commands and flags:

- `search <query> [--limit <n>] [--language/-l <lang>] [--transport/-t <transport>] [--category/-c <category>]`
- `context <package> [--language/-l <lang>] [--transport/-t <transport>]`
- `docs <package> <query...>`
- `test --runtime/-r <runtime> --language/-l <lang> [--file/-f <path>] [--package/-p <name>] [--env/-e NAME=value] [--slug <slug>] [--entry <path>] [--session-id <id>] [--timeout-ms <ms>]`
- `upgrade [--release <tag>]`
- global `--format <human|json|toon>`, `--json`, `--no-color`, `--api-url <url>`, `--api-key <key>`

Set `USEAGENTS_API_URL` or `USEAGENTS_API_KEY` in the environment; command-line options override them. `NO_COLOR` disables color.

## Test a snippet

`test` POSTs to `/tools/test`. `--file` is relative to the current directory and may be repeated, as may `--package` and `--env NAME=value`. JavaScript and TypeScript (`--runtime node`) use the Bun runtime to add packages and run files. The sandbox allows outbound network so live vendor API calls can run; names that look like keys (`*_API_KEY`, `*_TOKEN`, `*_SECRET`) are sent as secrets.

The first result includes a `sessionId`. Pass it back with `--session-id` to reuse the same box so packages and files stay installed. The box is paused between runs and has no hard TTL. When omitting `--file` on a follow-up, `--entry` is required.

```bash
useagents test \
  --runtime node \
  --language typescript \
  --package resend \
  --file src/index.ts \
  --slug resend \
  --env RESEND_API_KEY=re_test

useagents test \
  --runtime node \
  --language typescript \
  --session-id tt-node-xxxxxxxxxxxx \
  --entry src/index.ts
```

The command exits `1` when the sandbox result has `ok: false`.

Upgrade the standalone binary (same as re-running the install script):

```bash
useagents upgrade
useagents upgrade --release v0.1.9
```

`upgrade` runs `curl -fsSL https://useagents.site/cli/install.sh | sh`. Pass `--release` or set `USEAGENTS_VERSION` to pin a tag. On Windows, or if you installed via npm, use `npm install -g @useagents/cli@latest` instead.

Build a standalone binary:

```bash
bun run build:bin
./dist/useagents search drizzle --limit 2
```

The registry API is public beta and may evolve. Search JSON includes languages, categories, transports, and structured sources. Context JSON preserves the complete useful API payload, including named Quickstart examples, install instructions, transport, verified integrations, entry docs links, and I/O metadata. Docs JSON returns ranked passages from the tool's official documentation host. Test JSON includes sandbox status, stdout/stderr, phases, and session fields for reuse.

Run `useagents --help`, `useagents search --help`, `useagents context --help`, `useagents docs --help`, `useagents test --help`, or `useagents upgrade --help` for the complete command reference.
