import { describe, expect, test } from "bun:test";
import { mapSearchResult, printJsonSuccess, printSearchHuman } from "../../src/lib/format";

const item = {
  id: "1",
  name: "Stripe",
  slug: "stripe",
  description: "General-purpose payment infrastructure for maximum control over checkout, billing, marketplaces, and payment flows.",
  capabilities: ["Marketplace payments", "Invoicing"],
  languages: ["typescript-javascript", "python"],
  interfaces: ["api", "cli", "mcp"],
  updated: "2026-08-15",
  verify: {
    website: "https://stripe.com",
    repository: "https://github.com/stripe",
    docs: "https://docs.stripe.com",
  },
};

describe("search formatting", () => {
  test("maps API result and shows the expected human output layout", () => {
    const data = { results: [mapSearchResult(item)] };
    const output = printSearchHuman(data, 1, false);

    expect(output).toContain("1. Stripe");
    expect(output).toContain("   Slug: stripe");
    expect(output).toContain("   Description: General-purpose payment infrastructure");
    expect(output).toContain("   Capabilities:\n     - Marketplace payments\n     - Invoicing");
    expect(output).toContain("   Languages: typescript-javascript, python");
    expect(output).toContain("   Interfaces: api, cli, mcp");
    expect(output).toContain("   Updated: 2026-08-15");
    expect(output).toContain("   Verify:");
    expect(output).toContain("     Website: https://stripe.com");
    expect(output).toContain("     Repository: https://github.com/stripe");
    expect(output).toContain("     Docs: https://docs.stripe.com");
  });

  test("JSON success is a single parseable line", () => {
    const value = JSON.parse(printJsonSuccess({ command: "search", query: "demo", data: { results: [] }, meta: { count: 0, total: 0 } }));
    expect(value.command).toBe("search");
    expect(value.meta.total).toBe(0);
  });

  test("preserves verify fields in mapped search result", () => {
    const value = JSON.parse(printJsonSuccess({ command: "search", query: "stripe", data: { results: [mapSearchResult(item)] }, meta: { count: 1, total: 1 } }));
    expect(value.data.results[0].verify).toEqual(item.verify);
    expect(value.data.results[0].capabilities).toEqual(item.capabilities);
  });
});
