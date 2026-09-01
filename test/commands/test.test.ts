import { describe, expect, test } from "bun:test";
import {
  asList,
  parseEnvPair,
  parseTimeoutMs,
  testCommand,
} from "../../src/commands/test";
import { CliError } from "../../src/lib/errors";
import type { TestToolInput, TestToolResult } from "../../src/types";

const config = { apiUrl: "https://api.useagents.site", format: "json" as const, color: false };

const ran: TestToolResult = {
  ok: true,
  status: "ran",
  slug: "resend",
  language: "typescript",
  runtime: "node",
  exitCode: 0,
  durationMs: 1200,
  phases: {
    provision: { ok: true, durationMs: 200, exitCode: null },
    install: { ok: true, durationMs: 800, exitCode: 0 },
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

describe("test helpers", () => {
  test("parses env pairs and treats key-like names as secrets", () => {
    expect(parseEnvPair("LOG_LEVEL=debug")).toEqual({ name: "LOG_LEVEL", value: "debug" });
    expect(parseEnvPair("RESEND_API_KEY=re_test")).toEqual({ name: "RESEND_API_KEY", secret: "re_test" });
    expect(parseEnvPair("AUTH_TOKEN=abc=def")).toEqual({ name: "AUTH_TOKEN", secret: "abc=def" });
  });

  test("rejects invalid env pairs", () => {
    expect(() => parseEnvPair("nolequals")).toThrow(CliError);
    expect(() => parseEnvPair("lowercase=1")).toThrow(CliError);
    expect(() => parseEnvPair("LOG_LEVEL=")).toThrow(CliError);
  });

  test("parses timeout bounds", () => {
    expect(parseTimeoutMs(undefined)).toBeUndefined();
    expect(parseTimeoutMs("30000")).toBe(30_000);
    expect(() => parseTimeoutMs("500")).toThrow(CliError);
    expect(() => parseTimeoutMs("90000")).toThrow(CliError);
  });

  test("normalizes repeatable flags", () => {
    expect(asList(undefined)).toEqual([]);
    expect(asList("src/index.ts")).toEqual(["src/index.ts"]);
    expect(asList(["a", "b"])).toEqual(["a", "b"]);
  });
});

describe("testCommand", () => {
  test("posts files, packages, env secrets, and returns a session", async () => {
    const calls: Array<{ input: TestToolInput; timeout: number }> = [];
    const output = await testCommand(
      {
        runtime: "node",
        language: "typescript",
        file: "src/index.ts",
        package: ["resend"],
        env: ["RESEND_API_KEY=re_test", "LOG_LEVEL=debug"],
        slug: "resend",
      },
      config,
      {
        readFile: async (path) => {
          expect(path).toBe("src/index.ts");
          return 'console.log("ok")\n';
        },
        runTest: async (input, timeout) => {
          calls.push({ input, timeout });
          return ran;
        },
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.timeout).toBe(45_000);
    expect(calls[0]?.input).toEqual({
      language: "typescript",
      runtime: "node",
      files: [{ path: "src/index.ts", code: 'console.log("ok")\n' }],
      packages: ["resend"],
      env: [
        { name: "RESEND_API_KEY", secret: "re_test" },
        { name: "LOG_LEVEL", value: "debug" },
      ],
      slug: "resend",
    });
    const value = JSON.parse(output);
    expect(value.command).toBe("test");
    expect(value.data.sessionId).toBe("tt-node-abcdefghijkl");
    expect(value.data.ok).toBe(true);
  });

  test("reuses a session without rewriting files", async () => {
    const calls: TestToolInput[] = [];
    await testCommand(
      {
        runtime: "node",
        language: "typescript",
        sessionId: "tt-node-abcdefghijkl",
        entry: "src/index.ts",
      },
      config,
      {
        readFile: async () => {
          throw new Error("should not read files");
        },
        runTest: async (input) => {
          calls.push(input);
          return { ...ran, sessionReused: true };
        },
      },
    );
    expect(calls[0]).toEqual({
      language: "typescript",
      runtime: "node",
      files: [],
      entry: "src/index.ts",
      sessionId: "tt-node-abcdefghijkl",
    });
  });

  test("requires files unless a session id is set", async () => {
    await expect(
      testCommand({ runtime: "node", language: "typescript" }, config, {
        runTest: async () => ran,
      }),
    ).rejects.toBeInstanceOf(CliError);
  });

  test("requires entry when reusing a session without files", async () => {
    await expect(
      testCommand(
        { runtime: "node", language: "typescript", sessionId: "tt-node-abcdefghijkl" },
        config,
        { runTest: async () => ran },
      ),
    ).rejects.toMatchObject({ message: "--entry is required when --file is omitted." });
  });

  test("exits 1 when the sandbox result is not ok", async () => {
    const exitCodes: number[] = [];
    const output = await testCommand(
      { runtime: "node", language: "typescript", file: "src/index.ts" },
      { ...config, format: "human" },
      {
        readFile: async () => "throw new Error('nope')\n",
        runTest: async () => ({
          ...ran,
          ok: false,
          status: "failed_run",
          exitCode: 1,
          stdout: "",
          stderr: "Error: nope\n",
        }),
        setExitCode: (code) => {
          exitCodes.push(code);
        },
      },
    );
    expect(output).toContain("Status: failed_run");
    expect(output).toContain("Session: tt-node-abcdefghijkl");
    expect(output).toContain("Error: nope");
    expect(exitCodes).toEqual([1]);
  });

  test("passes a custom timeout through to the HTTP client", async () => {
    const timeouts: number[] = [];
    await testCommand(
      {
        runtime: "python",
        language: "python",
        file: "main.py",
        timeoutMs: "10000",
      },
      config,
      {
        readFile: async () => "print('ok')\n",
        runTest: async (input, timeout) => {
          timeouts.push(timeout);
          expect(input.timeoutMs).toBe(10_000);
          return { ...ran, runtime: "python", language: "python" };
        },
      },
    );
    expect(timeouts).toEqual([25_000]);
  });
});
