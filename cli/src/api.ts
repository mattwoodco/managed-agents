/**
 * Thin client for the Managed Agents proxy server defined in ../server.
 *
 * Every function here assumes the server speaks the contract documented
 * in server/README.md: POST /run -> { sessionId }, GET /stream/:id as SSE.
 */

/**
 * Normalized view of an SSE frame.
 *
 * The Managed Agents stream emits every frame with the default SSE
 * `event: message` name; the real event type lives inside the JSON
 * payload at `data.type`. We expose both so callers (pretty renderer,
 * raw dump) can pick the shape they need without re-parsing.
 */
export type SseEvent = {
  event: string;
  data: string;
  payload?: Record<string, unknown>;
  type?: string;
};

export async function health(baseUrl: string): Promise<unknown> {
	const res = await fetch(`${baseUrl}/health`);
	if (!res.ok) throw new Error(`health ${res.status}: ${await res.text()}`);
	return res.json();
}

export type SessionRecord = {
	id: string;
	agent: string;
	createdAt: string;
	firstMessage: string;
};

export async function listSessions(
	baseUrl: string,
): Promise<SessionRecord[]> {
	const res = await fetch(`${baseUrl}/sessions`);
	if (!res.ok) throw new Error(`sessions ${res.status}: ${await res.text()}`);
	const json = (await res.json()) as { sessions?: SessionRecord[] };
	return json.sessions ?? [];
}

export type RunOptions = {
	agent?: string;
	config?: {
		name?: string;
		model?: string;
		system?: string;
		tools?: unknown[];
	};
};

export async function startRun(
	baseUrl: string,
	text: string,
	opts: RunOptions = {},
): Promise<string> {
	const res = await fetch(`${baseUrl}/run`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ text, agent: opts.agent, config: opts.config }),
	});
	if (!res.ok) throw new Error(`run ${res.status}: ${await res.text()}`);
	const json = (await res.json()) as { sessionId: string };
	return json.sessionId;
}

/**
 * Stream SSE events from the proxy. Yields one parsed event at a time.
 * Terminates on `session.status_idle`, upstream close, or AbortSignal.
 */
export async function* streamSession(
  baseUrl: string,
  sessionId: string,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const res = await fetch(`${baseUrl}/stream/${sessionId}`, { signal });
  if (!res.ok || !res.body) {
    throw new Error(`stream ${res.status}: ${await res.text()}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      let chunk: Awaited<ReturnType<typeof reader.read>>;
      try {
        chunk = await reader.read();
      } catch (err) {
        // Upstream closed the connection after emitting idle. That's
        // the normal terminal state of a Managed Agents session; surface
        // anything else as a real error.
        if (isExpectedStreamClose(err)) return;
        throw err;
      }
      if (chunk.done) return;
      buffer += decoder.decode(chunk.value, { stream: true });

      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const raw = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const evt = parseSseBlock(raw);
        if (!evt) continue;
        yield evt;
        if (evt.type === "session.status_idle") return;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function isExpectedStreamClose(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const msg = String((err as { message?: unknown }).message ?? err);
  return (
    msg.includes("socket connection was closed") ||
    msg.includes("The operation was aborted") ||
    msg.includes("terminated")
  );
}

function parseSseBlock(raw: string): SseEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  const data = dataLines.join("\n");
  if (!data) return null;

  let payload: Record<string, unknown> | undefined;
  let type: string | undefined;
  try {
    const parsed = JSON.parse(data);
    if (parsed && typeof parsed === "object") {
      payload = parsed as Record<string, unknown>;
      if (typeof payload.type === "string") type = payload.type;
    }
  } catch {
    // non-JSON data is legal SSE; leave payload undefined
  }
  return { event, data, payload, type };
}

/**
 * Best-effort extraction of human-readable text from an agent event.
 * The Managed Agents event schema is rich; we care about surfacing
 * `agent.message` text deltas cleanly while leaving room to fall back
 * to the raw JSON for anything we don't recognize.
 */
export function extractText(evt: SseEvent): string | null {
  const obj = evt.payload;
  if (!obj) return null;

  const content = obj.content;
  if (Array.isArray(content)) {
    const parts: string[] = [];
    for (const block of content) {
      if (
        block &&
        typeof block === "object" &&
        (block as { type?: string }).type === "text" &&
        typeof (block as { text?: unknown }).text === "string"
      ) {
        parts.push((block as { text: string }).text);
      }
    }
    if (parts.length) return parts.join("");
  }

  if (typeof obj.text === "string") return obj.text;
  if (typeof obj.delta === "string") return obj.delta;
  return null;
}
