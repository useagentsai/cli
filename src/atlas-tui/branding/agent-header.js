/**
 * Branded agent header for USEAGENTS ATLAS.
 * Replaces eve's agent-header.js so the TUI shows only "USEAGENTS ATLAS".
 */
const AGENT_HEADER_TIPS = [];

function pickAgentHeaderTip(_random = Math.random) {
  return "";
}

function buildAgentHeader(input) {
  const { theme, width } = input;
  const c = theme.colors;
  const title = c.bold("USEAGENTS ATLAS");
  // Match eve's leading space so the layout stays aligned.
  const line = ` ${title}`;
  if (typeof width === "number" && width > 0 && line.length > width) {
    return [` ${c.bold("USEAGENTS ATLAS".slice(0, Math.max(1, width - 1)))}`];
  }
  return [line];
}

export { AGENT_HEADER_TIPS, buildAgentHeader, pickAgentHeaderTip };
