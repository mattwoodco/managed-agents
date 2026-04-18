# Managed Agents: tool-using agent

**Lesson 2** (tool-using agent): one agent with `agent_toolset_20260401`, unrestricted networking, and a task that should force a write, a command run, and a verification step. The key lesson here is that the event stream is a runtime trace, not just a chat transcript.

## Why this step matters

Lessons 0 and 1 can feel like "chat with extra steps." This one shows what changes when the agent actually uses tools. You are no longer only inspecting the final answer; you are watching the execution path that produced it.

## Prerequisites

- Same setup as `examples/managed-agents-lesson-0-hello-world.md`: `ANTHROPIC_API_KEY`, `curl`, `jq`, and `anthropic-beta: managed-agents-2026-04-01` on every request.

## Task

> Create a Node.js script that fetches a webpage and extracts all links, save to `links.json`

## Run this

```bash
USER_TEXT='Create a Node.js script that fetches a webpage and extracts all links, save to links.json'
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"tool-agent-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"tool-agent-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a careful coding agent. Use tools to write files, run commands, and verify results.\"}" | jq -r .id)

SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\"}" | jq -r .id)

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$USER_TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to watch

| Observed event | Meaning |
| --- | --- |
| `session.status_running` | Work has started |
| `user.message` | Your prompt appears in the journal |
| `span.model_request_start` / `span.model_request_end` | Model round-trips, often with token usage on the end event |
| `agent.thinking` | Optional reasoning span |
| `agent.tool_use` | Planned tool action such as `bash`, `write`, or `read` |
| `agent.tool_result` | Output from the tool call, paired to the corresponding tool use |
| `agent.message` | Assistant text back to the user |
| `session.status_idle` | The session has finished its turn |

Expect several `agent.tool_use` and `agent.tool_result` pairs before the session reaches idle.

## Success

This example is doing its job if the stream contains real non-chat events such as `agent.tool_use`, `agent.tool_result`, and span events before it ends with `session.status_idle`. In a good run, the agent should create the script, run it, and verify the output.

## Upgrade (optional)

Change the environment to `"networking": { "type": "limited" }` (optionally with an `allowed_hosts` list) and rerun the example. That gives you a clean teaching moment about why environment policy matters once tools are involved.

## See also

- `examples/managed-agents-lesson-0-hello-world.md` for the minimal baseline flow
- `examples/managed-agents-lesson-1-prompt-playground.md` for prompt-only comparison before tools
- `examples/managed-agents-lesson-3-multi-step-session.md` for multi-turn work in one session
- `managed-agents-lesson.md` for the deeper API explanation
