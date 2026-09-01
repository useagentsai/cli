export interface SearchResultItem {
  id?: string;
  name: string;
  description: string;
  shortDescription?: string;
  capabilities?: string[];
  languages?: string[];
  categories?: string[];
  slug: string;
  updatedAt?: string | null;
  updated?: string;
  transports?: string[];
  interfaces?: string[];
  sources?: { website?: string; docsUrl?: string; repoUrl?: string };
  verify?: { website?: string; repository?: string; docs?: string };
}

export interface PublicSearchResultItem {
  name: string;
  slug: string;
  description: string;
  capabilities: string[];
  languages: string[];
  interfaces: string[];
  updated: string;
  verify: { website?: string; repository?: string; docs?: string };
}

export interface InstallStep {
  title: string;
  command?: string;
  notes?: string;
}

export interface ToolContext {
  name: string;
  slug: string;
  tagline?: string;
  docsUrl: string;
  lastPublishedAt?: string | null;
  lastVerifiedAt?: string | null;
  install: { label: string; steps: InstallStep[] }[];
  examples: { title: string; description?: string; language: "ts" | "bash"; code: string; transport?: "api" | "cli" | "mcp"; frameworks?: string[]; docsUrl?: string }[];
}

export interface ToolDocsResultItem {
  url: string;
  title?: string;
  description?: string;
  content?: string;
}

export interface ToolDocsSearch {
  slug: string;
  docsUrl: string;
  query: string;
  results: ToolDocsResultItem[];
}

export interface SearchData {
  results: PublicSearchResultItem[];
}

export const TEST_TOOL_RUNTIMES = ["node", "python", "golang", "ruby", "rust"] as const;
export type TestToolRuntime = (typeof TEST_TOOL_RUNTIMES)[number];

export interface TestToolEnvItem {
  name: string;
  value?: string;
  secret?: string;
}

export interface TestToolFile {
  path: string;
  code: string;
}

export interface TestToolInput {
  slug?: string;
  language: string;
  runtime: TestToolRuntime;
  packages?: string[];
  files: TestToolFile[];
  entry?: string;
  sessionId?: string;
  env?: TestToolEnvItem[];
  timeoutMs?: number;
}

export interface TestToolPhase {
  ok: boolean;
  durationMs: number;
  exitCode: number | null;
}

export interface TestToolResult {
  ok: boolean;
  status: string;
  slug: string | null;
  language: string;
  runtime: string;
  exitCode: number | null;
  durationMs: number;
  phases: {
    provision?: TestToolPhase;
    install?: TestToolPhase;
    run?: TestToolPhase;
  };
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  sessionId: string | null;
  sessionExpiresAt: number | null;
  sessionReused: boolean;
  sessionFiles: string[];
  error?: { code: string; message: string };
}

export interface SuccessEnvelope<T> {
  command: "search" | "context" | "docs" | "upgrade" | "test";
  query: string;
  data: T;
  meta: { count: number; total: number | null };
}
