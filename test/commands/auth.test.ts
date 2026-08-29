import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  clearCredentials,
  credentialsPath,
  loadCredentials,
  saveCredentials,
} from "../../src/lib/credentials";
import { ATLAS_DISPLAY_NAME, DEFAULT_ATLAS_URL, resolveAtlasUrl } from "../../src/commands/atlas";
import { DEFAULT_WORKOS_CLIENT_ID } from "../../src/lib/workos-auth";
import { applyAtlasTuiBranding, eveTuiModuleUrl } from "../../src/atlas-tui/branding/apply-branding";

describe("credentials store", () => {
  test("saves and loads credentials under XDG_CONFIG_HOME", async () => {
    const root = await mkdtemp(join(tmpdir(), "useagents-cli-"));
    process.env.XDG_CONFIG_HOME = root;

    await saveCredentials({
      accessToken: "access",
      refreshToken: "refresh",
      organizationId: "org_1",
      user: { id: "user_1", email: "dev@useagents.site" },
      updatedAt: "2026-08-29T00:00:00.000Z",
    });

    expect(credentialsPath()).toBe(join(root, "useagents", "credentials.json"));
    const loaded = await loadCredentials();
    expect(loaded?.accessToken).toBe("access");
    expect(loaded?.organizationId).toBe("org_1");
    expect(loaded?.user.email).toBe("dev@useagents.site");

    const raw = await readFile(credentialsPath(), "utf8");
    expect(JSON.parse(raw).refreshToken).toBe("refresh");

    await clearCredentials();
    expect(await loadCredentials()).toBeNull();
  });
});

describe("atlas url helper", () => {
  test("resolves default and overrides", () => {
    delete process.env.USEAGENTS_ATLAS_URL;
    expect(resolveAtlasUrl()).toBe(DEFAULT_ATLAS_URL);
    expect(resolveAtlasUrl("https://example.com/atlas/")).toBe("https://example.com/atlas");
    process.env.USEAGENTS_ATLAS_URL = "https://atlas.example/";
    expect(resolveAtlasUrl()).toBe("https://atlas.example");
    delete process.env.USEAGENTS_ATLAS_URL;
  });

  test("uses USEAGENTS ATLAS display name", () => {
    expect(ATLAS_DISPLAY_NAME).toBe("USEAGENTS ATLAS");
  });
});

describe("workos defaults", () => {
  test("exposes a public client id default", () => {
    expect(DEFAULT_WORKOS_CLIENT_ID.startsWith("client_")).toBe(true);
  });
});

describe("eve tui branding", () => {
  test("patches eve agent-header and status-line modules", async () => {
    await applyAtlasTuiBranding();
    const tuiPath = eveTuiModuleUrl();
    expect(tuiPath.endsWith("tui.js")).toBe(true);

    const header = await readFile(tuiPath.replace(/tui\.js$/, "agent-header.js"), "utf8");
    const status = await readFile(tuiPath.replace(/tui\.js$/, "status-line.js"), "utf8");
    expect(header).toContain("useagents-atlas-branding");
    expect(header).toContain("USEAGENTS ATLAS");
    expect(status).toContain("useagents-atlas-branding");
    expect(status).toContain("return undefined");
  });
});
