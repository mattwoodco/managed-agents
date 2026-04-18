/**
 * Managed Agents proxy. Single file, Bun runtime.
 *
 * Hides ANTHROPIC_API_KEY from callers, lazily mints one agent + one
 * environment per named profile, creates a fresh session per /run call,
 * sends the user message, and streams the SSE event feed back untouched.
 *
 * Also records recent session ids in memory so `GET /sessions` can list
 * them, and emits one JSON line per request/event to stdout for the CLI
 * log tail.
 *
 * Endpoints:
 *   GET  /              -> minimal HTML chat page
 *   GET  /health        -> liveness + cached agent/env IDs
 *   GET  /sessions      -> recent sessions (in-memory, bounded)
 *   POST /run           -> { text, agent?, config? } -> { sessionId }
 *   GET  /stream/:id    -> SSE pass-through of /v1/sessions/:id/events/stream
 *
 * Run:
 *   bun --env-file=../.env.local run server.ts
 */

const API = "https://api.anthropic.com";
const BETA = "managed-agents-2026-04-01";
const DEFAULT_MODEL = "claude-opus-4-6";
const DEFAULT_SYSTEM = "You are a concise, helpful assistant.";
const DEFAULT_TOOLS: unknown[] = [{ type: "agent_toolset_20260401" }];

const API_KEY = process.env.ANTHROPIC_API_KEY;
if (!API_KEY) {
	log({ level: "fatal", msg: "missing ANTHROPIC_API_KEY" });
	process.exit(1);
}

const anthropicHeaders = {
	"x-api-key": API_KEY,
	"anthropic-version": "2023-06-01",
	"anthropic-beta": BETA,
	"content-type": "application/json",
};

type AgentConfig = {
	name?: string;
	model?: string;
	system?: string;
	tools?: unknown[];
};

type CachedAgent = {
	agentId: string;
	environmentId: string;
	config: Required<Pick<AgentConfig, "model" | "system">> & {
		name: string;
		tools: unknown[];
	};
};

/** keyed by profile name ("default", "research", …) */
const agents = new Map<string, CachedAgent>();

type SessionRecord = {
	id: string;
	agent: string;
	createdAt: string;
	firstMessage: string;
};
const SESSIONS_CAP = 50;
const sessions: SessionRecord[] = [];

function log(entry: Record<string, unknown>): void {
	process.stdout.write(
		JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
	);
}

