#!/usr/bin/env bun
import { Command } from "commander";
import { atlasCommand } from "./commands/atlas";
import { authLoginCommand, authLogoutCommand, authStatusCommand } from "./commands/auth";
import { contextCommand } from "./commands/context";
import { docsCommand } from "./commands/docs";
import { searchCommand } from "./commands/search";
import { upgradeCommand } from "./commands/upgrade";
import { makeConfig } from "./config";
import { errorDetails } from "./lib/errors";
import { printHumanError, printJsonError } from "./lib/format";
import { CLI_VERSION } from "./version";

const program = new Command();
program
  .name("useagents")
  .description("Search the UseAgents registry, authenticate, and chat with Atlas.")
  .version(CLI_VERSION)
  .option("--json", "write a JSON response (alias for --format json)")
  .option("--format <format>", "output format: human, json, or toon (default: human in a TTY, json when piped)")
  .option("--no-color", "disable terminal color")
  .option("--api-url <url>", "UseAgents API URL")
  .option("--api-key <key>", "UseAgents API key")
  .option("--atlas-url <url>", "Atlas agent URL")
  .addHelpText(
    "after",
    `\nExamples:\n  $ useagents auth login\n  $ useagents atlas\n  $ useagents search \"email api\" -l python -t api\n  $ useagents context resend -l typescript-javascript -t api\n  $ useagents docs resend \"how do I send attachments\"\n  $ useagents upgrade\n`,
  );

function run(action: (config: Awaited<ReturnType<typeof makeConfig>>) => Promise<string>): void {
  void (async () => {
    const config = await makeConfig(program.opts(), Boolean(process.stdout.isTTY));
    try {
      process.stdout.write(await action(config));
    } catch (error) {
      const details = errorDetails(error);
      if (config.format !== "human") process.stdout.write(`${printJsonError(details)}\n`);
      else process.stderr.write(printHumanError(details.message, config.color));
      process.exitCode = details.exitCode;
    }
  })();
}

const auth = program.command("auth").description("Authenticate with UseAgents via WorkOS");
auth
  .command("login")
  .description("Log in with WorkOS CLI Auth (device code)")
  .action(() => run((config) => authLoginCommand(config)));
auth
  .command("logout")
  .description("Clear stored credentials")
  .action(() => run((config) => authLogoutCommand(config)));
auth
  .command("status")
  .description("Show current login status")
  .action(() => run((config) => authStatusCommand(config)));

program
  .command("atlas")
  .description("Chat with USEAGENTS ATLAS for org and tool management")
  .option("--url <url>", "Atlas host URL")
  .option("-m, --message <message>", "Send one message and exit")
  .action((options: { url?: string; message?: string }) =>
    run((config) => atlasCommand(config, options)),
  );

program
  .command("search <query>")
  .description("Search registry tools")
  .option("--limit <n>", "maximum results", "10")
  .option("-l, --language <lang>", "filter by language")
  .option("-t, --transport <transport>", "filter by transport: api, cli, or mcp")
  .option("-c, --category <category>", "filter by category")
  .action(
    (
      query: string,
      options: { limit?: string; language?: string; transport?: string; category?: string },
    ) => run((config) => searchCommand(query, options, config)),
  );
program
  .command("context <package>")
  .description("Fetch a tool's agent context")
  .option("-l, --language <lang>", "filter examples by language")
  .option("-t, --transport <transport>", "filter examples by transport: api, cli, or mcp")
  .action((packageSlug: string, options: { language?: string; transport?: string }) =>
    run((config) => contextCommand(packageSlug, options, config)),
  );
program
  .command("docs <package> <query...>")
  .description("Search a tool's official documentation")
  .action((packageSlug: string, queryParts: string[]) =>
    run((config) => docsCommand(packageSlug, queryParts, config)),
  );
program
  .command("upgrade")
  .description("Upgrade the UseAgents CLI via the official install script")
  .option("--release <tag>", "install a specific release tag (e.g. v0.1.8)")
  .action((options: { release?: string }) => run((config) => upgradeCommand(options, config)));

if (process.argv.slice(2).length === 0) {
  program.outputHelp();
} else {
  program.parse();
}
