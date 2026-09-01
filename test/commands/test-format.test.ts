import { describe, expect, test } from "bun:test";
import { ApiClient } from "../../src/lib/api-client";
import { printJsonSuccess, printTestHuman } from "../../src/lib/format";
import type { TestToolResult } from "../../src/types";

const result: TestToolResult = {
  ok: true,
  status: "ran",
  slug: "resend",
  language: "typescript",
  runtime: "node",
  exitCode: 0,
  durationMs: 1500,
  phases: {
    provision: { ok: true, durationMs: 400, exitCode: null },
    install: { ok: true, durationMs: 900, exitCode: 0 },
    run: { ok: true, durationMs: 200, exitCode: 0 },
  },
  stdout: "function\n",
  stderr: "",
  stdoutTruncated: false,
  stderrTruncated: false,
  sessionId: "tt-node-abcdefghijkl",
  sessionExpiresAt: null,
  sessionReused: false,
  sessionFiles: ["src/index.ts"],
};

describe("test formatting", () => {
  test("human output includes status, phases, session, and stdout", () => {
    const output = printTestHuman(result, false);
    expect(output).toContain("Status: ran (ok)");
    expect(output).toContain("Slug: resend");
    expect(output).toContain("Runtime: node");
    expect(output).toContain("Session: tt-node-abcdefghijkl");
    expect(output).toContain("Files: src/index.ts");
    expect(output).toContain("    provision: ok 400ms");
    expect(output).toContain("    run: ok 200ms exit 0");
    expect(output).toContain("  stdout");
    expect(output).toContain("    function");
  });

  test("marks reused sessions and truncated streams", () => {
    const output = printTestHuman(
      {
        ...result,
        ok: false,
        status: "failed_run",
        sessionReused: true,
        stdout: "",
        stderr: "boom\n",
        stderrTruncated: true,
        error: { code: "timeout", message: "Run timed out" },
      },
      false,
    );
    expect(output).toContain("Status: failed_run");
    expect(output).toContain("Session: tt-node-abcdefghijkl (reused)");
    expect(output).toContain("Error (timeout): Run timed out");
    expect(output).toContain("    boom");
    expect(output).toContain("    [truncated]");
  });

  test("JSON envelope preserves session fields", () => {
    const value = JSON.parse(
      printJsonSuccess({
        command: "test",
        query: "node typescript resend src/index.ts",
        data: result,
        meta: { count: 1, total: 1 },
      }),
    );
    expect(value.command).toBe("test");
    expect(value.data.sessionId).toBe("tt-node-abcdefghijkl");
    expect(value.data.sessionExpiresAt).toBeNull();
    expect(value.data.sessionFiles).toEqual(["src/index.ts"]);
  });
});

describe("test API client", () => {
  test("POSTs /tools/test with JSON body", async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const client = new ApiClient("https://api.useagents.site", "key", (async (url, init) => {
      calls.push({ url: String(url), init: init ?? {} });
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch);

    const data = await client.testTool({
      language: "typescript",
      runtime: "node",
      files: [{ path: "src/index.ts", code: "console.log(1)" }],
      sessionId: "tt-node-abcdefghijkl",
      timeoutMs: 10_000,
    }, 25_000);

    expect(data.sessionId).toBe("tt-node-abcdefghijkl");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.useagents.site/tools/test");
    expect(calls[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      language: "typescript",
      runtime: "node",
      files: [{ path: "src/index.ts", code: "console.log(1)" }],
      sessionId: "tt-node-abcdefghijkl",
      timeoutMs: 10_000,
    });
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Authorization")).toBe("Bearer key");
  });
});
