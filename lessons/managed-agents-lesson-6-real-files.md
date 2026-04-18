# Managed Agents: make the agent useful on real files

**Lesson 6** (real files; follows lessons 0–5): upload real files (PDF transcript, essay draft, spreadsheet), attach them to a session, and use the agent to analyze and synthesize. This is where the system becomes truly useful: the agent works on your actual documents, not just text prompts.

## Why this step matters

Previous examples worked with pure text prompts. Real agents work on real documents. This lesson introduces the Files API and shows how to mount files into a session so the agent can read, analyze, and extract insights. You'll also learn to define clear success criteria so you know when the agent has done good work.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Three sample files:
  - A **PDF transcript** (transcript.pdf) — can be a real college transcript or a sample
  - An **essay draft** (essay.txt) — a short college application essay
  - A **spreadsheet** (scholarships.csv) — a list of scholarships with deadlines and amounts

If you don't have these files, create minimal samples:

```bash
# Sample transcript (as text; you'll save it as a PDF for realism)
cat > transcript.txt <<'EOF'
COLLEGE TRANSCRIPT
Student: Jane Doe
Major: Computer Science
Term: Fall 2023
GPA: 3.75

Courses:
CS 101 - Introduction to Computer Science: A
MATH 201 - Calculus II: A-
PHYS 101 - Physics I: B+
ENG 101 - English Composition: A

Cumulative GPA: 3.75
EOF

# Sample essay
cat > essay.txt <<'EOF'
My passion for computer science began in 8th grade when I built my first website. 
Since then, I have grown from a curious learner to someone who understands how 
software shapes society. I want to attend a school where I can challenge myself 
and contribute to meaningful projects.
EOF

# Sample scholarships
cat > scholarships.csv <<'EOF'
Name,Amount,Deadline,Requirements
TechFuture Scholarship,5000,2024-12-31,GPA 3.5+
STEM Excellence Award,10000,2024-11-30,CS major
Diversity in Tech Grant,7500,2025-01-15,Underrepresented group
Community Impact Fund,3000,2024-12-15,Service hours
EOF
```

For a real PDF, use any PDF-to-text tool or upload a real transcript.

## Mental model

- **Files API**: Upload documents to Anthropic; receive file IDs
- **Session attachment**: Include file IDs when sending a user message
- **Agent access**: The agent can read and reference these files in its response
- **Success criteria**: Define what "good work" looks like before the agent starts (rubric, checklist, metrics)
- **Synthesis**: The agent combines insights from multiple files into structured output

## Setup: Create environment and agent

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"file-agent-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"application-reviewer-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a college application review assistant. You analyze transcripts, essays, and scholarship opportunities. Provide clear, structured feedback: strengths, areas for growth, and actionable next steps. Always cite the source document.\"}" | jq -r .id)

SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"Application review session\"}" | jq -r .id)

echo "SESSION_ID=$SESSION_ID"
```

## Step 1: Upload files

Use the Files API to upload your documents. Each file gets a file ID.

**Plaintext vs PDF:** Document blocks in the next step only accept **PDF** or **plaintext**. A `.csv` uploaded with the default form field often comes back as `application/octet-stream` or `text/csv`, which the API may reject when attached as a document. Upload tabular text as **plaintext** (below) or save the same content as a `.txt` file.

```bash
# Upload transcript (PDF or .txt — both work as documents)
TRANSCRIPT_RESPONSE=$(curl -sS https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "file=@transcript.pdf")

TRANSCRIPT_FILE_ID=$(echo "$TRANSCRIPT_RESPONSE" | jq -r .id)

echo "Transcript file ID: $TRANSCRIPT_FILE_ID"

# Upload essay
ESSAY_RESPONSE=$(curl -sS https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "file=@essay.txt")

ESSAY_FILE_ID=$(echo "$ESSAY_RESPONSE" | jq -r .id)

echo "Essay file ID: $ESSAY_FILE_ID"

# Upload scholarships: force plaintext MIME so the file can be attached as a document block
SCHOLARSHIPS_RESPONSE=$(curl -sS https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "file=@scholarships.csv;type=text/plain")

SCHOLARSHIPS_FILE_ID=$(echo "$SCHOLARSHIPS_RESPONSE" | jq -r .id)

