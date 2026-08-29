import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const brandingDir = dirname(fileURLToPath(import.meta.url));

const PATCHED_MARKER = "/* useagents-atlas-branding */\n";

function resolveEveTuiDir(): string {
  const eveEntry = require.resolve("eve/package.json");
  return join(dirname(eveEntry), "dist/src/cli/dev/tui");
}

async function patchFile(targetName: string, brandingName: string): Promise<void> {
  const tuiDir = resolveEveTuiDir();
  const targetPath = join(tuiDir, targetName);
  const brandingPath = join(brandingDir, brandingName);
  const backupPath = `${targetPath}.eve-orig`;

  const current = await readFile(targetPath, "utf8").catch(() => null);
  if (current === null) {
    throw new Error(`Eve TUI file missing: ${targetPath}`);
  }

  if (!current.startsWith(PATCHED_MARKER)) {
    // Keep a one-time backup of Eve's original module.
    await writeFile(backupPath, current, "utf8");
  }

  const branded = await readFile(brandingPath, "utf8");
  await writeFile(targetPath, `${PATCHED_MARKER}${branded}`, "utf8");
}

/** Patch Eve's installed TUI chrome modules in place (idempotent). */
export async function applyAtlasTuiBranding(): Promise<void> {
  await mkdir(brandingDir, { recursive: true });
  await patchFile("agent-header.js", "agent-header.js");
  await patchFile("status-line.js", "status-line.js");
}

export async function restoreEveTuiBranding(): Promise<void> {
  const tuiDir = resolveEveTuiDir();
  for (const name of ["agent-header.js", "status-line.js"] as const) {
    const targetPath = join(tuiDir, name);
    const backupPath = `${targetPath}.eve-orig`;
    try {
      await copyFile(backupPath, targetPath);
    } catch {
      // No backup yet — leave as-is.
    }
  }
}

export function eveTuiModuleUrl(): string {
  return join(resolveEveTuiDir(), "tui.js");
}

if (import.meta.main) {
  await applyAtlasTuiBranding();
  console.log("Applied USEAGENTS ATLAS branding to Eve TUI modules.");
}
