# UseAgents CLI

Search the public UseAgents registry, authenticate with WorkOS, and chat with Atlas.

```bash
bun install
bun run src/index.ts search "mcp server frameworks"
bun run src/index.ts context drizzle-orm --language ts
bun run src/index.ts docs resend "how do I send attachments"
bun run src/index.ts auth login
bun run src/index.ts atlas
```

Install from npm with `npm install -g @useagents/cli`; the executable is `useagents`.

On macOS or Linux, install a checksum-verified binary with:

```bash
curl -fsSL https://useagents.site/cli/install.sh | sh
```

The installer prints the detected platform, install directory, download URL, checksum verification, and whether it is installing or updating. The binary is installed to `${XDG_BIN_HOME:-$HOME/.local/bin}`. Releases and `SHA256SUMS` are published on GitHub. The installer uses GitHub's latest-release download redirects, so it does not require the GitHub API. Set `USEAGENTS_VERSION` to pin a release.

## Auth and Atlas

```bash
useagents auth login    # WorkOS CLI Auth (device code)
useagents auth status
useagents auth logout
useagents atlas         # Branded USEAGENTS ATLAS chat (requires login)
useagents atlas -m "list my tools"
```

Credentials are stored in `${XDG_CONFIG_HOME:-$HOME/.config}/useagents/credentials.json`. Atlas requests send `Authorization: Bearer <access_token>` and `X-UseAgents-Org: <org_id>`. Override the Atlas host with `--atlas-url` or `USEAGENTS_ATLAS_URL`.

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

- `auth login|logout|status`
- `atlas [--url <url>] [-m/--message <message>]`
- `search <query> [--limit <n>] [--language/-l <lang>] [--transport/-t <transport>] [--category/-c <category>]`
- `context <package> [--language/-l <lang>] [--transport/-t <transport>]`
- `docs <package> <query...>`
- `upgrade [--release <tag>]`
- global `--format <human|json|toon>`, `--json`, `--no-color`, `--api-url <url>`, `--api-key <key>`, `--atlas-url <url>`

Set `USEAGENTS_API_URL`, `USEAGENTS_API_KEY`, `USEAGENTS_ATLAS_URL`, or `USEAGENTS_WORKOS_CLIENT_ID` in the environment; command-line options override them. `NO_COLOR` disables color.

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

The registry API is public beta and may evolve. Search JSON includes languages, categories, transports, and structured sources. Context JSON preserves the complete useful API payload, including named Quickstart examples, install instructions, transport, verified integrations, entry docs links, and I/O metadata. Docs JSON returns ranked passages from the tool's official documentation host.

Run `useagents --help`, `useagents search --help`, `useagents context --help`, `useagents docs --help`, or `useagents upgrade --help` for the complete command reference.
