import { describe, expect, test } from "bun:test";
import { resolveOutputFormat } from "../../src/config";
import { printStructuredSuccess } from "../../src/lib/format";

describe("output format", () => {
  test("defaults to human in a TTY and json when piped", () => {
    expect(resolveOutputFormat({ stdoutIsTTY: true })).toBe("human");
    expect(resolveOutputFormat({ stdoutIsTTY: false })).toBe("json");
  });

  test("--format wins over --json and pipe defaults", () => {
    expect(resolveOutputFormat({ formatFlag: "toon", jsonFlag: true, stdoutIsTTY: false })).toBe("toon");
    expect(resolveOutputFormat({ formatFlag: "human", stdoutIsTTY: false })).toBe("human");
  });

  test("toon success is a non-json structured envelope", () => {
    const output = printStructuredSuccess(
      { command: "docs", query: "resend attachments", data: { slug: "resend" }, meta: { count: 1, total: 1 } },
      "toon",
    );
    expect(output).toContain("command");
    expect(output).toContain("resend");
    expect(() => JSON.parse(output)).toThrow();
  });
});
