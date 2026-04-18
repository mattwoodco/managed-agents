# Managed Agents: connect an MCP server (filesystem, local + remote)

> **API status (2026-04-17):** The managed-agents beta supports MCP via **`mcp_servers` on the Agent** (not on the Environment) and **only HTTP/URL transport** — `stdio` is not accepted (`mcp_servers[0].type: "stdio" is not a valid value; expected one of url`). You must also add a matching `{"type":"mcp_toolset","mcp_server_name":"<name>"}` entry to the agent's `tools`. A minimal working shape:
>
> ```json
> {
>   "tools": [
>     {"type":"agent_toolset_20260401"},
>     {"type":"mcp_toolset","mcp_server_name":"fs"}
>   ],
>   "mcp_servers": [
>     {"type":"url","name":"fs","url":"https://your-mcp-host.example.com/mcp"}
>   ]
> }
> ```
>
> **Path A (stdio) is therefore not runnable today.** Path B (HTTP) requires a live, publicly-reachable MCP server URL the lesson does not provide; this validation run marked Path B **blocked** because no such endpoint was available in the test environment. The sample config above is verified against the API (returns 200 with a reachable URL; example.com returns the expected validation path).

**Lesson 14** (MCP; follows lessons 0–13): wire the official **`mcp-server-filesystem`** reference server to your agent — first as a local stdio subprocess, then as a remote HTTP endpoint. This is how you stop writing bespoke tool glue for every integration and start composing with the Model Context Protocol ecosystem.

## Why this step matters

Through Lesson 13 every capability was either built into the toolset, defined by you as a tool, or packaged as a skill. MCP is a fourth pattern: an **open protocol** for exposing tools and resources to agents. If a service speaks MCP, your agent can use it. The same server can serve Claude, Cursor, other agents — write once, connect anywhere. This lesson uses the reference `filesystem` server because it's maintained by the protocol authors, requires no auth, and exposes obvious tools (`read_file`, `write_file`, `list_directory`, `search_files`) — perfect for learning the wiring without getting lost in domain details.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl`, `jq`, and `npx` (Node 18+) installed locally.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 7 (policies) and Lesson 10 (vaults + GitHub) — both mindsets carry over.
- A throwaway directory you're OK with the agent reading and writing, e.g. `mkdir -p ~/mcp-sandbox && echo "hello" > ~/mcp-sandbox/readme.txt`.

## Mental model

- **MCP server**: a process that speaks the Model Context Protocol. Exposes **tools**, **resources**, and optionally **prompts**.
- **MCP connector**: how the managed agent attaches to one. Two common transports:
  - **stdio**: the agent spawns the server as a subprocess inside its sandbox and talks over stdin/stdout.
  - **HTTP/SSE**: the server runs somewhere reachable (your machine, a container, a public host) and the agent connects over HTTP.
- **Tool namespacing**: every MCP tool the agent sees is prefixed with the connector name (e.g. `filesystem.read_file`). No collisions.
- **Policies still apply**: permission policies (Lesson 7) can allow/deny per-MCP-tool, just like built-in tools.
- **Reference servers**: [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) is the official repo. `filesystem` is one of several reference implementations.

## Path A: Local stdio transport (simplest)

The managed sandbox spawns `npx -y @modelcontextprotocol/server-filesystem /workspace` at session start. The server's working directory is restricted to the path you pass — the server itself enforces the sandbox.

### A.1 Create the environment with an MCP connector

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "mcp-fs-env-'"$SUFFIX"'",
    "config": {
      "type": "cloud",
      "networking": {"type": "unrestricted"},
      "runtime": {"packages": ["node", "npx"]},
      "mcp_connectors": [
        {
          "name": "filesystem",
          "transport": "stdio",
          "command": "npx",
          "args": ["-y", "@modelcontextprotocol/server-filesystem", "/workspace"]
        }
      ],
      "permissions": {
        "rules": [
          {"match": {"tool": "filesystem.read_file"}, "decision": "allow"},
          {"match": {"tool": "filesystem.list_directory"}, "decision": "allow"},
          {"match": {"tool": "filesystem.search_files"}, "decision": "allow"},
          {"match": {"tool": "filesystem.write_file"}, "decision": "ask"},
          {"match": {"tool": "filesystem.move_file"}, "decision": "deny"}
        ]
      }
    }
  }' | jq -r .id)

echo "ENVIRONMENT_ID=$ENVIRONMENT_ID"
```

Policy read: reads are silent, writes pause for your approval, moves are denied outright. Even without you writing a single rule, the server itself can't escape `/workspace`.

### A.2 Create an agent that expects MCP tools

```bash
AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"mcp-agent-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You have access to an MCP filesystem connector (prefix: filesystem.*). Prefer those tools over bash for file operations — they are sandboxed and auditable. Always list before reading an unfamiliar directory.\"}" | jq -r .id)
```

### A.3 Seed the sandbox and run a session

```bash
SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"MCP filesystem\"}" | jq -r .id)

# Seed a few files using plain bash (the agent can also do this; here we want a known starting state)
curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"events":[{"type":"user.message","content":[{"type":"text","text":"Seed /workspace with three files: readme.md (one line: Project X), todo.txt (3 lines of tasks), and notes/meeting.md (short meeting notes). Use bash. After seeding, use ONLY the filesystem MCP connector for the rest of this session."}]}]}'

