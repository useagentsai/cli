import type { SearchData, SearchResultItem, SuccessEnvelope, ToolContext } from "../types";

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
  return {
    name: item.name,
    slug: item.slug,
    description: item.description || item.shortDescription,
    languages: item.languages || [],
    categories: item.categories || [],
    updatedAt: item.updatedAt ?? null,
    transports: item.transports || [],
    sources: item.sources || {},
  };
}

export function printJsonSuccess<T>(envelope: SuccessEnvelope<T>): string {
  return `${JSON.stringify(envelope)}\n`;
}

export function printJsonError(error: { message: string; code: string }): string {
  return JSON.stringify({ error: { message: error.message, code: error.code } });
}

export function printSearchHuman(data: SearchData, total: number, color: boolean): string {
  if (data.results.length === 0) return "\n  No tools found.\n";
  const blocks = data.results.map((item, index) => {
    const lines = [
      `  ${index + 1}. ${cyan(item.name || item.slug, color)}`,
      `     ${dim(`Slug: ${item.slug}`, color)}`,
      `     Description: ${item.description || "—"}`,
      `     Languages: ${item.languages.length ? item.languages.join(", ") : "—"}`,
      `     Transports: ${item.transports?.length ? item.transports.join(", ") : "—"}`,
      `     Last updated: ${item.updatedAt || "—"}`,
    ];
    if (item.categories.length) lines.push(`     Categories: ${item.categories.join(", ")}`);
    const sourceLines = [
      item.sources?.website ? `       Website: ${item.sources.website}` : null,
      item.sources?.repoUrl ? `       Repository: ${item.sources.repoUrl}` : null,
      item.sources?.docsUrl ? `       Docs: ${item.sources.docsUrl}` : null,
    ].filter((line): line is string => line !== null);
    if (sourceLines.length) lines.push("     Sources:", ...sourceLines);
    return lines.join("\n");
  });
  const footer = data.results.length !== total
    ? `\n  ${dim(`Showing ${data.results.length} of ${total} results.`, color)}`
    : "";
  return `\n${blocks.join("\n\n")}${footer}\n`;
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
      if (example.docsUrl) lines.push(`  Docs: ${example.docsUrl}`);
      if (example.frameworks?.length) lines.push(`  Verified integrations: ${example.frameworks.join(", ")}`);
      lines.push(`    ${truncateCode(example.code)}`);
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
