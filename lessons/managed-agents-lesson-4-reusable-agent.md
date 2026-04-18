# Managed Agents: build a reusable research agent

**Lesson 4** (reusable agent; follows lessons 0–3): define an agent once with a clear role and system prompt, then reuse it across multiple sessions. This is the first step toward thinking in terms of agent configuration rather than giant inline prompts.

## Why this step matters

Previous examples created agents inside session setup, then discarded them. This example teaches the core insight: **agents are configuration you save and reuse**. Once you define a research agent, you can spin up as many sessions as you want without redefining the agent itself. This is how you move from one-off scripts to repeatable, scalable systems.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request. Without it, these endpoints return beta or not-found errors.

## Mental model

- **Agent**: reusable configuration (model, system prompt, tools, skills)
- **Sessions**: ephemeral instances that reference an agent
- **Versioning**: agents auto-increment version on each edit; you can pin to a specific version or always use the latest
- **Create once, invoke many times**: define the agent, save its ID, then use it across multiple independent sessions

## Setup: Define a research agent

Create an agent designed to research educational opportunities. This agent definition stays constant; sessions that use it will vary.

```bash
AGENT_NAME="college-research-assistant"
SUFFIX=$(date +%s)

# Create the agent
AGENT_RESPONSE=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "'"$AGENT_NAME"'-'"$SUFFIX"'",
    "model": "claude-opus-4-6",
    "tools": [{"type": "agent_toolset_20260401"}],
    "system": "You are a research assistant specialized in education. Your job is to help students find colleges, scholarships, and funding opportunities that match their constraints. Be thorough, use tools when you need current data, and organize results clearly. Always cite sources and provide actionable next steps."
  }')

AGENT_ID=$(echo "$AGENT_RESPONSE" | jq -r .id)
AGENT_VERSION=$(echo "$AGENT_RESPONSE" | jq -r .version)

echo "AGENT_ID=$AGENT_ID"
echo "AGENT_VERSION=$AGENT_VERSION"
```

Save both `AGENT_ID` and `AGENT_VERSION`. You now have a reusable research agent.

## Step 1: Create an environment (reusable template)

Environments define the runtime container. You can create this once and reuse it across multiple sessions, or create a new one each time.

```bash
ENVIRONMENT_RESPONSE=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"research-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}")

ENVIRONMENT_ID=$(echo "$ENVIRONMENT_RESPONSE" | jq -r .id)

echo "ENVIRONMENT_ID=$ENVIRONMENT_ID"
```

## Step 2: Launch session A — Find affordable colleges

Start a session using the agent you defined. This session is independent; you can run others simultaneously.

```bash
SESSION_A=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Session A: Affordable colleges\"}")

SESSION_A_ID=$(echo "$SESSION_A" | jq -r .id)

echo "SESSION_A_ID=$SESSION_A_ID"

# Send a prompt
TEXT_A='Find me 5 affordable colleges (under $25k/year) in California with strong engineering programs'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_A_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT_A" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

# Stream the response (expect several minutes; research + tools can be slow)
curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_A_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

When the turn finishes, the stream emits `session.status_idle`, then the connection closes. `curl` may then print `curl: (18) Transferred a partial file` and exit with code 18—that is normal for SSE, not a failed request.

## Step 3: Launch session B — Find scholarships

Spin up another independent session using the same agent. This demonstrates reusability.

```bash
SESSION_B=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Session B: Merit scholarships\"}")

SESSION_B_ID=$(echo "$SESSION_B" | jq -r .id)

echo "SESSION_B_ID=$SESSION_B_ID"

# Send a different prompt to the same agent
TEXT_B='Find merit-based scholarships for computer science students with GPA 3.5+ and SAT 1450+'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_B_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT_B" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

# Stream the response
curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_B_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Step 4: Launch session C — Compare schools

Again, same agent, different task.

```bash
SESSION_C=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Session C: School comparison\"}")

SESSION_C_ID=$(echo "$SESSION_C" | jq -r .id)

echo "SESSION_C_ID=$SESSION_C_ID"

# Send a third prompt
TEXT_C='Compare UC Berkeley, MIT, and Stanford on cost, aid, and placement rates for software engineering'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_C_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT_C" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

# Stream the response
curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_C_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to watch

- **Agent reuse**: All three sessions reference `$AGENT_ID`. You created the agent once; sessions are cheap and ephemeral.
- **Independent streams**: Each session has its own event stream. You can run A, B, and C in parallel without them interfering.
- **System prompt consistency**: All three sessions see the same system prompt. The agent behavior is consistent, only the user prompts differ.
- **Versioning**: `$AGENT_VERSION` tells you which snapshot of the agent was created. If you edit the agent later, the version auto-increments.

## Success

This lesson succeeds if:

1. You can create one agent and reuse it across three independent sessions.
2. Each session ends with `session.status_idle` and produces distinct outputs based on different user prompts.
3. You can save `$AGENT_ID` and later invoke it in a new shell session without re-creating the agent.

**Validated (April 2026):** Full flow run against the live API with `claude-opus-4-6`: agent + one environment + three sessions (A/B/C) each reached `session.status_idle` after streaming; typical wall time was on the order of **2–3 minutes per session** with tools and web research (varies with load and prompt).

## Upgrade (optional)

1. **Edit the agent**: Fetch the agent by ID, update the system prompt, and POST it back. Note the version change.
2. **Pin a version**: When starting a session, reference `agent_id:version` instead of just `agent_id` to lock to a specific snapshot.
3. **Add tools selectively**: Modify the agent definition to include only `{"type": "bash"}` instead of the full toolset, and watch the agent refuse non-bash tasks.
4. **Parallel sessions**: Use `&` to run sessions A, B, and C in the background, then wait for all three to complete.

## See also

- `examples/managed-agents-lesson-0-hello-world.md` for the minimal baseline
- `examples/managed-agents-lesson-1-prompt-playground.md` for prompt-only comparison
- `examples/managed-agents-lesson-5-live-session.md` for runtime steering
- `managed-agents-lesson.md` for architecture and concept glossary
