import type { RuntimeConfig } from "../config";
import { ApiClient, TEST_HTTP_TIMEOUT_BUFFER_MS } from "../lib/api-client";
import { CliError } from "../lib/errors";
import { printStructuredSuccess, printTestHuman } from "../lib/format";
import { startSpinner } from "../lib/spinner";
import {
  TEST_TOOL_RUNTIMES,
  type TestToolEnvItem,
  type TestToolFile,
  type TestToolInput,
  type TestToolResult,
  type TestToolRuntime,
} from "../types";

export const TEST_TOOL_DEFAULT_TIMEOUT_MS = 30_000;
export const TEST_TOOL_MAX_TIMEOUT_MS = 60_000;
export const TEST_TOOL_MAX_CODE = 12_000;
export const TEST_TOOL_MAX_FILES = 20;
export const TEST_TOOL_MAX_PACKAGES = 20;
export const TEST_TOOL_MAX_ENV = 20;

const ENV_NAME = /^[A-Z][A-Z0-9_]*$/;
const SECRET_NAME = /(?:API_KEY|SECRET|TOKEN|PASSWORD|PASS|KEY)$/;
const SAFE_RELATIVE_PATH = /^[a-zA-Z0-9._/-]+$/;

export interface TestCommandOptions {
  runtime?: string;
  language?: string;
  file?: string | string[];
  package?: string | string[];
  env?: string | string[];
  slug?: string;
  entry?: string;
  sessionId?: string;
  timeoutMs?: string;
}

export type ReadFile = (path: string) => Promise<string>;
export type RunTestTool = (input: TestToolInput, httpTimeoutMs: number) => Promise<TestToolResult>;

export function collectRepeatable(value: string, previous: string[]): string[] {
  return [...previous, value];
}

export function asList(value: string | string[] | undefined): string[] {
  if (value == null || value === "") return [];
  return Array.isArray(value) ? value : [value];
}

export function isTestToolRuntime(value: string): value is TestToolRuntime {
  return (TEST_TOOL_RUNTIMES as readonly string[]).includes(value);
}

export function parseEnvPair(raw: string): TestToolEnvItem {
  const eq = raw.indexOf("=");
  if (eq <= 0) {
    throw new CliError(`--env must be NAME=value (got ${JSON.stringify(raw)}).`);
  }
  const name = raw.slice(0, eq).trim();
  const val = raw.slice(eq + 1);
  if (!ENV_NAME.test(name)) {
    throw new CliError(`Invalid env name: ${name}. Use uppercase names like RESEND_API_KEY.`);
  }
  if (!val) {
    throw new CliError(`Env ${name} needs a value.`);
  }
  if (SECRET_NAME.test(name)) return { name, secret: val };
  return { name, value: val };
}

export function parseTimeoutMs(raw?: string): number | undefined {
  if (raw == null || raw === "") return undefined;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1_000 || parsed > TEST_TOOL_MAX_TIMEOUT_MS) {
    throw new CliError("--timeout-ms must be an integer between 1000 and 60000.");
  }
  return parsed;
}

export function isSafeRelativePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("..")) return false;
  return SAFE_RELATIVE_PATH.test(path);
}

export async function defaultReadFile(path: string): Promise<string> {
  return Bun.file(path).text();
}

export async function loadTestFiles(paths: string[], readFile: ReadFile): Promise<TestToolFile[]> {
  if (paths.length > TEST_TOOL_MAX_FILES) {
    throw new CliError(`At most ${TEST_TOOL_MAX_FILES} --file values are allowed.`);
  }
  const seen = new Set<string>();
  const files: TestToolFile[] = [];
  for (const path of paths) {
    if (!isSafeRelativePath(path)) {
      throw new CliError(`File path is not allowed: ${path}`);
    }
    if (seen.has(path)) {
      throw new CliError(`Duplicate file path: ${path}`);
    }
    seen.add(path);
    let code: string;
    try {
      code = await readFile(path);
    } catch {
      throw new CliError(`Cannot read file: ${path}`);
    }
    if (code.length > TEST_TOOL_MAX_CODE) {
      throw new CliError(`File ${path} exceeds the ${TEST_TOOL_MAX_CODE} character limit.`);
    }
    files.push({ path, code });
  }
  return files;
}

