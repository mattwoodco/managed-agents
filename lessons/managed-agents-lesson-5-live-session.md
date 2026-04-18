# Managed Agents: run and steer a live session

**Lesson 5** (live session; follows lessons 0–4): keep a session alive across multiple user turns, update goals mid-run, and steer the agent's work in real time. This is where the session becomes the important abstraction, not just a one-shot request-response.

## Why this step matters

Previous examples mostly treated sessions as single-turn. This example shows what changes when you understand a session as a persistent working context: you can interrupt, redirect, provide feedback, and ask follow-up questions without restarting. The agent builds on prior context. This is the mental model shift from "chat" to "agentic workflows."

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Do not send the next user message until the previous stream has reached `session.status_idle`.

## Mental model

- One **session** can hold unlimited user turns and tool execution.
- Each `POST /sessions/{id}/events` appends more events to the same journal instead of starting fresh.
- The session is the working context. The agent has memory of prior turns.
- `GET /sessions/{id}` shows the full journal; `GET /sessions/{id}/stream` shows live events as they happen.
- Later prompts build on prior messages, tool outputs, and decisions already in the session.

## Setup

Create a persistent session for an application-planning assistant. This session will run through multiple planning phases.

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"planning-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"planning-agent-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a college application planner. Your role is to guide students through the application process: draft timelines, track deadlines, review essays, and adapt plans as constraints change. Build on earlier advice. Be encouraging and specific.\"}" | jq -r .id)

SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Application planning session\"}" | jq -r .id)

echo "SESSION_ID=$SESSION_ID"
```

## Turn 1: Build an initial timeline

Send the first prompt to start the planning process.

```bash
TEXT1='I am a high school senior applying to schools this fall. I am interested in computer science and business. My top 3 schools are Stanford, MIT, and UC Berkeley. Help me draft a realistic timeline from now through May when decisions come out.'

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

The agent should produce a detailed timeline. **Wait for `session.status_idle` before proceeding.**

## Turn 2: Add a constraint

Now send a second prompt that changes the scenario. The agent should remember the timeline from Turn 1 and adapt.

```bash
TEXT2='Actually, I just realized I can only take 2 weeks off in December for exam prep. Update the timeline so I am not doing applications during those 2 weeks.'

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

**Wait for `session.status_idle`.**

## Turn 3: Request a formatted output

Ask the agent to export the updated plan in a specific format.

```bash
TEXT3='Now convert this timeline into a checklist with dates. Format it as markdown with checkboxes.'

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

**Wait for `session.status_idle`.**

## Turn 4: Inspect the session journal

Retrieve the full event journal without streaming. This shows everything that happened.

```bash
curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" | jq .
```

This returns the full journal in order. You should see **three** `user.message` events (Turns 1–3), each followed by that turn’s agent activity (for example `agent.tool_use` / `agent.tool_result`, spans, and `agent.message`). Turn 4 above is inspection only—it does not add another `user.message`.

## What to watch

| Observed event | Meaning |
| --- | --- |
| `user.message` | Your prompt has been appended to the session journal |
| `span.model_request_start` / `span.model_request_end` | Claude reads the entire session history, makes a decision, and responds |
| `agent.tool_use` | Agent planned a tool action based on context from prior turns |
| `agent.tool_result` | Tool execution output, now part of the journal |
| `agent.message` | Assistant text that references or builds on earlier context |
| `session.status_idle` | This turn is complete; safe to send the next turn |
| `session.status_error` | Something went wrong; inspect the error details |

The key teaching moment: by Turn 3, the agent should clearly reference the December constraint from Turn 2 and the original timeline from Turn 1. This shows the session is truly persistent, not stateless.

## Success

This lesson succeeds if:

1. Each turn ends with `session.status_idle`.
2. Turn 2 output references the December constraint without you repeating the original timeline.
3. Turn 3 output includes a markdown checklist that respects both the original timeline and the December constraint.
4. `GET /sessions/{id}/events` returns a journal with **three** `user.message` events (one per user turn) and the corresponding agent responses after each.

## Streaming notes

- You may see `curl: (18) Transferred a partial file` when the server closes the SSE. If `session.status_idle` already appeared, the turn is complete.
- For production, add `--max-time 600` to the stream command so a stuck turn does not hang forever.
- If you need to cancel a turn mid-execution, send a new `user.message` with a simple interrupt like "Stop" — the agent will finish its current action and then listen to your new prompt.

## Upgrade (optional)

1. **Multi-event turn**: Inline an OUTCOME rubric into the `user.message` text to steer the agent's evaluation of success (the dedicated `user.define_outcome` event is gated on an older incompatible beta; see Lesson 8).
2. **Parallel sessions**: Create two independent sessions with the same agent and send different user prompts to compare how they diverge.
3. **Session inspection**: Use `GET /sessions/{id}` (without `/stream`) to dump the full journal at any point, then parse the JSON to extract just the agent's final messages.
4. **Dynamic tool enable/disable**: Send a second event in the batch to modify which tools the agent can use mid-session.

## See also

- `examples/managed-agents-lesson-0-hello-world.md` for the minimal single-turn baseline
- `examples/managed-agents-lesson-1-prompt-playground.md` for prompt-only A/B testing
- `examples/managed-agents-lesson-4-reusable-agent.md` for agent definition and reuse
- `examples/managed-agents-lesson-2-tool-using-agent.md` for tool execution deep dive
- `managed-agents-lesson.md` for architecture and event types
