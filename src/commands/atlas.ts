import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { RuntimeConfig } from "../config";
import { getValidAccessToken, refreshStoredCredentials } from "./auth";
import { CliError } from "../lib/errors";

export const DEFAULT_ATLAS_URL = "https://atlas.useagents.site";

export function resolveAtlasUrl(override?: string): string {
  return (override || process.env.USEAGENTS_ATLAS_URL || DEFAULT_ATLAS_URL).replace(/\/+$/, "");
}

interface SessionCreateResponse {
  ok: boolean;
  sessionId?: string;
  status?: string;
  error?: string;
  code?: string;
}

interface StreamEvent {
  type: string;
  [key: string]: unknown;
}

type AuthState = { accessToken: string; organizationId: string };

function color(enabled: boolean, code: string, text: string): string {
  return enabled ? `\u001B[${code}m${text}\u001B[0m` : text;
}

function atlasHeaders(accessToken: string, organizationId: string): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
    "X-UseAgents-Org": organizationId,
    "User-Agent": "@useagents/cli",
  };
}

async function withAuthFetch(
  url: string,
  init: RequestInit,
  auth: AuthState,
): Promise<{ response: Response; auth: AuthState }> {
  let current = auth;
  let response = await fetch(url, {
    ...init,
    headers: {
      ...atlasHeaders(current.accessToken, current.organizationId),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (response.status === 401) {
    current = await refreshStoredCredentials();
    response = await fetch(url, {
      ...init,
      headers: {
        ...atlasHeaders(current.accessToken, current.organizationId),
        ...(init.headers as Record<string, string> | undefined),
      },
    });
  }
  return { response, auth: current };
}

async function createSession(
  host: string,
  message: string,
  auth: AuthState,
): Promise<{ sessionId: string; auth: AuthState }> {
  const { response, auth: nextAuth } = await withAuthFetch(
    `${host}/eve/v1/session`,
    { method: "POST", body: JSON.stringify({ message }) },
    auth,
  );
  const data = (await response.json().catch(() => ({}))) as SessionCreateResponse;
  if (!response.ok || !data.sessionId) {
    throw new CliError(
      data.error || `Failed to create Atlas session (${response.status}).`,
      data.code || "ATLAS_SESSION_FAILED",
    );
  }
  return { sessionId: data.sessionId, auth: nextAuth };
}

async function sendFollowUp(
  host: string,
  sessionId: string,
  body: Record<string, unknown>,
  auth: AuthState,
): Promise<AuthState> {
  const { response, auth: nextAuth } = await withAuthFetch(
    `${host}/eve/v1/session/${sessionId}`,
    { method: "POST", body: JSON.stringify(body) },
    auth,
  );
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as SessionCreateResponse;
    throw new CliError(
      data.error || `Atlas request failed (${response.status}).`,
      data.code || "ATLAS_REQUEST_FAILED",
    );
  }
  return nextAuth;
}

function extractText(event: StreamEvent): string | null {
  if (typeof event.text === "string" && event.text) return event.text;
  if (typeof event.delta === "string" && event.delta) return event.delta;
  const content = event.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object" && "text" in part) {
          return String((part as { text: unknown }).text);
        }
        return "";
      })
      .join("");
  }
  const message = event.message;
  if (message && typeof message === "object" && "content" in message) {
    return extractText({ type: "message", content: (message as { content: unknown }).content });
  }
  return null;
}

function isTurnEnd(type: string): boolean {
  return (
    type === "session.waiting" ||
    type === "turn.completed" ||
    type === "session.idle" ||
    type === "turn.cancelled"
  );
}

