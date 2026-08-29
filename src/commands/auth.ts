import type { RuntimeConfig } from "../config";
import { clearCredentials, loadCredentials, saveCredentials, type Credentials } from "../lib/credentials";
import { CliError } from "../lib/errors";
import { printStructuredSuccess } from "../lib/format";
import {
  openBrowser,
  pollDeviceToken,
  refreshAccessToken,
  requestDeviceAuthorization,
} from "../lib/workos-auth";

function toStored(token: Awaited<ReturnType<typeof pollDeviceToken>>, fallbackOrgId?: string): Credentials {
  const organizationId = token.organization_id || fallbackOrgId;
  if (!organizationId) {
    throw new CliError(
      "Login succeeded but no organization was returned. Select an organization in AuthKit and try again.",
      "AUTH_MISSING_ORG",
    );
  }
  return {
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    organizationId,
    user: {
      id: token.user.id,
      email: token.user.email,
      firstName: token.user.first_name,
      lastName: token.user.last_name,
    },
    updatedAt: new Date().toISOString(),
  };
}

export async function authLoginCommand(config: RuntimeConfig): Promise<string> {
  const device = await requestDeviceAuthorization();
  const human = config.format === "human";

  if (human) {
    process.stderr.write(
      `Open ${device.verificationUriComplete}\nand confirm code ${device.userCode}\n`,
    );
  }
  openBrowser(device.verificationUriComplete);

  const tokens = await pollDeviceToken(device.deviceCode, device.expiresIn, device.interval);
  const credentials = toStored(tokens);
  await saveCredentials(credentials);

  const data = {
    user: credentials.user,
    organizationId: credentials.organizationId,
    credentialsPath: true,
  };

  if (config.format !== "human") {
    return printStructuredSuccess({ command: "auth login", data }, config.format);
  }
  return `Logged in as ${credentials.user.email ?? credentials.user.id} (org ${credentials.organizationId})\n`;
}

export async function authLogoutCommand(config: RuntimeConfig): Promise<string> {
  await clearCredentials();
  if (config.format !== "human") {
    return printStructuredSuccess({ command: "auth logout", data: { loggedOut: true } }, config.format);
  }
  return "Logged out.\n";
}

export async function authStatusCommand(config: RuntimeConfig): Promise<string> {
  const credentials = await loadCredentials();
  if (!credentials) {
    if (config.format !== "human") {
      return printStructuredSuccess({ command: "auth status", data: { authenticated: false } }, config.format);
    }
    return "Not logged in. Run `useagents auth login`.\n";
  }

  const data = {
    authenticated: true,
    user: credentials.user,
    organizationId: credentials.organizationId,
    updatedAt: credentials.updatedAt,
  };

  if (config.format !== "human") {
    return printStructuredSuccess({ command: "auth status", data }, config.format);
  }
  return `Logged in as ${credentials.user.email ?? credentials.user.id}\nOrganization: ${credentials.organizationId}\n`;
}

/** Returns a valid access token, refreshing if needed. */
export async function getValidAccessToken(): Promise<{ accessToken: string; organizationId: string; user: Credentials["user"] }> {
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new CliError("Not logged in. Run `useagents auth login`.", "AUTH_REQUIRED");
  }

  try {
    // Prefer existing token; refresh proactively only when refresh is forced by caller failures.
    return {
      accessToken: credentials.accessToken,
      organizationId: credentials.organizationId,
      user: credentials.user,
    };
  } catch {
    const refreshed = await refreshAccessToken(credentials.refreshToken);
    const next = toStored(refreshed, credentials.organizationId);
    await saveCredentials(next);
    return {
      accessToken: next.accessToken,
      organizationId: next.organizationId,
      user: next.user,
    };
  }
}

export async function refreshStoredCredentials(): Promise<{ accessToken: string; organizationId: string }> {
  const credentials = await loadCredentials();
  if (!credentials) {
    throw new CliError("Not logged in. Run `useagents auth login`.", "AUTH_REQUIRED");
  }
  try {
    const refreshed = await refreshAccessToken(credentials.refreshToken);
    const next = toStored(refreshed, credentials.organizationId);
    await saveCredentials(next);
    return { accessToken: next.accessToken, organizationId: next.organizationId };
  } catch (error) {
    await clearCredentials();
    throw error;
  }
}
