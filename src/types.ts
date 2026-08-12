export interface SearchResultItem {
  id: string;
  name: string;
  description: string;
  shortDescription: string;
  languages: string[];
  categories: string[];
  slug: string;
  updatedAt: string | null;
  transports?: string[];
  sources?: { website?: string; docsUrl?: string; repoUrl?: string };
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
  io: { inputs: unknown; outputs: { name: string; description: string }[] };
}

export interface SearchData {
  results: Array<{
    name: string;
    slug: string;
    description: string;
    languages: string[];
    categories: string[];
    updatedAt: string | null;
    transports?: string[];
    sources?: { website?: string; docsUrl?: string; repoUrl?: string };
  }>;
}

export interface SuccessEnvelope<T> {
  command: "search" | "context";
  query: string;
  data: T;
  meta: { count: number; total: number | null };
}
