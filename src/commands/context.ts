import type { RuntimeConfig } from "../config";
import { ApiClient } from "../lib/api-client";
import { printContextHuman, printStructuredSuccess } from "../lib/format";
import { startSpinner } from "../lib/spinner";

export async function contextCommand(packageSlug: string, options: { language?: string; transport?: string }, config: RuntimeConfig): Promise<string> {
  const spinner = startSpinner("Fetching context…", Boolean(process.stderr.isTTY));
  try {
    const data = await new ApiClient(config.apiUrl, config.apiKey).getToolContext(packageSlug, options);
    const qualifiers = [options.language && `language=${options.language}`, options.transport && `transport=${options.transport}`].filter(Boolean).join(" ");
    const query = qualifiers ? `${packageSlug} ${qualifiers}` : packageSlug;
    const envelope = { command: "context" as const, query, data, meta: { count: 1, total: 1 } };
    if (config.format === "human") {
      return printContextHuman(data, config.color);
    }
    return printStructuredSuccess(envelope, config.format);
  } finally {
    spinner.stop();
  }
}
