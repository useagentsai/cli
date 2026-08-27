import type { RuntimeConfig } from "../config";
import { ApiClient } from "../lib/api-client";
import { CliError } from "../lib/errors";
import { printDocsHuman, printStructuredSuccess } from "../lib/format";
import { startSpinner } from "../lib/spinner";

export async function docsCommand(
  packageSlug: string,
  queryParts: string[],
  config: RuntimeConfig,
): Promise<string> {
  const query = queryParts.join(" ").trim();
  if (!query) {
    throw new CliError("Provide a documentation question after the slug.");
  }

  const spinner = startSpinner("Searching docs…", Boolean(process.stderr.isTTY));
  try {
    const data = await new ApiClient(config.apiUrl, config.apiKey).searchToolDocs(
      packageSlug,
      query,
    );
    const envelope = {
      command: "docs" as const,
      query: `${packageSlug} ${query}`,
      data,
      meta: { count: data.results.length, total: data.results.length },
    };
    if (config.format === "human") {
      return printDocsHuman(data, config.color);
    }
    return printStructuredSuccess(envelope, config.format);
  } finally {
    spinner.stop();
  }
}