echo "Scholarships file ID: $SCHOLARSHIPS_FILE_ID"
```

## Step 2: Send a message with attached files

Send your prompt with **one `text` block plus one `document` block per file**. Each document uses `source.type: "file"` and the uploaded `file_id`. (A top-level `file_ids` field on `user.message` is not accepted by the API.)

```bash
TEXT='Review my application profile. Analyze my transcript, essay, and scholarship eligibility. Then create a prioritized checklist of the top 3 scholarships I should apply for, with specific deadlines and any essay or GPA requirements I need to meet.'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n \
    --arg t "$TEXT" \
    --arg f1 "$TRANSCRIPT_FILE_ID" \
    --arg f2 "$ESSAY_FILE_ID" \
    --arg f3 "$SCHOLARSHIPS_FILE_ID" \
    '{events:[{type:"user.message",content:[
      {type:"text",text:$t},
      {type:"document",source:{type:"file",file_id:$f1}},
      {type:"document",source:{type:"file",file_id:$f2}},
      {type:"document",source:{type:"file",file_id:$f3}}
    ]}]}')"

# Stream the response
curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

**Wait for `session.status_idle`.**

## Step 3: Define success and evaluate

After the agent completes, check whether its output meets your criteria. Below is a simple rubric you would apply manually or script into a follow-up evaluation turn.

### Success Criteria Rubric

| Criterion | Evidence | Weight |
| --- | --- | --- |
| **Transcript analyzed** | Agent mentions GPA, course grades, or major | 25% |
| **Essay reviewed** | Agent provides feedback on the essay or highlights a strength | 25% |
| **Scholarship mapping** | Agent identifies which scholarships match the student's profile | 25% |
| **Actionable checklist** | Agent provides a ranked list with specific deadlines and next steps | 25% |

### Manual evaluation

Review the agent's output and score it (0–1) on each criterion. Sum and divide by 4 to get an overall score. Example:

```
Transcript analyzed: 1.0 (mentioned 3.75 GPA and CS courses)
Essay reviewed: 0.8 (gave feedback but could have been more specific)
Scholarship mapping: 1.0 (listed top 3 scholarships and eligibility)
Actionable checklist: 0.9 (provided deadlines but missed one requirement detail)

Overall: (1.0 + 0.8 + 1.0 + 0.9) / 4 = 0.925
```

### Script-based evaluation (optional)

Send a follow-up turn to the same session asking the agent to self-score or refine:

```bash
EVAL_TEXT='Score your own response on the rubric I just mentioned. What did you do well? What could you improve?'

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$EVAL_TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

## What to watch

| Observed event | Meaning |
| --- | --- |
| `user.message` with `document` content blocks (`source.type: file`) | Your prompt now includes file references |
| `span.model_request_start` / `span.model_request_end` | Claude processes all three files plus your prompt |
| `agent.message` | The agent's response, ideally synthesizing insights from all files |
| `session.status_idle` | Task complete |

Pay attention to:

- Does the agent mention facts from the transcript (GPA, courses)?
- Does it quote or paraphrase the essay?
- Does it cross-reference the scholarship data with the student's profile?
- Is the final checklist organized and actionable?

## Success

This lesson succeeds if:

1. All three files upload without errors (check file IDs are returned).
2. The agent's response clearly references content from all three files.
3. The output includes a structured checklist or action plan.
4. You can evaluate the response against the rubric and score ≥ 0.7 on all criteria.

## Upgrade (optional)

1. **Add more file types**: Upload a recommendation letter (PDF), a resume, or a video transcript. The agent can synthesize across more documents.
2. **Iterative refinement**: Send a follow-up message asking the agent to expand the checklist or add more scholarship options.
3. **Export as structured data**: Ask the agent to format the final checklist as JSON, then parse it programmatically.
4. **A/B test different prompts**: Upload the same files twice, but send different system prompts or user messages. Score each response on the rubric and compare.
5. **Batch processing**: Create a loop that processes 10 students' files in parallel, storing file IDs and session results in a database.

## Common Patterns

### File upload error handling

If a file upload fails, the API will return an error. Always check:

```bash
FILE_RESPONSE=$(curl -sS https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "file=@myfile.txt")

# Check for errors
if echo "$FILE_RESPONSE" | jq -e '.error' > /dev/null; then
  echo "Upload failed: $(echo "$FILE_RESPONSE" | jq -r .error.message)"
else
  FILE_ID=$(echo "$FILE_RESPONSE" | jq -r .id)
  echo "Upload succeeded: $FILE_ID"
fi
```

### Large file handling

For large PDFs or spreadsheets, the upload may take longer. Increase curl timeout:

```bash
curl --max-time 300 -sS https://api.anthropic.com/v1/files \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "file=@large_file.pdf"
```

## See also

- `examples/managed-agents-lesson-0-hello-world.md` for the minimal baseline
- `examples/managed-agents-lesson-4-reusable-agent.md` for agent configuration
- `examples/managed-agents-lesson-5-live-session.md` for multi-turn session steering
- `examples/managed-agents-lesson-3-multi-step-session.md` for session persistence
- `managed-agents-lesson.md` for architecture and advanced patterns
