export const DEFAULT_API_URL = "https://api.useagents.site";

export interface GlobalOptions {
  json?: boolean;
  color?: boolean;
  apiUrl?: string;
  apiKey?: string;
}

export interface RuntimeConfig {
  apiUrl: string;
  apiKey?: string;
  json: boolean;
  color: boolean;
}

export function shouldUseJson({ jsonFlag, stdoutIsTTY }: { jsonFlag?: boolean; stdoutIsTTY: boolean }): boolean {
  return Boolean(jsonFlag) || !stdoutIsTTY;
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

export function makeConfig(options: GlobalOptions, stdoutIsTTY: boolean): RuntimeConfig {
  return {
    apiUrl: (options.apiUrl || process.env.USEAGENTS_API_URL || DEFAULT_API_URL).replace(/\/+$/, ""),
    apiKey: options.apiKey || process.env.USEAGENTS_API_KEY,
    json: shouldUseJson({ jsonFlag: options.json, stdoutIsTTY }),
    color: shouldUseColor({ noColorFlag: options.color === false, noColor: process.env.NO_COLOR, stdoutIsTTY }),
  };
}
