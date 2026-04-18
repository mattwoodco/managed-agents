# Managed Agents: orchestrate subagents in a multiagent session

**Lesson 9** (multiagent; follows lessons 0–8): run two specialist agents in parallel and have **your client** act as the orchestrator — fan out, wait for both, then send the stitched result to a synthesizer agent. This is the capstone lesson; it uses almost everything from 0–8: reusable agents, live sessions, files, rubrics, and policies all snapping together.

> **API note (2026-04-01 beta):** the platform does not currently expose a first-class delegation tool (no `agent_delegate_20260401`, no `subagents` field on the agent definition; `agent_toolset_20260401` only exposes `bash`/`edit`/`glob`/`grep`/`read`/`web_fetch`/`web_search`/`write`). Until in-session delegation ships, the orchestrator lives in your code: open one session per subagent, post `user.message`s in parallel, collect each final `agent.message`, then feed both into a synthesizer agent. The shape of the lesson — parallel specialists, one final synthesis — is identical.

## Why this step matters

Single-agent sessions hit a ceiling. Long tool chains blur focus, context windows fill, and the agent starts hedging. Splitting work across specialists — a **researcher**, an **editor**, an orchestrator on top — keeps each context tight and lets you parallelize. The managed platform handles the plumbing: one session, one journal, clear parent/child events.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 4 (reusable agents) and Lesson 8 (outcomes). Lesson 7 is helpful but optional.

## Mental model

- **Orchestrator**: your client. It decides the subtasks, fans out, and routes results.
- **Subagent**: a normal agent definition, reused as a specialist (researcher, editor, evaluator, etc.) — each runs in its own session.
- **Parallelism**: issue `POST /sessions` for each specialist, then post the `user.message`s back-to-back; stream the two sessions concurrently and await the terminal `agent.message` from each.
- **Synthesizer**: a third agent (or a final turn on the orchestrator session of your choosing) that receives the two specialist results and produces the unified answer.
- **Shared environment**: all three agents typically run in the same environment so policies apply uniformly.

## Step 1: Define the two specialists

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"multi-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

RESEARCHER_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"researcher-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a research specialist. Given a narrow question, return a concise, cited answer. Never produce long prose; return a short structured brief.\"}" | jq -r .id)

EDITOR_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"editor-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a strict editor. You receive a draft and return it with line-level feedback, a revised version, and a one-line summary of the biggest weakness.\"}" | jq -r .id)

echo "RESEARCHER_ID=$RESEARCHER_ID"
echo "EDITOR_ID=$EDITOR_ID"
```

## Step 2: Define the synthesizer agent

Since there is no in-agent delegate tool, the "orchestrator" role is your client. We still want a dedicated agent for the final synthesis pass so its system prompt is specialized.

```bash
SYNTHESIZER_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "synthesizer-'"$SUFFIX"'",
    "model": "claude-opus-4-6",
    "tools": [{"type": "agent_toolset_20260401"}],
    "system": "You are a synthesizer. You receive (1) a research brief and (2) editorial feedback on a draft. Produce a single coherent final answer plus a 2-line change log. Never paste the raw inputs back."
  }' | jq -r .id)

echo "SYNTHESIZER_ID=$SYNTHESIZER_ID"
```

## Step 3: Fan out — one session per specialist, in parallel

Open a session per specialist, post the subtask to each, then stream both concurrently. `&` backgrounds the first stream so the second runs alongside it.

```bash
RESEARCH_SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$RESEARCHER_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Research leg\"}" | jq -r .id)

EDIT_SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$EDITOR_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Edit leg\"}" | jq -r .id)

echo "RESEARCH_SESSION_ID=$RESEARCH_SESSION_ID"
echo "EDIT_SESSION_ID=$EDIT_SESSION_ID"

# Post subtask to researcher.
curl -sS https://api.anthropic.com/v1/sessions/$RESEARCH_SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"events":[{"type":"user.message","content":[{"type":"text","text":"Return a short brief listing 2–3 current eligibility criteria for the Jack Kent Cooke Undergraduate Transfer Scholarship, with a citation per criterion."}]}]}'

