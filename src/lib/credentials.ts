import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export interface StoredUser {
  id: string;
  email?: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface Credentials {
  accessToken: string;
  refreshToken: string;
  organizationId: string;
  user: StoredUser;
  updatedAt: string;
}

function configDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME?.trim();
  if (xdg) return join(xdg, "useagents");
  return join(homedir(), ".config", "useagents");
}

export function credentialsPath(): string {
  return join(configDir(), "credentials.json");
}

export async function loadCredentials(): Promise<Credentials | null> {
  try {
    const raw = await readFile(credentialsPath(), "utf8");
    const parsed = JSON.parse(raw) as Credentials;
    if (!(parsed.accessToken && parsed.refreshToken && parsed.organizationId)) {
      return null;
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function saveCredentials(credentials: Credentials): Promise<void> {
  const path = credentialsPath();
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, `${JSON.stringify(credentials, null, 2)}\n`, {
    mode: 0o600,
    encoding: "utf8",
  });
}

export async function clearCredentials(): Promise<void> {
  try {
    await unlink(credentialsPath());
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}
