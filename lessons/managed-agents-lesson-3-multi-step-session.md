# Managed Agents: multi-step session

**Lesson 3** (multi-step session): keep one session alive across three user turns so the later prompts build on the earlier ones. This is the first lesson where the session itself becomes the important teaching concept.

## Why this step matters

The previous examples mostly show one request-response turn. This example shows what changes when the session becomes a persistent working context instead of a single-shot run.

## Prerequisites

- Same setup as `examples/managed-agents-lesson-0-hello-world.md`: `ANTHROPIC_API_KEY`, `curl`, `jq`, and `anthropic-beta: managed-agents-2026-04-01` on every request.
- Run the setup block and then execute steps 1, 2, and 3 in order in the same shell.
- Do not send the next user message until the previous stream has reached `session.status_idle`.

## Mental model

- One **session** can hold multiple user turns.
- Each `POST /sessions/{id}/events` appends more events to the same journal.
- Later prompts can rely on the prior messages, tool work, and assistant outputs that already exist in that session history.

## Setup

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"multi-step-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"multi-step-agent-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a research and communications assistant. Use tools when you need current data. Build on prior turns; keep outputs well structured.\"}" | jq -r .id)

SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\"}" | jq -r .id)

echo "SESSION_ID=$SESSION_ID"
```

## Step 1: research prompt

> Research USDC adoption trends

```bash
TEXT1='Research USDC adoption trends'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT1" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Step 2: executive memo

> Now summarize into a 1-page executive memo

```bash
TEXT2='Now summarize into a 1-page executive memo'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT2" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Step 3: social formats

> Convert into LinkedIn post + tweet thread

```bash
TEXT3='Convert into LinkedIn post + tweet thread'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT3" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to watch

- The `SESSION_ID` stays the same across all three steps.
- Each turn appends new events to the existing journal instead of starting over.
- By step 3, the output should build on the earlier research and memo rather than acting like a brand-new prompt.

## Streaming notes

- You may still see `curl: (18) Transferred a partial file` when the server closes the SSE. If `session.status_idle` already appeared, treat the turn as complete.
- For scripts, consider adding `--max-time 600` to the stream command so a stuck turn does not hang forever.
- `GET /sessions/{id}/events` returns the full journal if you want to inspect prior turns without relying on the live stream.
- This is the slowest and noisiest example of the four. Research-heavy turns can take longer and emit much larger SSE traces.

## Success

Each step should end with `session.status_idle`, and the later outputs should clearly reuse context from the earlier turns. If step 3 reads like a continuation of steps 1 and 2 rather than a fresh one-shot answer, the session behavior is working.

## Upgrade (optional)

Inline an OUTCOME rubric into the `user.message` text on each step (the dedicated `user.define_outcome` event is not compatible with `managed-agents-2026-04-01`; see Lesson 8) to show that a multi-turn session can still carry richer contracts on each step.

## See also

- `examples/managed-agents-lesson-0-hello-world.md`
- `examples/managed-agents-lesson-1-prompt-playground.md`
- `examples/managed-agents-lesson-2-tool-using-agent.md`
- `managed-agents-lesson.md`
