import { getValidAccessToken, refreshStoredCredentials } from "./auth";
import type { RuntimeConfig } from "../config";
import { CliError } from "../lib/errors";
import { applyAtlasTuiBranding, eveTuiModuleUrl } from "../atlas-tui/branding/apply-branding";
import { pathToFileURL } from "node:url";

export const DEFAULT_ATLAS_URL = "https://atlas.useagents.site";
export const ATLAS_DISPLAY_NAME = "USEAGENTS ATLAS";

export function resolveAtlasUrl(override?: string): string {
  return (override || process.env.USEAGENTS_ATLAS_URL || DEFAULT_ATLAS_URL).replace(/\/+$/, "");
}

type RunDevelopmentTui = (input: {
  name?: string;
  target: {
    kind: "remote";
    serverUrl: string;
    workspaceRoot: string;
  };
  headers?: Readonly<Record<string, string>>;
  initialInput?: string;
}) => Promise<void>;

async function loadRunDevelopmentTui(): Promise<RunDevelopmentTui> {
  await applyAtlasTuiBranding();
  // Import after patching so Eve's TUI loads branded agent-header / status-line.
  const href = pathToFileURL(eveTuiModuleUrl()).href;
  const mod = (await import(href)) as { runDevelopmentTui: RunDevelopmentTui };
  return mod.runDevelopmentTui;
}

/**
 * Launch Eve's development TUI against Atlas with UseAgents branding and auth.
 * Uses Eve's real remote client/stream/HITL harness — not a custom readline shell.
 */
export async function atlasCommand(
  _config: RuntimeConfig,
  options: { url?: string; message?: string },
): Promise<string> {
  if (!(process.stdout.isTTY && process.stdin.isTTY) && !options.message) {
    throw new CliError(
      "Atlas interactive mode requires a TTY. Pass --message for a one-shot turn.",
      "ATLAS_TTY_REQUIRED",
    );
  }

  const host = resolveAtlasUrl(options.url);
  let auth: { accessToken: string; organizationId: string } = await getValidAccessToken();

  const headersFor = (accessToken: string, organizationId: string) => ({
    Authorization: `Bearer ${accessToken}`,
    "X-UseAgents-Org": organizationId,
  });

  const runDevelopmentTui = await loadRunDevelopmentTui();

  const launch = async () => {
    await runDevelopmentTui({
      name: ATLAS_DISPLAY_NAME,
      target: {
        kind: "remote",
        serverUrl: host,
        workspaceRoot: process.cwd(),
      },
      headers: headersFor(auth.accessToken, auth.organizationId),
      ...(options.message ? { initialInput: options.message } : {}),
    });
  };

  try {
    await launch();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const maybeAuth =
      /401|unauthor|invalid.?token|expired/i.test(message) ||
      (error as { status?: number })?.status === 401;
    if (!maybeAuth) throw error;

    auth = await refreshStoredCredentials();
    await launch();
  }

  return "";
}
