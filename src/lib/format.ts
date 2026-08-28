import { encode } from "@toon-format/toon";
import type { SearchData, SearchResultItem, SuccessEnvelope, ToolContext, ToolDocsSearch } from "../types";

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

function truncateCode(code: string): string {
  return code.length > 1_000 ? `${code.slice(0, 999)}…` : code;
}

export function printHumanError(message: string, color: boolean): string {
  return `${red("✖", color)} ${message}\n`;
}
