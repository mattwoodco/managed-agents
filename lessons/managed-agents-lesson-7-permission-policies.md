# Managed Agents: add guardrails with permission policies

**Lesson 7** (permission policies; follows lessons 0–6): constrain what your agent is allowed to do. You'll take the same research-style agent from earlier lessons and wrap it in a policy that pauses for human approval before dangerous tool calls, and restrict outbound network access on the environment. This is the first step from "it works on my prompt" toward "it's safe to hand to a user."

## Why this step matters

So far every environment has been `networking: unrestricted` and every tool call ran without asking. That is fine for exploration but unacceptable once sessions run unattended, handle user data, or live behind a product surface. Permission policies let you declare, up front, which tool calls auto-run and which require a human confirmation, and which network hosts are reachable — enforced by the platform, not by prompt text.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- You have completed Lesson 4 (reusable agent) or are comfortable creating an agent and environment.

## Mental model

- **Tool permission policy**: lives on the **agent**'s tool configuration. Each tool has a `default_config.permission_policy` and an optional list of per-tool `configs` overrides.
- **Decision types**: `always_allow` (auto-run) or `always_ask` (pause and wait for a `user.tool_confirmation` event). There is no standing `deny` — to refuse, reply to the request with `result: "deny"`, or set `enabled: false` on the specific tool config so the model never sees it.
- **Network scope**: lives on the **environment**. `networking.type` is either `unrestricted` or `limited`. A `limited` network can list `allowed_hosts`, and toggle `allow_mcp_servers` / `allow_package_managers`.
- **Runtime event flow**: when a tool call resolves to `ask`, the stream emits an `agent.tool_use` with `evaluated_permission: "ask"` and the session goes to `session.status_idle` with `stop_reason.type: "requires_action"`. You resume it by posting a `user.tool_confirmation` event that references the `tool_use_id`.

## Setup: a reusable agent with an "ask by default" policy

The agent below asks before running *any* tool, and specifically disables the `bash` tool entirely so destructive shell commands never reach a prompt.

```bash
SUFFIX=$(date +%s)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "guarded-agent-'"$SUFFIX"'",
    "model": "claude-opus-4-6",
    "tools": [{
      "type": "agent_toolset_20260401",
      "default_config": {"enabled": true, "permission_policy": {"type": "always_ask"}},
      "configs": [
        {"name": "bash", "enabled": false, "permission_policy": {"type": "always_ask"}}
      ]
    }],
    "system": "You are a careful research assistant. When a tool call is denied or a tool is unavailable, explain what you would have done and suggest a safer alternative."
  }' | jq -r .id)

echo "AGENT_ID=$AGENT_ID"
```

## Step 1: Create a network-restricted environment

Here the environment restricts outbound traffic to a small allow-list, and blocks package managers and MCP.

```bash
ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "restricted-env-'"$SUFFIX"'",
    "config": {
      "type": "cloud",
      "networking": {
        "type": "limited",
        "allowed_hosts": ["api.github.com", "en.wikipedia.org"],
        "allow_mcp_servers": false,
        "allow_package_managers": false
      }
    }
  }' | jq -r .id)

echo "ENVIRONMENT_ID=$ENVIRONMENT_ID"
```

**What you just declared:**

| Layer | Rule | Effect |
| --- | --- | --- |
| Agent tool | `bash` disabled | Model will not attempt shell commands at all |
| Agent tool | Every other tool `always_ask` | Pauses with `requires_action` before each call |
| Environment | `networking.type = limited` | Only `api.github.com` and `en.wikipedia.org` are reachable |
| Environment | `allow_package_managers = false` | `pip install`/`npm i` style installs blocked |

## Step 2: Run a session that will hit the policy

Start a session and give the agent a prompt that tempts it to do something that requires approval.

```bash
SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Policy test\"}" | jq -r .id)

TEXT='List the files in the working directory, then fetch https://example.com/data.json and summarize it. If a step is blocked, explain why and continue with what you can do.'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N --max-time 120 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

You will see the stream end with an `agent.tool_use` (likely `web_fetch` or another built-in) carrying `evaluated_permission: "ask"`, followed by `session.status_idle` with `stop_reason.type: "requires_action"` and the list of `event_ids` that need decisions.

## Step 3: Approve or deny at runtime

Grab the `agent.tool_use` IDs from the `requires_action` stop reason and resolve each with a `user.tool_confirmation` event. `result` is `"allow"` or `"deny"`.

```bash
# Replace these with the event IDs printed at the end of Step 2's stream.
TOOL_USE_ID_1=sevt_...       # the call you want to approve
TOOL_USE_ID_2=sevt_...       # the call you want to deny

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"events\":[
    {\"type\":\"user.tool_confirmation\",\"tool_use_id\":\"$TOOL_USE_ID_1\",\"result\":\"allow\"},
    {\"type\":\"user.tool_confirmation\",\"tool_use_id\":\"$TOOL_USE_ID_2\",\"result\":\"deny\"}
  ]}"

# Re-stream to see the session resume.
curl -sS -N --max-time 120 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

The session resumes after your decisions; denied calls come back to the model as tool errors and the agent routes around them.

## What to watch

| Event | Meaning |
| --- | --- |
| `agent.tool_use` with `evaluated_permission: "ask"` | Policy requires confirmation |
| `session.status_idle` with `stop_reason.type: "requires_action"` | One or more tool calls are waiting; `stop_reason.event_ids` lists them |
| `user.tool_confirmation` | Your approval or denial (echoed back in the journal) |
| Subsequent `agent.tool_result` with `is_error: true` | The denied call, surfaced to the model |
| `agent.message` | The agent reasons about what was blocked and adapts |
| `session.status_idle` (no `requires_action`) | Turn complete |

## Success

This lesson succeeds if:

1. The first stream ends at a `requires_action` idle, not a clean completion.
2. You resolve the pending tool uses with `user.tool_confirmation` events and the session resumes.
3. The agent's final message acknowledges what it could and could not do, without you re-prompting.

## Upgrade (optional)

1. **Per-tool allow list**: keep `default_config.permission_policy = always_ask` but add `configs` entries like `{"name": "web_search", "permission_policy": {"type": "always_allow"}}` to auto-approve low-risk tools.
2. **Two environments, one agent**: run the same session prompt against a `limited` env and an `unrestricted` env and diff the journals.
3. **Approve from a UI**: wire the `requires_action` idle events into a small web app so a human reviewer clicks allow/deny and posts `user.tool_confirmation` back.
4. **Audit log**: after the session ends, `GET /sessions/{id}/events` and grep for `user.tool_confirmation` and `evaluated_permission` to produce a compliance trail.

## See also

- `examples/managed-agents-lesson-4-reusable-agent.md` — the agent you're now wrapping in a policy
- `examples/managed-agents-lesson-6-real-files.md` — once files are involved, policies matter more
- `examples/managed-agents-lesson-8-define-outcomes.md` — pair guardrails with success criteria