async function streamTurn(
  host: string,
  sessionId: string,
  auth: AuthState,
  colorEnabled: boolean,
): Promise<{
  auth: AuthState;
  pendingApprovals: Array<{ requestId: string; toolName?: string }>;
}> {
  const { response, auth: nextAuth } = await withAuthFetch(
    `${host}/eve/v1/session/${sessionId}/stream`,
    { method: "GET", headers: { Accept: "application/x-ndjson" } },
    auth,
  );
  if (!response.ok || !response.body) {
    throw new CliError(`Failed to stream Atlas session (${response.status}).`, "ATLAS_STREAM_FAILED");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamed = false;
  let fullMessagePrinted = false;
  const pendingApprovals: Array<{ requestId: string; toolName?: string }> = [];

  const printAssistant = (text: string, asDelta: boolean) => {
    if (!streamed && !fullMessagePrinted) {
      process.stdout.write(`\n${color(colorEnabled, "36", "Atlas")}\n`);
    }
    if (asDelta) {
      process.stdout.write(text);
      streamed = true;
      return;
    }
    if (!streamed) {
      process.stdout.write(`${text}\n`);
      fullMessagePrinted = true;
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let event: StreamEvent;
      try {
        event = JSON.parse(trimmed) as StreamEvent;
      } catch {
        continue;
      }

      const type = event.type;
      if (type === "message.delta" || type === "text.delta" || type === "assistant.delta") {
        const text = extractText(event);
        if (text) printAssistant(text, true);
      } else if (type === "message.completed" || type === "assistant.message" || type === "message") {
        const text = extractText(event);
        if (text) printAssistant(text, false);
      } else if (type === "input.requested") {
        const requests = (event.requests as Array<Record<string, unknown>> | undefined) ?? [];
        for (const req of requests) {
          const requestId = String(req.requestId ?? "");
          if (!requestId) continue;
          pendingApprovals.push({
            requestId,
            toolName: typeof req.toolName === "string" ? req.toolName : undefined,
          });
        }
      }

      if (isTurnEnd(type)) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
        if (streamed) process.stdout.write("\n");
        return { auth: nextAuth, pendingApprovals };
      }
    }
  }

  if (streamed) process.stdout.write("\n");
  return { auth: nextAuth, pendingApprovals };
}

export async function atlasCommand(
  config: RuntimeConfig,
  options: { url?: string; message?: string },
): Promise<string> {
  if (!(process.stdout.isTTY && process.stdin.isTTY) && !options.message) {
    throw new CliError(
      "Atlas interactive mode requires a TTY. Pass --message for a one-shot turn.",
      "ATLAS_TTY_REQUIRED",
    );
  }

  const host = resolveAtlasUrl(options.url);
  const initial = await getValidAccessToken();
  let auth: AuthState = {
    accessToken: initial.accessToken,
    organizationId: initial.organizationId,
  };

  process.stdout.write(`\n${color(config.color, "1", "USEAGENTS ATLAS")}\n\n`);

  let sessionId: string | null = null;

  const runMessage = async (message: string) => {
    if (!sessionId) {
      const created = await createSession(host, message, auth);
      sessionId = created.sessionId;
      auth = created.auth;
    } else {
      auth = await sendFollowUp(host, sessionId, { message }, auth);
    }

    let result = await streamTurn(host, sessionId, auth, config.color);
    auth = result.auth;

    while (result.pendingApprovals.length > 0) {
      const rl = createInterface({ input, output, terminal: Boolean(process.stdout.isTTY) });
      try {
        for (const pending of result.pendingApprovals) {
          const label = pending.toolName ? `Approve ${pending.toolName}?` : "Approve pending action?";
          const answer = (await rl.question(`${label} [y/N] `)).trim().toLowerCase();
          const optionId = answer === "y" || answer === "yes" ? "approve" : "cancel";
          auth = await sendFollowUp(
            host,
            sessionId,
            { inputResponses: [{ requestId: pending.requestId, optionId }] },
            auth,
          );
        }
      } finally {
        rl.close();
      }
      result = await streamTurn(host, sessionId, auth, config.color);
      auth = result.auth;
    }
  };

  if (options.message) {
    await runMessage(options.message);
    if (config.format !== "human") {
      return `${JSON.stringify({ command: "atlas", data: { sessionId, ok: true } })}\n`;
    }
    return "";
  }

  process.stdout.write("Ask Atlas anything about your orgs and tools. Type /exit to quit.\n\n");

  const rl = createInterface({ input, output, terminal: true });
  try {
    while (true) {
      const line = await rl.question("› ");
      const trimmed = line.trim();
      if (!trimmed) continue;
      if (trimmed === "/exit" || trimmed === "/quit") break;
      if (trimmed === "/reset" && sessionId) {
        await withAuthFetch(
          `${host}/eve/v1/session/${sessionId}/reset`,
          { method: "POST", body: "{}" },
          auth,
        ).catch(() => undefined);
        sessionId = null;
        process.stdout.write("Session reset.\n");
        continue;
      }
      try {
        // Pause readline while streaming so prompts do not interleave.
        rl.pause();
        await runMessage(trimmed);
        rl.resume();
      } catch (error) {
        rl.resume();
        const message = error instanceof Error ? error.message : String(error);
        process.stderr.write(`${message}\n`);
      }
    }
  } finally {
    rl.close();
  }

  return "";
}
