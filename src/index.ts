#!/usr/bin/env bun
import { Command } from "commander";
import { contextCommand } from "./commands/context";
import { searchCommand } from "./commands/search";
import { makeConfig } from "./config";
import { errorDetails } from "./lib/errors";
import { printHumanError, printJsonError } from "./lib/format";

const program = new Command();
program
  .name("useagents")
  .description("Search the UseAgents registry and fetch tool context.")
  .option("--json", "write a JSON response")
  .option("--no-color", "disable terminal color")
  .option("--api-url <url>", "UseAgents API URL")
  .option("--api-key <key>", "UseAgents API key")
  .addHelpText("after", `\nExamples:\n  $ useagents search \"email api\" -l python -t api\n  $ useagents context resend -l typescript-javascript -t api\n`);

function run(action: (config: ReturnType<typeof makeConfig>) => Promise<string>): void {
  void (async () => {
    const config = makeConfig(program.opts(), Boolean(process.stdout.isTTY));
    try {
      process.stdout.write(await action(config));
    } catch (error) {
      const details = errorDetails(error);
      if (config.json) process.stdout.write(`${printJsonError(details)}\n`);
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

program.parse();
