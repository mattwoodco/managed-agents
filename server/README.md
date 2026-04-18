# Minimal Managed Agents proxy

A single-file Bun server that upgrades the `curl` lessons in `examples/` into something a browser can talk to safely.

## What it does

- Holds `ANTHROPIC_API_KEY` on the server. The browser never sees it.
- Lazily creates one shared `agent` and one `environment` on first request, caches the IDs in memory.
- `POST /run` creates a fresh `session`, posts the user message, returns the session id.
- `GET /stream/:sessionId` pass-through proxies the Managed Agents SSE feed to the browser.
- Serves a tiny HTML page at `/` so you can try it end to end.

## What it deliberately does NOT do

- No database. Agent/env IDs live in process memory and are lost on restart.
- No auth. Put it behind your own auth or a VPN before using it publicly.
- No retries, no rate limiting, no multi-tenant concerns.
- No translation of SSE payloads. The browser sees the raw Managed Agents event stream.

This is Tier 1 on purpose. When you need persistence or auth, upgrade.

## Run it

```bash
cd server
bun --env-file=../.env.local run server.ts
```

Open <http://localhost:8787> and send a prompt. The raw event stream renders inline.

## Endpoints

| Method | Path              | Purpose                                              |
| ------ | ----------------- | ---------------------------------------------------- |
| GET    | `/`               | Minimal HTML chat page                               |
| POST   | `/run`            | Body `{ "text": "..." }` -> `{ "sessionId": "..." }` |
| GET    | `/stream/:id`     | SSE pass-through of the session event stream         |
| GET    | `/health`         | Liveness + cached agent/environment IDs              |

## Customize

- `MODEL` constant in `server.ts` swaps the model.
- The `system` prompt inside `ensureAgentAndEnv()` changes agent behavior.
- Add more tools by editing the `tools` array. Remove `agent_toolset_20260401` and add e.g. `{ "type": "bash" }` to constrain capability.

## Upgrade path

- **Persist IDs**: swap the `cache` object for `bun:sqlite`. One table, two rows.
- **Multi-agent**: key the cache by agent name, expose `/run?agent=foo`.
- **Auth**: add a `Authorization: Bearer` check at the top of `fetch(req)`.
- **Deploy**: this file runs unmodified on Fly.io, Railway, or any Bun-capable host.