async function anthropic<T>(path: string, body?: unknown): Promise<T> {
	const res = await fetch(`${API}${path}`, {
		method: body ? "POST" : "GET",
		headers: anthropicHeaders,
		body: body ? JSON.stringify(body) : undefined,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Anthropic ${res.status} on ${path}: ${text}`);
	}
	return (await res.json()) as T;
}

async function ensureAgent(
	profile: string,
	overrides: AgentConfig,
): Promise<CachedAgent> {
	const existing = agents.get(profile);
	if (existing) return existing;

	const suffix = Date.now();
	const name = overrides.name ?? `proxy-${profile}-${suffix}`;
	const model = overrides.model ?? DEFAULT_MODEL;
	const system = overrides.system ?? DEFAULT_SYSTEM;
	const tools = overrides.tools ?? DEFAULT_TOOLS;

	const agent = await anthropic<{ id: string }>("/v1/agents", {
		name,
		model,
		tools,
		system,
	});
	log({ level: "info", msg: "agent created", profile, id: agent.id, model });

	const env = await anthropic<{ id: string }>("/v1/environments", {
		name: `proxy-${profile}-env-${suffix}`,
		config: { type: "cloud", networking: { type: "unrestricted" } },
	});
	log({ level: "info", msg: "env created", profile, id: env.id });

	const record: CachedAgent = {
		agentId: agent.id,
		environmentId: env.id,
		config: { name, model, system, tools },
	};
	agents.set(profile, record);
	return record;
}

async function startSessionAndSend(
	profile: string,
	text: string,
	config: AgentConfig,
): Promise<string> {
	const { agentId, environmentId } = await ensureAgent(profile, config);
	const session = await anthropic<{ id: string }>("/v1/sessions", {
		agent: agentId,
		environment_id: environmentId,
	});
	await anthropic(`/v1/sessions/${session.id}/events`, {
		events: [{ type: "user.message", content: [{ type: "text", text }] }],
	});

	sessions.unshift({
		id: session.id,
		agent: profile,
		createdAt: new Date().toISOString(),
		firstMessage: text.slice(0, 140),
	});
	if (sessions.length > SESSIONS_CAP) sessions.length = SESSIONS_CAP;

	log({
		level: "info",
		msg: "session created",
		profile,
		sessionId: session.id,
	});
	return session.id;
}

async function proxyStream(sessionId: string): Promise<Response> {
	const upstream = await fetch(
		`${API}/v1/sessions/${sessionId}/events/stream`,
		{
			headers: {
				"x-api-key": API_KEY!,
				"anthropic-version": "2023-06-01",
				"anthropic-beta": BETA,
			},
		},
	);
	if (!upstream.ok || !upstream.body) {
		const body = await upstream.text();
		log({ level: "error", msg: "upstream stream failed", sessionId, status: upstream.status, body });
		return new Response(`upstream error: ${upstream.status} ${body}`, {
			status: 502,
		});
	}
	return new Response(upstream.body, {
		status: 200,
		headers: {
			"content-type": "text/event-stream",
			"cache-control": "no-cache, no-transform",
			connection: "keep-alive",
		},
	});
}

const INDEX_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Managed Agents proxy</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
  #log { white-space: pre-wrap; background: #0b0b0b; color: #e6e6e6; padding: 1rem; border-radius: 6px; min-height: 200px; font-family: ui-monospace, monospace; font-size: 12px; }
  form { display: flex; gap: .5rem; margin-top: 1rem; }
  input { flex: 1; padding: .5rem; font-size: 1rem; }
  button { padding: .5rem 1rem; }
</style>
</head>
<body>
<h1>Managed Agents proxy</h1>
<p>Type a prompt. The server creates a session and streams the raw event feed below.</p>
<div id="log"></div>
<form id="f">
  <input id="q" placeholder="Ask something..." autocomplete="off" required />
  <button>Send</button>
</form>
<script>
const logEl = document.getElementById('log');
const append = (s) => { logEl.textContent += s; logEl.scrollTop = logEl.scrollHeight; };
document.getElementById('f').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = document.getElementById('q');
  const text = q.value; q.value = ''; q.disabled = true;
  append('\\n\\n>>> ' + text + '\\n');
  const r = await fetch('/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text }) });
  if (!r.ok) { append('error: ' + await r.text()); q.disabled = false; return; }
  const { sessionId } = await r.json();
  append('session: ' + sessionId + '\\n');
  const es = new EventSource('/stream/' + sessionId);
  es.onmessage = (ev) => append(ev.data + '\\n');
  es.addEventListener('session.status_idle', () => { es.close(); q.disabled = false; q.focus(); });
  es.onerror = () => { es.close(); q.disabled = false; q.focus(); };
});
</script>
</body>
</html>`;

const server = Bun.serve({
	port: Number(process.env.PORT ?? 8787),
	// Managed Agents sessions routinely take minutes; the default 10s
	// idle timeout closes the SSE stream mid-turn. Cap at 10 minutes.
	idleTimeout: 255,
	async fetch(req) {
		const url = new URL(req.url);
		const t0 = Date.now();

		const respond = (res: Response): Response => {
			log({
				level: "info",
				msg: "req",
				method: req.method,
				path: url.pathname,
				status: res.status,
				ms: Date.now() - t0,
			});
			return res;
		};

		if (url.pathname === "/" && req.method === "GET") {
			return respond(
				new Response(INDEX_HTML, {
					headers: { "content-type": "text/html; charset=utf-8" },
				}),
			);
		}

		if (url.pathname === "/health") {
			const cache = Object.fromEntries(
				Array.from(agents.entries()).map(([k, v]) => [
					k,
					{ agentId: v.agentId, environmentId: v.environmentId, model: v.config.model },
				]),
			);
			return respond(Response.json({ ok: true, cache, sessions: sessions.length }));
		}

		if (url.pathname === "/sessions") {
			return respond(Response.json({ sessions }));
		}

		if (url.pathname === "/run" && req.method === "POST") {
			try {
				const body = (await req.json()) as {
					text?: string;
					agent?: string;
					config?: AgentConfig;
				};
				if (!body.text?.trim()) {
					return respond(new Response("missing text", { status: 400 }));
				}
				const profile = body.agent?.trim() || "default";
				const sessionId = await startSessionAndSend(
					profile,
					body.text,
					body.config ?? {},
				);
				return respond(Response.json({ sessionId, agent: profile }));
			} catch (err) {
				log({ level: "error", msg: "run failed", err: String(err) });
				return respond(new Response(String(err), { status: 500 }));
			}
		}

		if (url.pathname.startsWith("/stream/") && req.method === "GET") {
			const sessionId = url.pathname.slice("/stream/".length);
			if (!sessionId)
				return respond(
					new Response("missing session id", { status: 400 }),
				);
			return respond(await proxyStream(sessionId));
		}

		return respond(new Response("not found", { status: 404 }));
	},
});

log({ level: "info", msg: "listening", url: `http://localhost:${server.port}` });
