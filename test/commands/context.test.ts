import { describe, expect, test } from "bun:test";
import { printContextHuman, printJsonSuccess } from "../../src/lib/format";

const context = { name: "Demo", slug: "demo", tagline: "A demo tool", docsUrl: "https://example.com", lastPublishedAt: null, lastVerifiedAt: null, install: [{ label: "npm", steps: [{ title: "Install", command: "npm i demo" }] }], examples: [{ title: "Basic", language: "ts" as const, code: "console.log('ok')" }], io: { inputs: [], outputs: [] } };

describe("context formatting", () => {
  test("includes install in JSON and human output", () => {
    const value = JSON.parse(printJsonSuccess({ command: "context", query: "demo", data: context, meta: { count: 1, total: 1 } }));
    expect(value.data.install).toBeDefined();
    expect(printContextHuman(context, false)).toContain("npm i demo");
  });
});
