# Managed Agents: hello world

**Lesson 0** (hello world): the smallest end-to-end flow against the Anthropic Managed Agents API. You create an agent, create an environment, start a session, send one user message, and watch the event stream until the session finishes.

## Why this step matters

This is the baseline mental model for the rest of the lesson:

- **Agent**: reusable instructions plus tools
- **Environment**: reusable runtime config
- **Session**: one live execution
- **Events**: the journal of what happened in that session

Once this round trip works, the other examples are just variations on the same API surface.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request. Without it, these endpoints return beta or not-found errors.

## Run this

```bash
# 1. Create an agent
AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"name":"hello","model":"claude-opus-4-6","tools":[{"type":"agent_toolset_20260401"}],"system":"You are concise."}' | jq -r .id)

# 2. Create an environment
ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"name":"hello-env","config":{"type":"cloud","networking":{"type":"unrestricted"}}}' | jq -r .id)

# 3. Start a session
SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\"}" | jq -r .id)

# 4. Send a message
curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"events":[{"type":"user.message","content":[{"type":"text","text":"Reply with the single word: ack"}]}]}'

# 5. Stream the response
curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to watch

- The `POST /agents`, `POST /environments`, and `POST /sessions` calls each return an ID you reuse in the next step.
- The event stream is not plain chat output. It is a sequence of named events.
- For this simple run, the key events are `user.message`, `agent.message`, and `session.status_idle`.

## Success

The run is successful if the stream shows an `agent.message` whose text content is `ack` and then a terminal `session.status_idle` event.

## Upgrade (optional)

Reuse the same structure with a different system prompt or user message before moving on to the next example. The API shape stays the same; only the behavior changes.

## See also

- `examples/managed-agents-lesson-1-prompt-playground.md` for prompt-only variation on the same flow
- `managed-agents-lesson.md` for architecture, pitfalls, and history-before-stream notes
