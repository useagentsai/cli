import type { SearchResultItem as PublicSearchResultItem } from "@useagents/utils/schemas/search-result";

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

export interface SuccessEnvelope<T> {
  command: "search" | "context" | "docs" | "upgrade";
  query: string;
  data: T;
  meta: { count: number; total: number | null };
}
