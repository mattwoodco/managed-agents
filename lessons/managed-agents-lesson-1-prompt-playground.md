# Managed Agents: prompt playground

**Lesson 1** (prompt playground): keep the user message constant, change only the system prompt, and compare how the agent behaves. This makes the system prompt feel concrete before you add richer workflows or more tool-heavy tasks.

## Why this step matters

This example isolates one variable: the agent definition. You reuse one environment, keep the same user input, and swap only the system prompt so the differences are easy to see.

## Prerequisites

- Same setup as `examples/managed-agents-lesson-0-hello-world.md`: `ANTHROPIC_API_KEY`, `curl`, `jq`, and `anthropic-beta: managed-agents-2026-04-01` on every request.
- Run the setup block and the A/B/C runs in the same shell so the shared variables stay available.

## Shared user message

> Explain why loading third-party scripts before consent could be risky

## Setup

`SUFFIX` keeps environment and agent names unique if you run this doc more than once.

```bash
USER_TEXT='Explain why loading third-party scripts before consent could be risky'
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"prompt-play-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)
```

## Run A: role-based prompt

```bash
AGENT_ROLE_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"prompt-play-a-role-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a cybersecurity analyst. Be concise and structured.\"}" | jq -r .id)

SESSION_ROLE_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ROLE_ID\",\"environment_id\":\"$ENVIRONMENT_ID\"}" | jq -r .id)

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ROLE_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$USER_TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ROLE_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Run B: instruction-constrained prompt

```bash
AGENT_BULLETS_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"prompt-play-b-bullets-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"Always respond in bullet points. Max 5 bullets. No fluff.\"}" | jq -r .id)

SESSION_BULLETS_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_BULLETS_ID\",\"environment_id\":\"$ENVIRONMENT_ID\"}" | jq -r .id)

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_BULLETS_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$USER_TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_BULLETS_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Run C: output-schema prompt

```bash
AGENT_JSON_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"prompt-play-c-json-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"Return JSON with fields: summary, risks, recommendations\"}" | jq -r .id)

SESSION_JSON_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_JSON_ID\",\"environment_id\":\"$ENVIRONMENT_ID\"}" | jq -r .id)

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_JSON_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$USER_TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_JSON_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to compare

- **A** should sound like a domain expert with concise, structured prose.
- **B** should obey the explicit format instructions and stay within five bullets.
- **C** should skew toward JSON output with `summary`, `risks`, and `recommendations`.

The important lesson is that you do not need a different API flow for these differences. The system prompt alone changes the output shape.

## Streaming note

The stream `curl` runs until the session becomes idle. You may see `curl: (18) Transferred a partial file` if you stop it early, set a time limit, or sometimes even after `session.status_idle` appears. Treat `session.status_idle` as the success signal, not the curl exit code by itself.

## Success

Each run should end with `session.status_idle`, and the final `agent.message` should clearly reflect the prompt style for that variant.

## Upgrade (optional)

Inline an explicit OUTCOME rubric at the top of the `user.message` (the dedicated `user.define_outcome` event is gated on an older beta incompatible with `managed-agents-2026-04-01`; see Lesson 8) if you want to compare prompt steering plus explicit evaluation criteria.

## See also

- `examples/managed-agents-lesson-0-hello-world.md` for the minimal create-to-stream flow
- `examples/managed-agents-lesson-2-tool-using-agent.md` for a tool-heavy step after prompt-only steering
- `managed-agents-lesson.md` for architecture and streaming notes
