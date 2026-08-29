import { CliError } from "./errors";

export const DEFAULT_WORKOS_CLIENT_ID = "client_01KA6HM11JE2M1HCDZY679Z103";
export const WORKOS_API_BASE = "https://api.workos.com";

export interface DeviceAuthorization {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

export interface WorkOSUser {
  id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  organization_id?: string;
  user: WorkOSUser;
}

function clientId(): string {
  return (
    process.env.USEAGENTS_WORKOS_CLIENT_ID?.trim() ||
    process.env.WORKOS_CLIENT_ID?.trim() ||
    DEFAULT_WORKOS_CLIENT_ID
  );
}

async function postForm(path: string, body: Record<string, string>): Promise<Response> {
  return fetch(`${WORKOS_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body),
  });
}

export async function requestDeviceAuthorization(): Promise<DeviceAuthorization> {
  const response = await postForm("/user_management/authorize/device", {
    client_id: clientId(),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new CliError(
      typeof data.error_description === "string"
        ? data.error_description
        : "Failed to start WorkOS device authorization.",
      "AUTH_DEVICE_START_FAILED",
    );
  }
  return {
    deviceCode: String(data.device_code),
    userCode: String(data.user_code),
    verificationUri: String(data.verification_uri),
    verificationUriComplete: String(data.verification_uri_complete ?? data.verification_uri),
    expiresIn: Number(data.expires_in ?? 300),
    interval: Number(data.interval ?? 5),
  };
}

export async function pollDeviceToken(deviceCode: string, expiresIn: number, intervalSec: number): Promise<TokenResponse> {
  const deadline = Date.now() + expiresIn * 1000;
  let interval = Math.max(intervalSec, 1);

  while (Date.now() < deadline) {
    const response = await postForm("/user_management/authenticate", {
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      device_code: deviceCode,
      client_id: clientId(),
    });
    const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & Partial<TokenResponse>;

    if (response.ok && data.access_token && data.refresh_token && data.user) {
      return data as TokenResponse;
    }

    const error = typeof data.error === "string" ? data.error : "unknown";
    if (error === "authorization_pending") {
      await Bun.sleep(interval * 1000);
      continue;
    }
    if (error === "slow_down") {
      interval += 1;
      await Bun.sleep(interval * 1000);
      continue;
    }
    if (error === "access_denied" || error === "expired_token") {
      throw new CliError("Authorization was denied or expired.", "AUTH_DENIED");
    }
    throw new CliError(
      typeof data.error_description === "string" ? data.error_description : "Device authorization failed.",
      "AUTH_FAILED",
    );
  }

  throw new CliError("Authorization timed out.", "AUTH_TIMEOUT");
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const response = await postForm("/user_management/authenticate", {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId(),
  });
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown> & Partial<TokenResponse>;
  if (!response.ok || !(data.access_token && data.refresh_token && data.user)) {
    throw new CliError(
      typeof data.error_description === "string"
        ? data.error_description
        : "Session expired. Run `useagents auth login` again.",
      "AUTH_REFRESH_FAILED",
    );
  }
  return data as TokenResponse;
}

export function openBrowser(url: string): void {
  const platform = process.platform;
  let cmd: string[];
  if (platform === "darwin") cmd = ["open", url];
  else if (platform === "win32") cmd = ["cmd", "/c", "start", "", url];
  else cmd = ["xdg-open", url];
  try {
    Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore", stdin: "ignore" });
  } catch {
    // Browser open is best-effort; user can paste the URL manually.
  }
}
