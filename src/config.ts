import { loadCredentials } from "./lib/credentials";

export const DEFAULT_API_URL = "https://api.useagents.site";
export const DEFAULT_ATLAS_URL = "https://atlas.useagents.site";

export type OutputFormat = "human" | "json" | "toon";

export interface GlobalOptions {
  json?: boolean;
  format?: string;
  color?: boolean;
  apiUrl?: string;
  apiKey?: string;
  atlasUrl?: string;
}

export interface RuntimeConfig {
  apiUrl: string;
  apiKey?: string;
  accessToken?: string;
  organizationId?: string;
  atlasUrl: string;
  format: OutputFormat;
  color: boolean;
}

export function resolveOutputFormat({
  formatFlag,
  jsonFlag,
  stdoutIsTTY,
}: {
  formatFlag?: string;
  jsonFlag?: boolean;
  stdoutIsTTY: boolean;
}): OutputFormat {
  if (formatFlag === "human" || formatFlag === "json" || formatFlag === "toon") {
    return formatFlag;
  }
  if (jsonFlag) return "json";
  return stdoutIsTTY ? "human" : "json";
}

export function shouldUseColor({
  noColorFlag,
  noColor,
  stdoutIsTTY,
}: {
  noColorFlag?: boolean;
  noColor?: string | undefined;
  stdoutIsTTY: boolean;
}): boolean {
  return !noColorFlag && !noColor && stdoutIsTTY;
}

export async function makeConfig(options: GlobalOptions, stdoutIsTTY: boolean): Promise<RuntimeConfig> {
  const credentials = await loadCredentials();
  return {
    apiUrl: (options.apiUrl || process.env.USEAGENTS_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    apiKey: options.apiKey || process.env.USEAGENTS_API_KEY,
    accessToken: credentials?.accessToken,
    organizationId: credentials?.organizationId,
    atlasUrl: (options.atlasUrl || process.env.USEAGENTS_ATLAS_URL || DEFAULT_ATLAS_URL).replace(/\/+$/, ""),
    format: resolveOutputFormat({
      formatFlag: options.format,
      jsonFlag: options.json,
      stdoutIsTTY,
    }),
    color: shouldUseColor({ noColorFlag: options.color === false, noColor: process.env.NO_COLOR, stdoutIsTTY }),
  };
}
