import { basename } from "node:path";
import type { RuntimeConfig } from "../config";
import { CliError } from "../lib/errors";
import { printStructuredSuccess } from "../lib/format";
import { CLI_VERSION } from "../version";

export const INSTALL_SCRIPT_URL = "https://useagents.site/cli/install.sh";

export interface UpgradeOptions {
  release?: string;
}

export interface InstallerResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type RunInstaller = (args: {
  release: string;
  streamOutput: boolean;
}) => Promise<InstallerResult>;

export function resolveUpgradeRelease(releaseFlag?: string, envVersion = process.env.USEAGENTS_VERSION): string {
  return releaseFlag || envVersion || "latest";
}

export function isStandaloneBinary(execPath = process.execPath): boolean {
  const name = basename(execPath);
  return name === "useagents" || name.startsWith("useagents-");
}

export async function defaultRunInstaller({
  release,
  streamOutput,
}: {
  release: string;
  streamOutput: boolean;
}): Promise<InstallerResult> {
  const env = { ...process.env };
  if (release === "latest") {
    delete env.USEAGENTS_VERSION;
  } else {
    env.USEAGENTS_VERSION = release;
  }

  const proc = Bun.spawn(["sh", "-c", `curl -fsSL "${INSTALL_SCRIPT_URL}" | sh`], {
    env,
    stdin: "ignore",
    stdout: streamOutput ? "inherit" : "pipe",
    stderr: streamOutput ? "inherit" : "pipe",
  });

  const exitCode = await proc.exited;
  const stdout = streamOutput ? "" : await new Response(proc.stdout).text();
  const stderr = streamOutput ? "" : await new Response(proc.stderr).text();
  return { exitCode, stdout, stderr };
}

export async function upgradeCommand(
  options: UpgradeOptions,
  config: RuntimeConfig,
  deps: {
    runInstaller?: RunInstaller;
    platform?: NodeJS.Platform;
    execPath?: string;
    version?: string;
  } = {},
): Promise<string> {
  const platform = deps.platform ?? process.platform;
  const version = deps.version ?? CLI_VERSION;
  const runInstaller = deps.runInstaller ?? defaultRunInstaller;

  if (platform === "win32") {
    throw new CliError(
      "Binary upgrades are not supported on Windows. Use: npm install -g @useagents/cli@latest",
      "UNSUPPORTED_PLATFORM",
    );
  }

  const release = resolveUpgradeRelease(options.release);
  const streamOutput = config.format === "human";

  if (streamOutput) {
    const lines = [
      "",
      `  Upgrading UseAgents CLI (${version} → ${release})`,
      `  Running: curl -fsSL ${INSTALL_SCRIPT_URL} | sh`,
    ];
    if (!isStandaloneBinary(deps.execPath)) {
      lines.push(
        "  Note: this updates the standalone binary in ~/.local/bin (or $XDG_BIN_HOME).",
        "  If you installed via npm, you can instead run: npm install -g @useagents/cli@latest",
      );
    }
    lines.push("");
    process.stderr.write(`${lines.join("\n")}\n`);
  }

  const result = await runInstaller({ release, streamOutput });
  if (result.exitCode !== 0) {
    const detail = [result.stderr, result.stdout].map((part) => part.trim()).filter(Boolean).join("\n");
    throw new CliError(detail || "Upgrade failed.", "UPGRADE_FAILED");
  }

  const envelope = {
    command: "upgrade" as const,
    query: release,
    data: {
      previousVersion: version,
      release,
      installScript: INSTALL_SCRIPT_URL,
      exitCode: result.exitCode,
    },
    meta: { count: 1, total: 1 },
  };

  if (config.format === "human") {
    return "";
  }
  return printStructuredSuccess(envelope, config.format);
}
