#!/usr/bin/env bun
import { Command } from "commander";
import { contextCommand } from "./commands/context";
import { docsCommand } from "./commands/docs";
import { searchCommand } from "./commands/search";
import { collectRepeatable, testCommand } from "./commands/test";
import { upgradeCommand } from "./commands/upgrade";
import { makeConfig } from "./config";
import { errorDetails } from "./lib/errors";
import { printHumanError, printJsonError } from "./lib/format";
import { CLI_VERSION } from "./version";

const program = new Command();
program
  .name("useagents")
  .description("Search the UseAgents registry, fetch tool context, and test snippets in a sandbox.")
  .version(CLI_VERSION)
  .option("--json", "write a JSON response (alias for --format json)")
  .option("--format <format>", "output format: human, json, or toon (default: human in a TTY, json when piped)")
  .option("--no-color", "disable terminal color")
  .option("--api-url <url>", "UseAgents API URL")
  .option("--api-key <key>", "UseAgents API key")
  .addHelpText("after", `\nExamples:\n  $ useagents search \"email api\" -l python -t api\n  $ useagents context resend -l typescript-javascript -t api\n  $ useagents docs resend \"how do I send attachments\"\n  $ useagents docs resend \"attachments\" --format toon\n  $ useagents test -r node -l typescript --package resend --file src/index.ts --slug resend\n  $ useagents upgrade\n`);

function run(action: (config: ReturnType<typeof makeConfig>) => Promise<string>): void {
  void (async () => {
    const config = makeConfig(program.opts(), Boolean(process.stdout.isTTY));
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

program.command("search <query>").description("Search registry tools").option("--limit <n>", "maximum results", "10")
  .option("-l, --language <lang>", "filter by language")
  .option("-t, --transport <transport>", "filter by transport: api, cli, or mcp")
  .option("-c, --category <category>", "filter by category")
  .action((query: string, options: { limit?: string; language?: string; transport?: string; category?: string }) => run((config) => searchCommand(query, options, config)));
program.command("context <package>").description("Fetch a tool's agent context")
  .option("-l, --language <lang>", "filter examples by language")
  .option("-t, --transport <transport>", "filter examples by transport: api, cli, or mcp")
  .action((packageSlug: string, options: { language?: string; transport?: string }) => run((config) => contextCommand(packageSlug, options, config)));
program.command("docs <package> <query...>").description("Search a tool's official documentation")
  .action((packageSlug: string, queryParts: string[]) => run((config) => docsCommand(packageSlug, queryParts, config)));
program.command("test").description("Run a snippet in a UseAgents sandbox")
  .requiredOption("-r, --runtime <runtime>", "sandbox runtime: node, python, golang, ruby, or rust")
  .requiredOption("-l, --language <lang>", "snippet language, for example typescript or python")
  .option("-f, --file <path>", "relative file to write (repeatable)", collectRepeatable, [])
  .option("-p, --package <name>", "package to install (repeatable)", collectRepeatable, [])
  .option("-e, --env <NAME=value>", "sandbox env var (repeatable; keys are sent as secrets)", collectRepeatable, [])
  .option("--slug <slug>", "registry slug this snippet is testing")
  .option("--entry <path>", "file to run (defaults to the first --file)")
  .option("--session-id <id>", "reuse a previous sandbox session")
  .option("--timeout-ms <ms>", "sandbox timeout in milliseconds (1000-60000)")
  .action((options: {
    runtime?: string;
    language?: string;
    file?: string[];
    package?: string[];
    env?: string[];
    slug?: string;
    entry?: string;
    sessionId?: string;
    timeoutMs?: string;
  }) => run((config) => testCommand(options, config)));
program.command("upgrade").description("Upgrade the UseAgents CLI via the official install script")
  .option("--release <tag>", "install a specific release tag (e.g. v0.1.8)")
  .action((options: { release?: string }) => run((config) => upgradeCommand(options, config)));

if (process.argv.slice(2).length === 0) {
  program.outputHelp();
} else {
  program.parse();
}