export function buildTestQuery(input: TestToolInput): string {
  const parts = [input.runtime, input.language];
  if (input.slug) parts.push(input.slug);
  if (input.entry) parts.push(input.entry);
  if (input.sessionId) parts.push(`session=${input.sessionId}`);
  return parts.join(" ");
}

export async function testCommand(
  options: TestCommandOptions,
  config: RuntimeConfig,
  deps: {
    readFile?: ReadFile;
    runTest?: RunTestTool;
    setExitCode?: (code: number) => void;
  } = {},
): Promise<string> {
  const runtime = options.runtime?.trim();
  const language = options.language?.trim();
  if (!runtime || !isTestToolRuntime(runtime)) {
    throw new CliError("--runtime must be one of: node, python, golang, ruby, rust.");
  }
  if (!language) {
    throw new CliError("Provide --language, for example typescript or python.");
  }

  const filePaths = asList(options.file);
  const packages = asList(options.package);
  const envFlags = asList(options.env);
  const sessionId = options.sessionId?.trim() || undefined;
  const entry = options.entry?.trim() || undefined;
  const slug = options.slug?.trim() || undefined;
  const timeoutMs = parseTimeoutMs(options.timeoutMs);

  if (packages.length > TEST_TOOL_MAX_PACKAGES) {
    throw new CliError(`At most ${TEST_TOOL_MAX_PACKAGES} --package values are allowed.`);
  }
  if (envFlags.length > TEST_TOOL_MAX_ENV) {
    throw new CliError(`At most ${TEST_TOOL_MAX_ENV} --env values are allowed.`);
  }
  if (filePaths.length === 0 && !sessionId) {
    throw new CliError("Provide --file, or pass --session-id to reuse a previous sandbox.");
  }
  if (filePaths.length === 0 && !entry) {
    throw new CliError("--entry is required when --file is omitted.");
  }
  if (entry && filePaths.length > 0 && !filePaths.includes(entry)) {
    throw new CliError("--entry must match one of the provided --file paths.");
  }
  if (entry && filePaths.length === 0 && !isSafeRelativePath(entry)) {
    throw new CliError(`File path is not allowed: ${entry}`);
  }

  const files = await loadTestFiles(filePaths, deps.readFile ?? defaultReadFile);
  const env = envFlags.map(parseEnvPair);
  const input: TestToolInput = {
    language,
    runtime,
    files,
    ...(packages.length ? { packages } : {}),
    ...(env.length ? { env } : {}),
    ...(slug ? { slug } : {}),
    ...(entry ? { entry } : {}),
    ...(sessionId ? { sessionId } : {}),
    ...(timeoutMs ? { timeoutMs } : {}),
  };

  const httpTimeoutMs = (timeoutMs ?? TEST_TOOL_DEFAULT_TIMEOUT_MS) + TEST_HTTP_TIMEOUT_BUFFER_MS;
  const spinner = startSpinner(
    sessionId ? "Resuming sandbox…" : "Running sandbox…",
    Boolean(process.stderr.isTTY),
  );
  try {
    const runTest = deps.runTest ?? ((body, timeout) => new ApiClient(config.apiUrl, config.apiKey).testTool(body, timeout));
    const data = await runTest(input, httpTimeoutMs);
    if (!data.ok) (deps.setExitCode ?? ((code) => { process.exitCode = code; }))(1);
    const envelope = {
      command: "test" as const,
      query: buildTestQuery({ ...input, entry: input.entry ?? files[0]?.path }),
      data,
      meta: { count: 1, total: 1 },
    };
    if (config.format === "human") {
      return printTestHuman(data, config.color);
    }
    return printStructuredSuccess(envelope, config.format);
  } finally {
    spinner.stop();
  }
}
