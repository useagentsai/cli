# UseAgents CLI

Search the public UseAgents registry, fetch rich tool context, and search a tool's official docs.

```bash
bun install
bun run src/index.ts search "mcp server frameworks"
bun run src/index.ts context drizzle-orm --language ts
bun run src/index.ts docs resend "how do I send attachments"
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
- global `--format <human|json|toon>`, `--json`, `--no-color`, `--api-url <url>`, `--api-key <key>`

Set `USEAGENTS_API_URL` or `USEAGENTS_API_KEY` in the environment; command-line options override them. `NO_COLOR` disables color.

Build a standalone binary:

```bash
bun run build:bin
./dist/useagents search drizzle --limit 2
```

The registry API is public beta and may evolve. Search JSON includes languages, categories, transports, and structured sources. Context JSON preserves the complete useful API payload, including named Quickstart examples, install instructions, transport, verified integrations, entry docs links, and I/O metadata. Docs JSON returns ranked passages from the tool's official documentation host.

Run `useagents --help`, `useagents search --help`, `useagents context --help`, or `useagents docs --help` for the complete command reference.