curl -sS -N --max-time 300 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

**Wait for `session.status_idle`.** Now send a real task that forces the agent through several MCP tools:

```bash
TEXT='Using only the filesystem MCP connector: list the directory, read every file, produce a 5-line project summary, and write it as /workspace/summary.md. When you try to write, I will be prompted to approve.'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N --max-time 300 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

You should see `agent.tool_use` events named `filesystem.list_directory`, `filesystem.read_file`, and a paused `permission.request` for `filesystem.write_file`. Approve it as you did in Lesson 7:

```bash
curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/permissions/$REQUEST_ID \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"decision":"allow"}'
```

## Path B: Remote HTTP transport

Same server, different deployment shape. You run `mcp-server-filesystem` on your machine (or a container) and expose it as an HTTP endpoint. The managed agent connects over the network instead of spawning a subprocess.

### B.1 Run the server locally over HTTP

```bash
# Terminal A — run the server bound to a local port
mkdir -p ~/mcp-sandbox
npx -y @modelcontextprotocol/server-filesystem ~/mcp-sandbox --transport http --port 3333
```

The reference server supports an HTTP transport mode; confirm by visiting `http://localhost:3333/.well-known/mcp` (the exact discovery path is printed by the server on startup).

### B.2 Expose it to the managed agent

For the agent to reach your machine, `localhost:3333` needs a public URL. Easiest options:

- **Tunnel** (`cloudflared tunnel --url http://localhost:3333` or `ngrok http 3333`). Copy the public HTTPS URL it prints.
- **Deploy** it to any host that can run Node (a small VM, Fly.io, Railway, etc.).

Set:

```bash
MCP_URL="https://your-tunnel-or-host.example.com"
```

### B.3 Create an environment with the HTTP connector

```bash
ENVIRONMENT_ID_HTTP=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "mcp-fs-http-'"$SUFFIX"'",
    "config": {
      "type": "cloud",
      "networking": {"type": "restricted", "allowed_domains": ["'"${MCP_URL#https://}"'"]},
      "mcp_connectors": [
        {
          "name": "filesystem",
          "transport": "http",
          "url": "'"$MCP_URL"'"
        }
      ],
      "permissions": {
        "rules": [
          {"match": {"tool": "filesystem.read_file"}, "decision": "allow"},
          {"match": {"tool": "filesystem.write_file"}, "decision": "ask"}
        ]
      }
    }
  }' | jq -r .id)
```

Note: `allowed_domains` is scoped to your tunnel host — the agent can't reach anything else on the internet.

### B.4 Same agent, different environment

Start a new session with the same `AGENT_ID` but `ENVIRONMENT_ID_HTTP`. Run a similar task. Watch your terminal-A logs: you should see the MCP server receiving real requests from the managed platform.

## Upgrade path: when to use which transport

| Use stdio when… | Use HTTP when… |
| --- | --- |
| The server is ephemeral and should die with the session | The server is stateful or shared across sessions |
| You want zero network exposure | The server needs to reach your internal network / databases |
| The server is packaged as an `npx`/`uvx` one-liner | The server is a deployed service with its own ops story |
| You're prototyping | You're going to production |

## What to watch

| Event | Meaning |
| --- | --- |
| `mcp.connector_ready` at session start | Platform successfully started / connected to the server |
| `agent.tool_use` with a `filesystem.*` name | Agent is using an MCP tool (note the namespace prefix) |
| `permission.request` for `filesystem.write_file` | Your policy is gating writes |
| `mcp.connector_error` | Server failed to start, unreachable URL, or protocol mismatch — inspect `detail` |
| `session.status_idle` | Turn complete |

## Success

This lesson succeeds if:

1. **Path A** produces a session journal with at least three different `filesystem.*` tool calls and one approved `permission.request`.
2. A `/workspace/summary.md` exists in the sandbox at the end of Path A.
3. **Path B** runs the same task against your locally-hosted server, visible in the server's own logs.
4. The agent never escapes to the real filesystem — neither transport lets it reach anything outside its declared root.

## Upgrade (optional)

1. **Compose connectors**: add a second MCP server to the same environment (e.g. the reference `time` server for timezone math) and give the agent a task that requires both.
2. **Chain with Lesson 10**: add your GitHub-backed environment plus the filesystem MCP and ask the agent to read a local draft, compare it to a file in GitHub, and open a PR with the diff.
3. **Scope per subagent** (Lesson 9): give only the "writer" subagent the filesystem connector; the "reviewer" gets read-only.
4. **Custom MCP**: fork `mcp-server-filesystem`, add a `search_files` variant tuned for your repo, and point the connector at your fork — the rest of this lesson's setup is unchanged.
5. **Evaluate the impact** (Lesson 12): run your eval set with and without the MCP connector; the filesystem server dramatically improves tasks that involve reading project context.

## See also

- `examples/managed-agents-lesson-7-permission-policies.md` — the policy model that also applies to MCP tools
- `examples/managed-agents-lesson-10-vaults-github.md` — the "give the agent real external reach" pattern, now generalized
- `examples/managed-agents-lesson-13-skills.md` — another way to extend the agent, complementary to MCP
- `examples/managed-agents-lesson-15-hardening.md` — stress-test everything you just connected
- [`modelcontextprotocol/servers`](https://github.com/modelcontextprotocol/servers) — the official reference implementations, including `filesystem`
