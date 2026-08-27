import { ApiError } from "./errors";
import type { SearchResultItem, ToolContext, ToolDocsSearch } from "../types";

const TIMEOUT_MS = 15_000;
const DOCS_TIMEOUT_MS = 30_000;

export class ApiClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey?: string,
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async searchTools(query: string, filters: { language?: string; transport?: string; category?: string } = {}): Promise<SearchResultItem[]> {
    const params = new URLSearchParams({ q: query });
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const body = await this.request<{ results: SearchResultItem[] }>(`/tools/search?${params}`);
    return body.results;
  }

  async getToolContext(slug: string, options: { language?: string; transport?: string } = {}): Promise<ToolContext> {
    const params = new URLSearchParams();
    if (options.language) params.set("language", options.language);
    if (options.transport) params.set("transport", options.transport);
    const suffix = params.toString() ? `?${params}` : "";
    return this.request<ToolContext>(`/tools/context/${encodeURIComponent(slug)}${suffix}`);
  }

  async searchToolDocs(slug: string, query: string): Promise<ToolDocsSearch> {
    const params = new URLSearchParams({ q: query });
    return this.request<ToolDocsSearch>(
      `/tools/docs/${encodeURIComponent(slug)}?${params}`,
      DOCS_TIMEOUT_MS,
    );
  }

  private async request<T>(path: string, timeoutMs = TIMEOUT_MS): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await this.fetcher(`${this.apiUrl}${path}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "@useagents/cli",
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal: controller.signal,
      });
      const body: unknown = await response.json().catch(() => undefined);
      if (!response.ok) {
        const apiError = body as { error?: { code?: string; message?: string; hint?: string } } | undefined;
        throw new ApiError(
          apiError?.error?.message || `Registry request failed (${response.status}).`,
          apiError?.error?.code || `HTTP_${response.status}`,
          response.status,
          apiError?.error?.hint,
        );
      }
      return body as T;
    } catch (error) {
      if (error instanceof ApiError || (error instanceof Error && error.name === "AbortError")) throw error;
      throw new ApiError("Unable to reach the UseAgents registry.", "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }
}
