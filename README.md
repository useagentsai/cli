# UseAgents CLI

Search the public UseAgents registry and fetch rich tool context.

```bash
bun install
bun run src/index.ts search "mcp server frameworks"
bun run src/index.ts context drizzle-orm --language ts
```

Install from npm with `npm install -g @useagents/cli`; the executable is `useagents`.

On macOS or Linux, install a checksum-verified binary with:

```bash
curl -fsSL https://useagents.site/cli/install.sh | sh
```

The binary is installed to `${XDG_BIN_HOME:-$HOME/.local/bin}`. Releases and `SHA256SUMS` are published on GitHub. The installer uses GitHub's latest-release download redirects, so it does not require the GitHub API. Set `USEAGENTS_VERSION` to pin a release.

Output is human-readable in an interactive terminal and JSON when `--json` is set or stdout is piped. JSON success always uses:

```json
{"command":"search","query":"mcp","data":{"results":[]},"meta":{"count":0,"total":0}}
```

Errors use `{"error":{"message":"...","code":"..."}}` and exit with code 1 for known API/user errors (2 for unexpected failures). Spinner/progress output is always stderr.

Commands and flags:

- `search <query> [--limit <n>] [--language/-l <lang>] [--transport/-t <transport>] [--category/-c <category>]`
- `context <package> [--language/-l <lang>] [--transport/-t <transport>]`
- global `--json`, `--no-color`, `--api-url <url>`, `--api-key <key>`

Set `USEAGENTS_API_URL` or `USEAGENTS_API_KEY` in the environment; command-line options override them. `NO_COLOR` disables color.

Build a standalone binary:

```bash
bun run build:bin
./dist/useagents search drizzle --limit 2
```

The registry API is public beta and may evolve. Search JSON includes languages, categories, transports, and structured sources. Context JSON preserves the complete useful API payload, including named Quickstart examples, install instructions, transport, verified integrations, entry docs links, and I/O metadata.

Run `useagents --help`, `useagents search --help`, or `useagents context --help` for the complete command reference.
