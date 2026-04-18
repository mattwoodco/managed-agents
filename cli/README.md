# clapp CLI

A command-line interface, built with [@stacksjs/clapp](https://clapp.sh), that talks to the local Managed Agents proxy server in `../server`. The CLI never calls Anthropic directly — it always goes through the proxy, so your API key stays on the server.

## Install

```bash
cd cli
bun install
chmod +x src/index.ts
```

Optional: expose a global `clapp` binary.

```bash
cd cli
bun link
clapp --help
```

## Quickstart

```bash
# one-liner: check env, auto-start the proxy, send a prompt
bun run src/index.ts doctor
bun run src/index.ts ask "Reply with the single word: ack"
```

You don't have to start the proxy manually — any user-facing command auto-starts it on first run if the URL points at `localhost`.

## Commands

| Command                         | Purpose                                                                 |
| ------------------------------- | ----------------------------------------------------------------------- |
| `ask <text>`                    | One-shot prompt, streams the answer to stdout, exits on idle.           |
| `chat`                          | Interactive REPL loop. Empty line or Ctrl+C exits.                      |
| `run <file>`                    | Load a prompt from a text or markdown file (supports frontmatter).      |
| `health`                        | GET `/health` on the proxy and pretty-print the response.               |
| `sessions`                      | List recent sessions recorded in the proxy's in-memory log.             |
| `logs [--follow] [-n <lines>]`  | Tail `~/.clapp-proxy.log`, pretty-printing structured JSON lines.       |
| `init`                          | Scaffold `.clapp/config.json` in the current directory.                 |
| `doctor`                        | Check Bun, API key, server source, proxy reachability, Anthropic auth.  |
| `config:list` / `:path`         | List the user config or print its path (`~/.clapprc.json`).             |
| `config:get <key>` / `:set`     | Get or set dotted keys (`agents.default.model`, `url`, etc).            |
| `server:start` / `:stop` / `:status` | Manage the proxy background process.                               |

## Global flags

- `-u, --url <url>` — proxy base URL (default from config, falls back to `http://localhost:8787`).
- `--raw` — print raw SSE frames instead of pretty-printed text.
- `--agent <name>` — choose an agent profile (see "Config").

## Config

Three layers, highest wins:

1. **CLI flags** (`--url`, `--agent`, etc.)
2. **Project config** at `.clapp/config.json`, walked up from cwd. Created by `clapp init`.
3. **User config** at `~/.clapprc.json`. Edited via `clapp config:set`.
4. Hard-coded defaults.

Example `.clapp/config.json`:

```json
{
  "agent": "research",
  "agents": {
    "research": {
      "name": "clapp-research",
      "model": "claude-opus-4-6",
      "system": "You are a research assistant…"
    }
  }
}
```

Agents are minted lazily on first use per profile name, and the proxy caches the resulting `agent_id` + `environment_id` in memory for the life of the server process.

## Running prompts from files

```markdown
---
agent: research
model: claude-opus-4-6
---
Find 5 affordable colleges in California with strong engineering programs.
```

```bash
clapp run prompt.md
```

Frontmatter keys `agent`, `model`, `system`, and `name` are supported. Unknown keys are ignored. Without frontmatter the whole file is sent as the prompt body.

## Env autoload

On startup the CLI walks up from cwd looking for `.env.local` then `.env`, and loads any missing variables into `process.env`. `ANTHROPIC_API_KEY` only needs to exist for `doctor` — normal traffic goes through the proxy, which has its own env file.

## Structured logs

The proxy writes one JSON object per line to `~/.clapp-proxy.log`:

```
{"ts":"2026-04-17T04:45:06.425Z","level":"info","msg":"req","method":"GET","path":"/health","status":200,"ms":0}
```

`clapp logs` pretty-prints those; pass `--raw` to get the raw JSON, or `--follow` to tail.

## Build a standalone binary

```bash
bun run build
./dist/clapp --help
```

Produces `dist/clapp` as a single-file executable (~60 MB) with no Bun dependency on the target machine.

## How it works

```
clapp CLI  ──HTTP──▶  proxy (Bun, server/server.ts)  ──HTTPS──▶  api.anthropic.com
           (http://localhost:8787)                    (x-api-key held here)
```

- `POST /run` mints a session and posts the user message.
- `GET /stream/:sessionId` pipes the SSE event feed through.
- Every SSE frame uses the nameless `event: message` default; the real event type lives at `data.type`. The CLI renders `agent.message` text blocks inline and surfaces everything else as dim `[type]` markers unless `--raw` is set.

## Files

```
cli/
  src/
    index.ts              entrypoint (CAC-style clapp registrations)
    api.ts                fetch-based proxy client + SSE parser
    render.ts             pretty vs --raw rendering
    config.ts             layered config resolution
    env.ts                .env autoload helpers
    paths.ts              single source of truth for filesystem paths
    server-control.ts     background process lifecycle
    ensure-proxy.ts       auto-start on any user-facing command
    commands/
      init.ts             clapp init
      logs.ts             clapp logs
      sessions.ts         clapp sessions
      config.ts           clapp config:*
      doctor.ts           clapp doctor
      run-file.ts         clapp run <file> (frontmatter parser)
```

## Upgrade path

- **Multi-turn**: `--session <id>` on `ask` once the proxy exposes a "continue" endpoint.
- **SQLite persistence**: swap the in-memory agent/session cache in the proxy so restarts don't leak.
- **Auth**: add an `Authorization: Bearer` check in the proxy once it's exposed beyond localhost.
- **Completions**: wire up clapp's completion generator once the command surface stabilizes.
