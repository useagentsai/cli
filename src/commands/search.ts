import type { RuntimeConfig } from "../config";
import { ApiClient } from "../lib/api-client";
import { CliError } from "../lib/errors";
import { mapSearchResult, printSearchHuman, printStructuredSuccess } from "../lib/format";
import { startSpinner } from "../lib/spinner";

export async function searchCommand(query: string, options: { limit?: string; language?: string; transport?: string; category?: string }, config: RuntimeConfig): Promise<string> {
  const parsedLimit = options.limit === undefined ? 10 : Number(options.limit);
  if (!Number.isInteger(parsedLimit) || parsedLimit < 0) throw new CliError("--limit must be a non-negative integer.");
  const spinner = startSpinner("Searching registry…", Boolean(process.stderr.isTTY));
  try {
    const allResults = await new ApiClient(config.apiUrl, config.apiKey).searchTools(query, options);
    const results = allResults.slice(0, parsedLimit).map(mapSearchResult);
    const envelope = { command: "search" as const, query, data: { results }, meta: { count: results.length, total: allResults.length } };
    if (config.format === "human") {
      return printSearchHuman(envelope.data, allResults.length, config.color);
    }
    return printStructuredSuccess(envelope, config.format);
  } finally {
    spinner.stop();
  }
}
