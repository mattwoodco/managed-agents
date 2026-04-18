# Managed Agents: build an evaluation harness

**Lesson 12** (evaluations; follows lessons 0–11): run your agent against a small dataset of prompts, score every run automatically, and produce a scorecard you can diff when you change the system prompt, model, or tools. This closes the loop from "it worked once in my terminal" to "I can tell whether my last change made things better or worse."

## Why this step matters

Every previous lesson asked the same question informally: *did that turn out well?* You eyeballed the output. That stops scaling the moment you care about three prompts, three models, or three versions of the agent. An eval harness makes the answer mechanical: same inputs, same criteria, a number at the bottom. It's the single highest-leverage piece of infrastructure for shipping agents — everything after this (reducing latency, hardening against jailbreaks, reducing hallucinations) is just a change you want to *measure*.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 4 (reusable agent) and Lesson 8 (outcomes).
- A reusable `AGENT_ID` and `ENVIRONMENT_ID` from any previous lesson (we'll use the application-advisor style for continuity with Lessons 5/6/8).

## Mental model

- **Eval set**: a file of `{input, outcome}` cases. Small (5–10) is fine — better ten thoughtful cases than a thousand junk ones.
- **Run**: for one case, create a session, send the input + outcome, wait for `session.status_idle`, capture the final `agent.message`.
- **Score**: two signals per run.
  - **Self-report** (from Lesson 8): the agent grades itself against the outcome criteria.
  - **LLM judge**: a second, cheaper model call that grades the output against the same criteria, independently.
- **Scorecard**: per-case and aggregate results, plus latency, plus cost.
- **Diff**: change one variable, re-run the same eval set, compare scorecards.

## Step 1: Write the eval set

Keep the cases small and focused. Each has an `id`, a user prompt, and the outcome from Lesson 8's contract format.

```bash
cat > eval-set.json <<'EOF'
{
  "cases": [
    {
      "id": "first-gen-california",
      "input": "I am a CS-bound senior, 3.75 GPA, first-generation college student, California resident. Build a scholarship plan.",
      "outcome": {
        "goal": "Prioritized scholarship application plan.",
        "criteria": [
          {"id": "top_three", "description": "Lists at least 3 scholarships the student qualifies for."},
          {"id": "deadlines", "description": "Every scholarship includes a specific deadline date."},
          {"id": "ranking", "description": "Scholarships are ordered with a stated rationale."},
          {"id": "next_actions", "description": "Ends with a 5-item next-actions checklist."}
        ]
      }
    },
    {
      "id": "transfer-student",
      "input": "I am a community college sophomore, 3.9 GPA, transferring next fall, majoring in biology. Build a scholarship plan.",
      "outcome": {
        "goal": "Prioritized scholarship application plan for a transfer student.",
        "criteria": [
          {"id": "transfer_specific", "description": "At least 2 scholarships specifically support transfer students."},
          {"id": "deadlines", "description": "Every scholarship includes a specific deadline date."},
          {"id": "next_actions", "description": "Ends with a 5-item next-actions checklist."}
        ]
      }
    },
    {
      "id": "stem-low-income",
      "input": "I am a sophomore, 3.6 GPA, household income under $40k, targeting mechanical engineering. Build a scholarship plan.",
      "outcome": {
        "goal": "Prioritized scholarship plan emphasizing need-based aid.",
        "criteria": [
          {"id": "need_based", "description": "At least 2 of the scholarships are need-based."},
          {"id": "deadlines", "description": "Every scholarship includes a specific deadline date."},
          {"id": "next_actions", "description": "Ends with a 5-item next-actions checklist."}
        ]
      }
    }
  ]
}
EOF
```

## Step 2: Run the harness

This script loops over cases, runs each through a fresh session, and writes a JSONL row per run with the agent's final message and the wall-clock time.

```bash
mkdir -p runs

jq -c '.cases[]' eval-set.json | while read -r CASE; do
  CASE_ID=$(echo "$CASE" | jq -r .id)
  INPUT=$(echo "$CASE" | jq -r .input)
  OUTCOME=$(echo "$CASE" | jq -c .outcome)

  SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "content-type: application/json" \
    -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"eval:$CASE_ID\"}" | jq -r .id)

  START=$(date +%s)

  # The managed-agents beta does not currently accept a `user.define_outcome`
  # event, so we inline the outcome contract into the user.message text. The
  # agent's system prompt is responsible for treating it as a checklist.
  PROMPT=$(jq -n --argjson o "$OUTCOME" --arg t "$INPUT" '"OUTCOME CONTRACT:\n" + ($o|tostring) + "\n\nUSER REQUEST:\n" + $t')

  curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    -H "content-type: application/json" \
    -d "$(jq -n --arg t "$PROMPT" '{events:[
      {type:"user.message", content:[{type:"text", text:$t}]}
    ]}')" > /dev/null

  curl -sS -N --max-time 600 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" > /dev/null

  END=$(date +%s)
  LATENCY=$((END - START))

  FINAL=$(curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "anthropic-beta: managed-agents-2026-04-01" \
    | jq -r '[.data[] | select(.type=="agent.message")] | last | (.content // []) | map(.text // "") | join("")')

  jq -n \
    --arg id "$CASE_ID" \
    --arg sid "$SESSION_ID" \
    --arg out "$FINAL" \
    --argjson lat "$LATENCY" \
    --argjson oc "$OUTCOME" \
    '{case_id:$id, session_id:$sid, latency_s:$lat, output:$out, outcome:$oc}' >> runs/results.jsonl

  echo "Done: $CASE_ID ($LATENCY s)"
done
```

After this completes you'll have `runs/results.jsonl` — one JSON object per case.

## Step 3: Score with an LLM judge

For each row, ask a cheaper Claude model to grade the output against the criteria. This is an independent check on the agent's self-report.

```bash
: > runs/scored.jsonl

while read -r ROW; do
  CASE_ID=$(echo "$ROW" | jq -r .case_id)
  OUTPUT=$(echo "$ROW" | jq -r .output)
  CRITERIA=$(echo "$ROW" | jq -c .outcome.criteria)

  JUDGE_PROMPT=$(jq -n --arg out "$OUTPUT" --argjson cr "$CRITERIA" '
    "You are a strict grader. Given the agent output and a list of criteria, return ONLY raw JSON (no markdown fences, no prose) in the shape {\"scores\": [{\"id\": string, \"status\": \"met\"|\"partial\"|\"not_met\", \"note\": string}]}.\n\nAGENT OUTPUT:\n" + $out + "\n\nCRITERIA:\n" + ($cr|tostring)
  ')

  JUDGE=$(curl -sS https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d "$(jq -n --arg p "$JUDGE_PROMPT" '{
      model:"claude-haiku-4-5",
      max_tokens:1024,
      messages:[{role:"user", content:$p}]
    }')" | jq -r '.content[0].text')

  # Strip any ```json ... ``` fences the judge may add despite instructions.
  JUDGE_CLEAN=$(echo "$JUDGE" | sed -e 's/^```json//' -e 's/^```//' -e 's/```$//' | awk '/^{/,/^}/')
  SCORES=$(echo "$JUDGE_CLEAN" | jq -c '.scores // []' 2>/dev/null || echo '[]')

  echo "$ROW" | jq --argjson s "$SCORES" '. + {judge_scores:$s}' >> runs/scored.jsonl
done < runs/results.jsonl
```

## Step 4: Aggregate a scorecard

```bash
jq -s '
  def pct(n;d): if d==0 then 0 else (100*n/d) end;
  def all_met(scores): (scores|length) > 0 and all(.status=="met");

  {
    cases: length,
    pass_rate: pct([.[] | select(.judge_scores|all_met)] | length; length),
    per_criterion: (
      [.[].judge_scores[]]
      | group_by(.id)
      | map({id: .[0].id, met: pct([.[] | select(.status=="met")] | length; length)})
    ),
    latency: {
      p50: (sort_by(.latency_s)[length/2|floor].latency_s),
      max: ([.[].latency_s] | max)
    }
  }
' runs/scored.jsonl | tee runs/scorecard.json
```

You now have a single-file scorecard: overall pass rate, per-criterion pass rate, latency p50 and max.

## Step 5: Change one variable and diff

Make **one** change — a different system prompt, a different model, removing a tool — and re-run Steps 2–4 against a new directory (e.g. `runs-v2/`). Diff:

```bash
diff <(jq -S . runs/scorecard.json) <(jq -S . runs-v2/scorecard.json)
```

The rule: never compare impressions. Only compare scorecards.

## What to watch

| Signal | What it tells you |
| --- | --- |
| Pass rate up, latency up | You traded speed for quality — decide if it's worth it |
| Pass rate up, latency flat | Free win, keep the change |
| One criterion stays low across every run | Prompt or tool gap, not randomness |
| High variance run-to-run on the same case | Temperature too high, flaky tool, or under-specified outcome |
| Judge disagrees with agent self-report | The agent is overclaiming — tighten the system prompt |

## Success

This lesson succeeds if:

1. `runs/scored.jsonl` has one row per case with both the output and judge scores.
2. `runs/scorecard.json` contains an overall pass rate and per-criterion breakdown.
3. After changing one variable and re-running, you can point at a specific number and say "this change made X better by Y%."

## Upgrade (optional)

1. **Move to the Console Evaluation Tool**: export the eval set (cases + criteria) and run the same cases in the Console's evaluation UI. Compare UI scores to your harness scores.
2. **Gate PRs on evals**: wire the harness into CI. Block merges that regress pass rate by more than a threshold.
3. **Pair with Lesson 7 (policies)**: add a criterion like "agent never attempted a denied tool call" and read it from the event journal instead of the final message.
4. **Pair with Lesson 11 (memory)**: run the eval set twice — once with memory, once without — to measure whether persistent memory actually helps.
5. **Pair with Lesson 9 (multiagent)**: evaluate orchestrator-plus-subagents versus single-agent on the same cases and compare cost/quality/latency.
6. **Scale the set**: grow to 30–50 cases covering edge cases (empty input, adversarial prompts, wrong domain) before shipping to production.

## See also

- `examples/managed-agents-lesson-4-reusable-agent.md` — reuse the agent across every eval run
- `examples/managed-agents-lesson-8-define-outcomes.md` — the criteria format this harness scores against
- `examples/managed-agents-lesson-9-multiagent.md` — a natural candidate to evaluate against a single-agent baseline
- `examples/managed-agents-lesson-11-memory.md` — evaluate whether memory actually improves scores
- `managed-agents-lesson.md` — architecture reference
