import { encode } from "@toon-format/toon";
import type { SearchData, SearchResultItem, SuccessEnvelope, TestToolPhase, TestToolResult, ToolContext, ToolDocsSearch } from "../types";

const cyan = (text: string, enabled: boolean) => enabled ? `\u001B[36m${text}\u001B[39m` : text;
const bold = (text: string, enabled: boolean) => enabled ? `\u001B[1m${text}\u001B[22m` : text;
const dim = (text: string, enabled: boolean) => enabled ? `\u001B[2m${text}\u001B[22m` : text;
const red = (text: string, enabled: boolean) => enabled ? `\u001B[31m${text}\u001B[39m` : text;

export function truncate(text: string, max = 70): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (normalized.length <= max) return normalized;
  const slice = normalized.slice(0, max - 1);
  const boundary = slice.lastIndexOf(" ");
  return `${(boundary > 0 ? slice.slice(0, boundary) : slice).trimEnd()}…`;
}

export function mapSearchResult(item: SearchResultItem): SearchData["results"][number] {
  const capabilities = item.capabilities || item.categories || [];
  const languages = item.languages || [];
  const interfaces = item.interfaces || item.transports || [];
  const updated = item.updated || item.updatedAt || "—";

  const website = item.verify?.website || item.sources?.website;
  const repository = item.verify?.repository || item.sources?.repoUrl;
  const docs = item.verify?.docs || item.sources?.docsUrl;

  const verify: { website?: string; repository?: string; docs?: string } = {};
  if (website) verify.website = website;
  if (repository) verify.repository = repository;
  if (docs) verify.docs = docs;

  return {
    name: item.name,
    slug: item.slug,
    description: item.description || item.shortDescription || "—",
    capabilities,
    languages,
    interfaces,
    updated,
    verify,
  };
}

export function printJsonSuccess<T>(envelope: SuccessEnvelope<T>): string {
  return `${JSON.stringify(envelope)}\n`;
}

export function printToonSuccess<T>(envelope: SuccessEnvelope<T>): string {
  return `${encode(envelope)}\n`;
}

export function printStructuredSuccess<T>(
  envelope: SuccessEnvelope<T>,
  format: "json" | "toon",
): string {
  return format === "toon" ? printToonSuccess(envelope) : printJsonSuccess(envelope);
}

export function printJsonError(error: { message: string; code: string }): string {
  return JSON.stringify({ error: { message: error.message, code: error.code } });
}

export function printSearchHuman(data: SearchData, total: number, color: boolean): string {
  if (data.results.length === 0) return "\n  No tools found.\n";
  const blocks = data.results.map((item, index) => {
    const lines = [
      `${index + 1}. ${cyan(item.name || item.slug, color)}`,
      `   Slug: ${item.slug}`,
      `   Description: ${item.description || "—"}`,
    ];

    if (item.capabilities && item.capabilities.length > 0) {
      lines.push("   Capabilities:");
      for (const cap of item.capabilities) {
        lines.push(`     - ${cap}`);
      }
    }

    lines.push(
      `   Languages: ${item.languages && item.languages.length ? item.languages.join(", ") : "—"}`,
      `   Interfaces: ${item.interfaces && item.interfaces.length ? item.interfaces.join(", ") : "—"}`,
      `   Updated: ${item.updated || "—"}`
    );

    const verifyLines: string[] = [];
    if (item.verify?.website) verifyLines.push(`     Website: ${item.verify.website}`);
    if (item.verify?.repository) verifyLines.push(`     Repository: ${item.verify.repository}`);
    if (item.verify?.docs) verifyLines.push(`     Docs: ${item.verify.docs}`);

    if (verifyLines.length > 0) {
      lines.push("   Verify:", ...verifyLines);
    }

    return lines.join("\n");
  });

  const footer = data.results.length !== total
    ? `\n\n  ${dim(`Showing ${data.results.length} of ${total} results.`, color)}`
    : "";
  return `${blocks.join("\n\n")}${footer}\n`;
}

export function printContextHuman(context: ToolContext, color: boolean): string {
  const lines = [
    "",
    `  ${cyan(context.name, color)}`,
    ...(context.tagline ? [`  ${truncate(context.tagline)}`, ""] : [""]),
    `  Docs: ${context.docsUrl}`,
    `  Published: ${context.lastPublishedAt || "—"}`,
  ];
  if (context.install?.length) {
    lines.push("", `  ${bold("Install", color)}`, "  ───────");
    for (const group of context.install) {
      lines.push(`  ${cyan(group.label, color)}`);
      for (const step of group.steps) {
        lines.push(`    • ${step.title}`);
        if (step.command) lines.push(`      ${step.command}`);
        if (step.notes) lines.push(`      ${dim(step.notes, color)}`);
      }
    }
  }
  if (context.examples?.length) {
    lines.push("", `  ${bold("Examples", color)}`, "  ────────");
    for (const example of context.examples) {
      lines.push(`  ${cyan(example.title, color)}`);
      if (example.transport) lines.push(`  Transport: ${example.transport}`);
      if (example.description) lines.push(`  ${example.description}`);
      if (example.docsUrl && !example.description?.includes(example.docsUrl)) {
        lines.push(`  Docs: ${example.docsUrl}`);
      }
      if (example.frameworks?.length) lines.push(`  Verified integrations: ${example.frameworks.join(", ")}`);
      lines.push(`    ${truncateCode(example.code)}`);
    }
  }
  return `${lines.join("\n")}\n`;
}

