# Managed Agents: define outcomes so the agent knows when it’s done

**Lesson 8** (outcomes; follows lessons 0–7): give the agent an explicit success rubric at session start, have it self-evaluate against each criterion, then tighten the rubric mid-session and watch it converge.

> **API note (2026-04-01 beta):** the first-class `user.define_outcome` event is currently gated on an older, incompatible beta (`agent-api-2026-03-01`) and cannot be mixed with `managed-agents-2026-04-01`. Until the two betas merge, we pass the rubric as the first turn of a `user.message` and teach the agent (via its system prompt) to echo a per-criterion status block at the end of every response. This is the same contract, just carried in prose instead of a dedicated event.

## Why this step matters

Most agent failures are not capability failures — they’re "done" failures. The agent stops too early, or it produces an answer that feels fine but misses a requirement. Defining outcomes up front turns "good enough" into a testable contract. The agent sees the criteria, the platform tracks progress against them, and you get a clear signal when the session is actually complete.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 5 (live session) or Lesson 6 (real files); familiarity with `user.message` event shape.

## Mental model

- **Outcome**: a structured description of what "done" looks like — prose goal plus a list of discrete criteria.
- **Criterion**: one testable condition (e.g. "output includes at least 3 scholarships with deadlines").
- **Self-evaluation**: the agent reports per-criterion status (`met` / `not_met` / `partial`) in its responses.
- **Lifecycle**: outcomes can be defined at session start, updated mid-session, or replaced entirely as scope changes.
- **vs. system prompt**: the system prompt describes *how* to behave; an outcome describes *what result to produce*.

## Setup: agent + environment + session

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"outcome-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"outcome-agent-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a college application advisor. When an outcome is defined, treat each criterion as a checklist. After your main answer, report which criteria are met, partial, or not met, and what would be needed to close any gap.\"}" | jq -r .id)

SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Outcome-driven session\"}" | jq -r .id)

echo "SESSION_ID=$SESSION_ID"
```

## Step 1: Send the outcome + the user message in one batch

Send a single `user.message` that carries the rubric as an inline `OUTCOME` block followed by the actual request. The agent’s system prompt already told it to treat each criterion as a checklist.

```bash
curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "events": [
      {
        "type": "user.message",
        "content": [{"type": "text", "text": "OUTCOME\nGoal: Produce a prioritized scholarship application plan for a CS-bound high school senior with a 3.75 GPA.\nCriteria:\n- top_three: Lists at least 3 scholarships the student qualifies for.\n- deadlines: Every listed scholarship includes a specific deadline date.\n- requirements: Every listed scholarship includes eligibility requirements and any essay topics.\n- ranking: Scholarships are ordered by a clearly stated ranking rationale (e.g. award size, fit, deadline urgency).\n- next_actions: Ends with a 5-item next-actions checklist the student can start today.\n\nREQUEST\nBuild the plan for me. I am a CS-bound senior, 3.75 GPA, living in California, first-generation college student.\n\nAt the end of your reply, output a CHECKLIST block with one line per criterion id in the form `- <id>: met | partial | not_met — <one-line reason>`."}]
      }
    ]
  }'

curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

**Wait for `session.status_idle`.** The agent’s final message should contain the plan *and* an explicit check of each criterion.

## Step 2: Update the outcome mid-session

Once you have a first draft, tighten the contract by sending a new `user.message` with an updated `OUTCOME` block. The agent should carry the previous plan forward and re-score against the new criteria.

```bash
curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "events": [
      {
        "type": "user.message",
        "content": [{"type": "text", "text": "OUTCOME (UPDATED — replaces the previous rubric)\nGoal: Upgrade the plan: only include scholarships with deadlines in the next 90 days, and add an estimated weekly hours commitment for each.\nCriteria:\n- window: All scholarships have deadlines within 90 days of today.\n- hours: Each scholarship lists an estimated weekly hours commitment to prepare the application.\n- next_actions: Updated 5-item next-actions checklist reflects the new 90-day window.\n\nREQUEST\nApply the new criteria to the plan you already produced. End with the CHECKLIST block using the new criterion ids."}]
      }
    ]
  }'

curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Step 3: Ask the agent to close the gap

If any criterion came back `partial` or `not_met`, nudge the agent with a single follow-up.

```bash
TEXT='For any criterion you rated partial or not_met, make the fixes now and re-report the checklist.'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to watch

| Event | Meaning |
| --- | --- |
| `user.message` with an `OUTCOME` block | The contract you just set (or replaced) |
| `agent.message` | Should contain both the work and a per-criterion `CHECKLIST` block |
| `session.status_idle` | Turn complete — check the checklist before deciding whether you’re really done |

Key teaching moment: compare the *first* message (Step 1) to the *third* (Step 3). The agent should converge toward fully-met criteria without you rewriting the goal each time.

## Success

This lesson succeeds if:

1. The agent’s Step 1 response explicitly addresses all 5 criteria by id.
2. After Step 2, the plan respects the 90-day window and per-scholarship weekly-hours estimate.
3. After Step 3, every criterion is reported as `met`.
4. You can run `GET /sessions/{id}/events | jq '.data[] | select(.type=="user.message") | .content[0].text' | grep -c OUTCOME` and see both OUTCOME blocks in the journal.

## Upgrade (optional)

1. **Programmatic scoring**: parse the agent’s criterion statuses from its message (ask it to emit JSON) and fail CI if any are `not_met`.
2. **Outcome from Lesson 6**: attach the transcript/essay/scholarships files *and* inline the OUTCOME rubric into the first `user.message` so success is grounded in real documents.
3. **Outcome versioning**: keep a small library of outcome templates (e.g. `triage.outcome.json`, `review.outcome.json`) and pick one per session.
4. **Pair with policies**: combine with Lesson 7 so the agent has both a contract (what to produce) and guardrails (what it may not do).

## See also

- `examples/managed-agents-lesson-5-live-session.md` — multi-turn sessions
- `examples/managed-agents-lesson-6-real-files.md` — the manual rubric this lesson replaces
- `examples/managed-agents-lesson-7-permission-policies.md` — guardrails that complement outcomes
- `examples/managed-agents-lesson-9-multiagent.md` — outcomes become the contract between orchestrator and subagents
