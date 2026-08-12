import { describe, expect, test } from "bun:test";
import { mapSearchResult, printJsonSuccess, printSearchHuman } from "../../src/lib/format";

const item = { id: "1", name: "Demo", description: "The full API description", shortDescription: "Short API description", languages: ["ts"], frameworks: ["bun"], categories: ["tools"], slug: "demo", updatedAt: null };

describe("search formatting", () => {
  test("maps API result and shows the full human description", () => {
    const data = { results: [mapSearchResult(item)] };
    const output = printSearchHuman(data, 1, false);
    expect(output).toContain("demo");
    expect(output).toContain(item.description);
    expect(output).not.toContain(item.shortDescription);
    expect(output).not.toContain("stars");
  });

  test("JSON success is a single parseable line", () => {
    const value = JSON.parse(printJsonSuccess({ command: "search", query: "demo", data: { results: [] }, meta: { count: 0, total: 0 } }));
    expect(value.command).toBe("search");
    expect(value.meta.total).toBe(0);
  });
});
