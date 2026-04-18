# Managed Agents: give the agent memory across sessions

> **API status (2026-04-17):** This lesson is **blocked** by the managed-agents beta. Verified findings:
>
> - The tool type `memory_20260401` is rejected: the only accepted tool `type` values today are `agent_toolset_20260401`, `custom`, and `mcp_toolset`.
> - `Agent.memory` as a top-level field is rejected (`"memory: Extra inputs are not permitted"`).
> - `GET /v1/agents/{id}/memory` returns 404 — there is no per-agent memory resource.
> - The Anthropic-provided skill catalog does not currently include a `memory` skill (confirmed IDs: `pdf`, `docx`, `xlsx`). Attaching `{type:"anthropic", skill_id:"memory"}` returns `"skill_id \`memory\` not found"`.
>
> Persistent, cross-session memory is therefore not yet a first-class primitive in this beta. In-session memory (the session journal, Lesson 5) still works. If you need cross-session recall today, the workable patterns are: (1) summarize the journal at session end and prepend the summary to the next session's first `user.message`, or (2) store facts in your own datastore and inject them via the system prompt or a custom `memory_get` tool you define. The lesson below is preserved as the intended flow for when the memory primitive ships.

**Lesson 11** (memory; follows lessons 0–10): turn on persistent memory for an agent, teach it a preference in one session, and watch it recall that preference in a brand-new session without being reminded. This is the shift from "each run starts blank" to "the agent knows me."

## Why this step matters

Lesson 5 showed memory *within* a session — the agent remembers what happened earlier in the same journal. That memory vanishes when the session ends. Real assistants need to remember across sessions: your preferred output format, constraints you mentioned weeks ago, facts about your project that you don't want to re-explain. Memory is the platform feature that makes this work without you stuffing prior transcripts back into every prompt.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 5 (live session) so you're comfortable with multi-turn journals.
- Completed Lesson 8 (outcomes) is helpful but not required.

## Mental model

- **Memory**: a per-agent (sometimes per-agent-per-user) key/value store with text entries.
- **Write**: the agent can call a `memory_write` tool to record a fact. You can also seed memory directly via the API.
- **Read**: on every new session, relevant memory entries are injected into context. The agent decides which to act on.
- **Scope**: memory belongs to the agent, not the session. Session A writes; Session B reads.
- **vs. session journal**: journal = literal event log of one run (ephemeral working context). Memory = curated long-term facts (persistent).
- **vs. system prompt**: system prompt is static config. Memory is dynamic — it changes as the agent learns.

## Step 1: Create an agent with memory enabled

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"memory-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "memory-agent-'"$SUFFIX"'",
    "model": "claude-opus-4-6",
    "tools": [
      {"type": "agent_toolset_20260401"},
      {"type": "memory_20260401"}
    ],
    "memory": {"enabled": true},
    "system": "You are a planning assistant. When a user tells you a preference, a constraint, or a fact about themselves, save it to memory so you can use it in future sessions. At the start of every session, briefly acknowledge any relevant memory that will influence your answer."
  }' | jq -r .id)

echo "AGENT_ID=$AGENT_ID"
```

## Step 2: Session A — teach the agent a preference

```bash
SESSION_A_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Teach preferences\"}" | jq -r .id)

TEXT_A='A few things about how I work: (1) I prefer plans with at most 3 action items. (2) No business jargon — plain English only. (3) I live in Pacific Time, schedule anything with times in PT. Please remember these for next time.'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_A_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT_A" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N --max-time 300 https://api.anthropic.com/v1/sessions/$SESSION_A_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

Watch for `agent.tool_use` events with tool name `memory_20260401` — those are the write calls. The final `agent.message` should confirm what it stored.

## Step 3: Inspect what the agent remembered

Memory is not a black box. You can list, read, edit, and delete entries.

```bash
curl -sS https://api.anthropic.com/v1/agents/$AGENT_ID/memory \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" | jq '.entries[] | {id, content, created_at}'
```

You should see three entries (three action items max, no jargon, PT timezone) — possibly consolidated into fewer, longer entries depending on how the agent wrote them.

## Step 4: Session B — fresh session, no reminder

Now start a brand-new session and ask a generic planning question. Do **not** mention the preferences. The agent should apply them on its own.

```bash
SESSION_B_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Fresh planning ask\"}" | jq -r .id)

TEXT_B='Plan my rollout for a new team wiki. Launch in 2 weeks. Assume a 5-person team.'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_B_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT_B" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N --max-time 300 https://api.anthropic.com/v1/sessions/$SESSION_B_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

The response should:

1. Open with a short "I remember…" acknowledgement.
2. Contain **at most 3** action items.
3. Use plain language.
4. Express any schedule in PT.

## Step 5: Edit memory and watch behavior change

Prove the link is live by editing one entry directly.

```bash
ENTRY_ID=$(curl -sS https://api.anthropic.com/v1/agents/$AGENT_ID/memory \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  | jq -r '.entries[] | select(.content | test("3 action items"; "i")) | .id' | head -n1)

curl -sS -X PATCH https://api.anthropic.com/v1/agents/$AGENT_ID/memory/$ENTRY_ID \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"content":"User prefers plans with at most 7 action items (updated)."}'
```

Start a third session and send the same planning prompt as Step 4. The plan should now come back with up to 7 items.

## Step 6 (optional): Forget an entry

```bash
curl -sS -X DELETE https://api.anthropic.com/v1/agents/$AGENT_ID/memory/$ENTRY_ID \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

Run the prompt again; the length constraint should no longer be enforced.

## What to watch

| Event / artifact | Meaning |
| --- | --- |
| `agent.tool_use` with `memory_20260401` (write) | Agent is saving something for next time |
| `memory.injected` at session start | Entries the platform surfaced into this session's context |
| Opening acknowledgement in `agent.message` | Agent is actually using memory, not just hoarding it |
| `GET /agents/{id}/memory` | Your operational view into what the agent "knows" |

## Success

This lesson succeeds if:

1. Session A stores at least one memory entry you can see via `GET /agents/{id}/memory`.
2. Session B applies the stored preferences without being reminded.
3. Editing an entry changes the next session's behavior; deleting an entry removes the constraint.
4. No session ever needed the preferences pasted back into the prompt.

## Upgrade (optional)

1. **Seed memory from a file**: before Session A, bulk-insert facts via `POST /agents/{id}/memory` (e.g. team roster, coding style rules, company names) so the agent starts a project already "onboarded."
2. **Project-scoped memory**: tag entries with a `project_id` and have the agent recall only entries for the current project. Great companion to Lesson 10's repo-aware flows.
3. **Memory + outcomes**: combine with Lesson 8 so the agent remembers which rubrics you use for which tasks.
4. **Privacy review**: at the end of a session, ask the agent to list everything it *considered* saving but didn't, and why. Useful for compliance review.
5. **Forgetting policy**: auto-delete entries older than N days with a nightly cron against the memory API.

## See also

- `examples/managed-agents-lesson-5-live-session.md` — in-session memory (the journal)
- `examples/managed-agents-lesson-8-define-outcomes.md` — pair persistent preferences with per-run contracts
- `examples/managed-agents-lesson-10-vaults-github.md` — persistence for credentials (different primitive, similar pattern)
- `examples/managed-agents-lesson-12-evaluations.md` — test that memory is actually helping, not hurting
