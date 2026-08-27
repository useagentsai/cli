import { describe, expect, test } from "bun:test";
import {
  INSTALL_SCRIPT_URL,
  isStandaloneBinary,
  resolveUpgradeRelease,
  upgradeCommand,
} from "../../src/commands/upgrade";
import { CliError } from "../../src/lib/errors";

describe("upgrade helpers", () => {
  test("resolves release from flag, env, then latest", () => {
    expect(resolveUpgradeRelease("v0.1.7", "v0.1.6")).toBe("v0.1.7");
    expect(resolveUpgradeRelease(undefined, "v0.1.6")).toBe("v0.1.6");
    expect(resolveUpgradeRelease(undefined, undefined)).toBe("latest");
  });

  test("detects standalone binary paths", () => {
    expect(isStandaloneBinary("/home/me/.local/bin/useagents")).toBe(true);
    expect(isStandaloneBinary("/tmp/useagents-linux-x64")).toBe(true);
    expect(isStandaloneBinary("/usr/bin/bun")).toBe(false);
  });
});

describe("upgradeCommand", () => {
  test("runs the install script and returns structured output", async () => {
    const calls: Array<{ release: string; streamOutput: boolean }> = [];
    const output = await upgradeCommand(
      { release: "v0.1.8" },
      { apiUrl: "https://api.useagents.site", format: "json", color: false },
      {
        version: "0.1.7",
        execPath: "/home/me/.local/bin/useagents",
        platform: "linux",
        runInstaller: async (args) => {
          calls.push(args);
          return { exitCode: 0, stdout: "ok", stderr: "" };
        },
      },
    );

    expect(calls).toEqual([{ release: "v0.1.8", streamOutput: false }]);
    expect(JSON.parse(output)).toEqual({
      command: "upgrade",
      query: "v0.1.8",
      data: {
        previousVersion: "0.1.7",
        release: "v0.1.8",
        installScript: INSTALL_SCRIPT_URL,
        exitCode: 0,
      },
      meta: { count: 1, total: 1 },
    });
  });

  test("rejects Windows with an npm hint", async () => {
    await expect(
      upgradeCommand(
        {},
        { apiUrl: "https://api.useagents.site", format: "human", color: false },
        {
          platform: "win32",
          runInstaller: async () => ({ exitCode: 0, stdout: "", stderr: "" }),
        },
      ),
    ).rejects.toBeInstanceOf(CliError);
  });

  test("surfaces installer failures", async () => {
    await expect(
      upgradeCommand(
        {},
        { apiUrl: "https://api.useagents.site", format: "json", color: false },
        {
          platform: "darwin",
          runInstaller: async () => ({ exitCode: 1, stdout: "", stderr: "✖ Download failed" }),
        },
      ),
    ).rejects.toMatchObject({ code: "UPGRADE_FAILED", message: "✖ Download failed" });
  });
});