# Post a strawman draft to the editor.
curl -sS https://api.anthropic.com/v1/sessions/$EDIT_SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{"events":[{"type":"user.message","content":[{"type":"text","text":"Edit this 150-word cover paragraph for clarity and voice. Return a revised paragraph and one-line summary of the biggest weakness.\n\nDRAFT: I am a community college sophomore majoring in computer science with a 3.9 GPA. As a first-generation student, college has been a journey of grit and self-teaching. I am applying to the Jack Kent Cooke Undergraduate Transfer Scholarship because I want to transfer to a four-year program and keep building. I have taught myself systems programming on nights and weekends, tutored classmates in data structures, and shipped two small open-source tools. I believe this scholarship will let me focus on learning rather than working three jobs, and I am ready to make the most of it."}]}]}'

# Stream both in parallel.
curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$RESEARCH_SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" > /tmp/research.sse &

curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$EDIT_SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" > /tmp/edit.sse &

wait
echo "--- research ---"; tail -20 /tmp/research.sse
echo "--- edit ---";     tail -20 /tmp/edit.sse
```

## Step 4: Synthesize

Pull the terminal `agent.message` text out of each journal and feed both into a synthesizer session.

```bash
RESEARCH_OUT=$(curl -sS "https://api.anthropic.com/v1/sessions/$RESEARCH_SESSION_ID/events" \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  | jq -r '[.data[] | select(.type=="agent.message") | .content[0].text] | last')

EDIT_OUT=$(curl -sS "https://api.anthropic.com/v1/sessions/$EDIT_SESSION_ID/events" \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  | jq -r '[.data[] | select(.type=="agent.message") | .content[0].text] | last')

SYNTH_SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" -H "content-type: application/json" \
  -d "{\"agent\":\"$SYNTHESIZER_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Synthesis\"}" | jq -r .id)

PAYLOAD=$(jq -n --arg r "$RESEARCH_OUT" --arg e "$EDIT_OUT" '{events:[{type:"user.message",content:[{type:"text",text:("RESEARCH BRIEF:\n" + $r + "\n\nEDITORIAL FEEDBACK:\n" + $e + "\n\nProduce the final 130–170 word paragraph plus a 2-line change log.")}]}]}')

curl -sS https://api.anthropic.com/v1/sessions/$SYNTH_SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" -H "content-type: application/json" \
  -d "$PAYLOAD"

curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SYNTH_SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## Step 5: Inspect the three journals

Each session has its own journal. The parallelism shows up as overlapping timestamps across the two specialist journals, not as child events inside one.

```bash
for S in $RESEARCH_SESSION_ID $EDIT_SESSION_ID $SYNTH_SESSION_ID; do
  echo "=== $S ==="
  curl -sS "https://api.anthropic.com/v1/sessions/$S/events" \
    -H "x-api-key: $ANTHROPIC_API_KEY" -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    | jq '[.data[] | {type, processed_at}] | .[:8]'
done
```

## What to watch

| Event | Meaning |
| --- | --- |
| Two `session.status_running` events with overlapping timestamps (one per specialist) | Parallel fan-out is working |
| Each specialist's final `agent.message` | The condensed result your client will pass forward |
| Synthesizer session's `agent.message` | Unified final answer |
| `session.status_idle` on all three sessions | Every leg has drained |

## Success

This lesson succeeds if:

1. Three sessions exist: researcher, editor, synthesizer.
2. Researcher and editor sessions overlap in time (parallelism), not strictly sequential.
3. The synthesizer session's final `agent.message` is a single coherent paragraph (130–170 words) plus a 2-line change log — not concatenated specialist transcripts.

## Upgrade (optional)

1. **Add a third specialist**: a `fact_checker` that receives the editor’s revised paragraph and returns a pass/fail. The orchestrator loops until fact-check passes.
2. **Per-subagent policies**: give the researcher an environment with internet access (Lesson 7) but the editor a locked-down one with no network.
3. **File handoff**: upload the target scholarship PDF (Lesson 6) and pass the `file_id` through delegation so both subagents work from the same source.
4. **Budget the fan-out**: cap the orchestrator at N delegations per turn via a permission policy on the delegate tool; observe how it reprioritizes.
5. **Swap models**: run the orchestrator on a strong model and the subagents on a faster/cheaper model to measure cost and latency trade-offs.

## See also

- `examples/managed-agents-lesson-4-reusable-agent.md` — each subagent is just a reusable agent
- `examples/managed-agents-lesson-5-live-session.md` — the session/journal model this builds on
- `examples/managed-agents-lesson-7-permission-policies.md` — constrain what subagents may do
- `examples/managed-agents-lesson-8-define-outcomes.md` — the contract passed into delegation
- `managed-agents-lesson.md` — architecture and advanced patterns