export function printDocsHuman(data: ToolDocsSearch, color: boolean): string {
  const lines = [
    "",
    `  ${cyan(data.slug, color)}`,
    `  Docs: ${data.docsUrl}`,
    `  Query: ${data.query}`,
  ];

  if (data.results.length === 0) {
    lines.push("", "  No documentation results found.");
    return `${lines.join("\n")}\n`;
  }

  lines.push("", `  ${bold("Results", color)}`, "  ───────");
  for (const [index, result] of data.results.entries()) {
    lines.push(`  ${index + 1}. ${cyan(result.title || result.url, color)}`);
    lines.push(`     ${result.url}`);
    if (result.description) {
      lines.push(`     ${result.description.trim()}`);
    }
    if (result.content) {
      for (const line of result.content.trimEnd().split("\n")) {
        lines.push(`     ${line}`);
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

const TEST_TOOL_PHASE_ORDER = ["provision", "install", "run"] as const;

function formatTestPhase(name: string, phase: TestToolPhase | undefined): string | undefined {
  if (!phase) return undefined;
  const parts = [`    ${name}: ${phase.ok ? "ok" : "failed"}`, `${phase.durationMs}ms`];
  if (typeof phase.exitCode === "number") parts.push(`exit ${phase.exitCode}`);
  return parts.join(" ");
}

function formatTestStream(label: string, text: string, truncated: boolean): string[] {
  if (!text.trim()) return [];
  const lines = ["", `  ${label}`];
  for (const line of text.trimEnd().split("\n")) {
    lines.push(`    ${line}`);
  }
  if (truncated) lines.push("    [truncated]");
  return lines;
}

export function printTestHuman(result: TestToolResult, color: boolean): string {
  const statusLine = `Status: ${result.status || "unknown"}${result.ok ? " (ok)" : ""}`;
  const lines = [
    "",
    `  ${result.ok ? cyan(statusLine, color) : red(statusLine, color)}`,
  ];
  if (result.slug) lines.push(`  Slug: ${result.slug}`);
  if (result.runtime) lines.push(`  Runtime: ${result.runtime}`);
  if (result.language) lines.push(`  Language: ${result.language}`);
  if (typeof result.durationMs === "number") lines.push(`  Duration: ${result.durationMs}ms`);
  if (typeof result.exitCode === "number") lines.push(`  Exit code: ${result.exitCode}`);
  if (result.sessionId) {
    lines.push(`  Session: ${result.sessionId}${result.sessionReused ? " (reused)" : ""}`);
  }
  if (result.sessionFiles?.length) {
    lines.push(`  Files: ${result.sessionFiles.join(", ")}`);
  }
  if (result.error?.message) {
    const code = result.error.code ? ` (${result.error.code})` : "";
    lines.push("", `  ${red(`Error${code}: ${result.error.message}`, color)}`);
  }

  const phaseLines = TEST_TOOL_PHASE_ORDER
    .map((name) => formatTestPhase(name, result.phases?.[name]))
    .filter((line): line is string => Boolean(line));
  if (phaseLines.length > 0) {
    lines.push("", `  ${bold("Phases", color)}`, "  ──────", ...phaseLines);
  }

  const stdout = formatTestStream("stdout", result.stdout, result.stdoutTruncated);
  const stderr = formatTestStream("stderr", result.stderr, result.stderrTruncated);
  lines.push(...stdout, ...stderr);
  if (stdout.length === 0 && stderr.length === 0 && !result.error?.message) {
    lines.push("", "  No stdout or stderr.");
  }
  return `${lines.join("\n")}\n`;
}

function truncateCode(code: string): string {
  return code.length > 1_000 ? `${code.slice(0, 999)}…` : code;
}

function printPhase(label: string, phase: TestToolPhase | undefined): string | null {
  if (!phase) return null;
  const code = phase.exitCode == null ? "" : ` exit=${phase.exitCode}`;
  return `  ${label}: ${phase.ok ? "ok" : "failed"} (${phase.durationMs}ms${code})`;
}

export function printTestHuman(result: TestToolResult, color: boolean): string {
  const lines = [
    "",
    `  ${cyan("test_tool", color)}  ${result.ok ? "ok" : "failed"}`,
    `  Status: ${result.status}`,
    `  Runtime: ${result.runtime}`,
    `  Language: ${result.language}`,
    ...(result.slug ? [`  Slug: ${result.slug}`] : []),
    `  Duration: ${result.durationMs}ms`,
    `  Exit: ${result.exitCode ?? "—"}`,
  ];
  const phases = [
    printPhase("Provision", result.phases.provision),
    printPhase("Install", result.phases.install),
    printPhase("Run", result.phases.run),
  ].filter((line): line is string => Boolean(line));
  if (phases.length) {
    lines.push("", `  ${bold("Phases", color)}`, "  ──────", ...phases);
  }
  if (result.error) {
    lines.push("", `  ${red(result.error.message, color)}`, `  Code: ${result.error.code}`);
  }
  if (result.stdout) {
    lines.push("", `  ${bold("stdout", color)}`, "  ──────");
    for (const line of result.stdout.trimEnd().split("\n")) {
      lines.push(`  ${line}`);
    }
    if (result.stdoutTruncated) lines.push(`  ${dim("(truncated)", color)}`);
  }
  if (result.stderr) {
    lines.push("", `  ${bold("stderr", color)}`, "  ──────");
    for (const line of result.stderr.trimEnd().split("\n")) {
      lines.push(`  ${line}`);
    }
    if (result.stderrTruncated) lines.push(`  ${dim("(truncated)", color)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function printHumanError(message: string, color: boolean): string {
  return `${red("✖", color)} ${message}\n`;
}
