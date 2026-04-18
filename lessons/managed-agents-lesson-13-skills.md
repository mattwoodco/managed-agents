# Managed Agents: package a capability as a Skill (TypeScript + Bun)

> **API status (2026-04-17):** Custom-skill *upload* (`POST /v1/skills`) is not currently exposed by the managed-agents beta — that endpoint returns 404. What works today is **attaching an Anthropic-provided skill** to an agent via the `skills: [{type: "anthropic", skill_id: "..."}]` field (confirmed IDs: `pdf`, `docx`, `xlsx`). The rest of this lesson describes the intended authoring flow; Steps 2 and 5 will 404 until the upload API ships. See "Step 3 (verified)" below for a working minimal end-to-end example.

**Lesson 13** (skills; follows lessons 0–12): author a reusable **Skill** as a small TypeScript project, upload it to the platform, attach it to an agent, and watch the agent discover and apply it. This is how you stop pasting the same "here's how to parse invoices / format reports / run this workflow" instructions into every prompt and start shipping *capabilities*.

## Why this step matters

Through Lesson 12 the agent's capabilities came from three sources: the built-in toolset, tools you defined, and delegation to subagents (Lesson 9). Skills are a fourth source — **packaged capability bundles** (instructions + code + examples) that any agent can opt into. A skill is to an agent what a library is to a program: modular, versioned, testable. And now that you have an eval harness (Lesson 12), you can actually measure whether attaching a skill makes your agent better.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- `bun` installed locally (`curl -fsSL https://bun.sh/install | bash`). You only need it to author and test the skill locally; the managed agent sandbox runs it.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 4 (reusable agent) and Lesson 12 (eval harness).

## Mental model

- **Skill**: a folder with a `SKILL.md` (instructions, when to use, examples), optional scripts, and optional input/output schemas.
- **SKILL.md** is the agent-facing contract. It tells the agent *when* to reach for the skill and *how* to call it.
- **Scripts** run inside the sandbox. Bun ships as a single binary, handles TypeScript natively, and needs no `package.json` or `npm install` for this lesson.
- **Upload**: the skill folder is bundled and registered with the platform; you get a `skill_id`.
- **Attach**: list the skill in the agent's `skills` field. The agent sees it at session start.
- **Versioning**: edit the skill, re-upload, bump version. Pin a session to a specific version or always use latest (same model as Lesson 4's agent versioning).

## Step 1: Author the skill locally

Create a folder `invoice-parser-skill/` with this layout:

```
invoice-parser-skill/
├── SKILL.md
├── parse.ts
└── examples/
    ├── input-acme.txt
    └── output-acme.json
```

### SKILL.md

````markdown
---
name: invoice-parser
description: Extract structured fields (vendor, invoice number, total, due date, line items) from messy invoice text or PDFs.
version: 1.0.0
---

# Invoice parser

## When to use this skill

Use when the user provides one or more invoices (as plain text, PDF content, or a file attachment) and wants structured data out — totals, due dates, line items. Do **not** use for general receipts or purchase orders.

## How to use it

1. For each invoice, write its raw text to a file named `invoice-N.txt` inside the sandbox.
2. Run the parser:

   ```bash
   bun run parse.ts invoice-1.txt invoice-2.txt
   ```

3. The script prints one JSON object per invoice to stdout, one per line (JSONL).
4. Aggregate the results and present them as a table to the user. Flag any invoice where `confidence < 0.7` for manual review.

## Output shape

```json
{
  "invoice_number": "INV-2026-0412",
  "vendor": "Acme Supplies",
  "issue_date": "2026-04-01",
  "due_date": "2026-05-01",
  "currency": "USD",
  "total": 1428.50,
  "line_items": [
    {"description": "Widgets x 10", "amount": 1200.00}
  ],
  "confidence": 0.92
}
```

## Examples

See `examples/input-acme.txt` and `examples/output-acme.json`.

## Constraints

- Never invent values. If a field is missing, emit `null` and lower confidence.
- Dates must be ISO-8601 (`YYYY-MM-DD`).
- If the input is not an invoice, return `{"error": "not_an_invoice"}` for that item and stop.
````

### parse.ts

```typescript
#!/usr/bin/env bun

type LineItem = { description: string; amount: number | null };

type Invoice = {
  invoice_number: string | null;
  vendor: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  total: number | null;
  line_items: LineItem[];
  confidence: number;
};

const MONEY = /([A-Z]{3})?\s*\$?\s*([0-9]{1,3}(?:[,0-9]{0,12})(?:\.[0-9]{2})?)/;
const DATE = /\b(\d{4}-\d{2}-\d{2})\b/;
const INV = /\b(INV[-\s]?[A-Z0-9-]+)\b/i;

function parseMoney(s: string): number | null {
  const m = s.match(MONEY);
  if (!m) return null;
  const n = Number(m[2].replaceAll(",", ""));
  return Number.isFinite(n) ? n : null;
}

function parseInvoice(text: string): Invoice {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let confidence = 0;

  const invoiceNumber = text.match(INV)?.[1]?.toUpperCase() ?? null;
  if (invoiceNumber) confidence += 0.25;

  const dates = [...text.matchAll(new RegExp(DATE, "g"))].map((m) => m[1]);
  const issueDate = dates[0] ?? null;
  const dueDate = dates.find((d) => d !== issueDate) ?? null;
  if (issueDate) confidence += 0.15;
  if (dueDate) confidence += 0.15;

  const vendorLine = lines.find((l) => /^(from|vendor|bill(ed)? from)\s*[:\-]/i.test(l));
  const vendor = vendorLine?.split(/[:\-]/).slice(1).join(":").trim() || lines[0] || null;
  if (vendor) confidence += 0.15;

  const totalLine = lines.find((l) => /\btotal\b/i.test(l) && !/sub ?total/i.test(l));
  const total = totalLine ? parseMoney(totalLine) : null;
  if (total !== null) confidence += 0.2;

  const currency = totalLine?.match(MONEY)?.[1] ?? "USD";

  const line_items: LineItem[] = lines
    .filter((l) => /\$|\d+\.\d{2}/.test(l) && !/total/i.test(l))
    .map((l) => ({ description: l.replace(MONEY, "").trim() || l, amount: parseMoney(l) }));
  if (line_items.length > 0) confidence += 0.1;

  const looksLikeInvoice = /invoice|bill to|amount due/i.test(text);
  if (!looksLikeInvoice) {
    return {
      invoice_number: null, vendor: null, issue_date: null, due_date: null,
      currency: null, total: null, line_items: [], confidence: 0,
    };
  }

  return {
    invoice_number: invoiceNumber,
    vendor,
    issue_date: issueDate,
    due_date: dueDate,
    currency,
    total,
    line_items,
    confidence: Math.min(1, Number(confidence.toFixed(2))),
  };
}

const files = Bun.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: bun run parse.ts <file.txt> [file2.txt ...]");
  process.exit(2);
}

for (const path of files) {
  const text = await Bun.file(path).text();
  const isInvoice = /invoice|bill to|amount due/i.test(text);
  const out = isInvoice ? parseInvoice(text) : { error: "not_an_invoice", file: path };
  console.log(JSON.stringify(out));
}
```

### examples/input-acme.txt

```
Acme Supplies Co.
Invoice INV-2026-0412
Issue date: 2026-04-01
Due date:   2026-05-01

Bill to: Globex, Inc.

Widgets x 10 ............ $1,200.00
Shipping ................    $50.00
Tax (9.5%) ..............   $178.50

Total: USD $1,428.50
```

### examples/output-acme.json

```json
{
  "invoice_number": "INV-2026-0412",
  "vendor": "Acme Supplies Co.",
  "issue_date": "2026-04-01",
  "due_date": "2026-05-01",
  "currency": "USD",
  "total": 1428.50,
  "line_items": [
    {"description": "Widgets x 10", "amount": 1200.00},
    {"description": "Shipping", "amount": 50.00},
    {"description": "Tax (9.5%)", "amount": 178.50}
  ],
  "confidence": 0.95
}
```

### Smoke-test locally

```bash
cd invoice-parser-skill
bun run parse.ts examples/input-acme.txt
```

You should see one line of JSON that matches the example output. If it doesn't, fix the skill *before* uploading — the agent can only be as good as the underlying script.

## Step 2: Upload the skill

```bash
cd invoice-parser-skill
tar -czf ../invoice-parser-skill.tgz .
cd ..

SKILL_RESPONSE=$(curl -sS https://api.anthropic.com/v1/skills \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "bundle=@invoice-parser-skill.tgz" \
  -F 'metadata={"name":"invoice-parser","runtime":"bun"}')

SKILL_ID=$(echo "$SKILL_RESPONSE" | jq -r .id)
SKILL_VERSION=$(echo "$SKILL_RESPONSE" | jq -r .version)

echo "SKILL_ID=$SKILL_ID"
echo "SKILL_VERSION=$SKILL_VERSION"
```

## Step 3: Attach the skill to an agent

```bash
SUFFIX=$(date +%s)

ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"skill-env-$SUFFIX\",\"config\":{\"type\":\"cloud\",\"networking\":{\"type\":\"unrestricted\"},\"runtime\":{\"packages\":[\"bun\"]}}}" | jq -r .id)

AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "invoice-agent-'"$SUFFIX"'",
    "model": "claude-opus-4-6",
    "tools": [{"type": "agent_toolset_20260401"}],
    "skills": [{"type": "custom", "skill_id": "'"$SKILL_ID"'"}],
    "system": "You are an accounts-payable assistant. When the user provides invoice text or files, consult your available skills before improvising. Prefer running the invoice-parser skill over hand-parsing. Summarize results in a clean markdown table."
  }' | jq -r .id)

echo "AGENT_ID=$AGENT_ID"
```

### Step 3 (verified): attach an Anthropic-provided skill

If the custom-skill endpoints above 404 in your beta, this minimal variant is confirmed to work today. It attaches the `pdf` skill (also available: `docx`, `xlsx`):

```bash
AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "pdf-skill-agent-'"$(date +%s)"'",
    "model": "claude-opus-4-6",
    "tools": [{"type": "agent_toolset_20260401"}],
    "skills": [{"type": "anthropic", "skill_id": "pdf"}],
    "system": "Prefer the pdf skill when handling PDF inputs."
  }' | jq -r .id)

echo "AGENT_ID=$AGENT_ID"
```

The agent response will echo `"skills":[{"skill_id":"pdf","type":"anthropic","version":"latest"}]`.

## Step 4: Run a session that exercises the skill

```bash
SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"AP batch\"}" | jq -r .id)

TEXT='I have three invoices pasted below. Parse them, give me a table of vendor, total, due date, and confidence, and flag anything under 0.7 confidence.

--- Invoice A ---
Acme Supplies Co.
Invoice INV-2026-0412
Issue date: 2026-04-01
Due date:   2026-05-01
Bill to: Globex, Inc.
Widgets x 10 ............ $1,200.00
Total: USD $1,428.50

--- Invoice B ---
Vendor: Contoso LLC
INV 2026 77
4/5/2026
Total due: $914

--- Invoice C ---
Hey just a reminder lunch is on Friday, no agenda yet
'

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

You should see the agent write each invoice to a temp file, run `bun run parse.ts …`, and then synthesize a markdown table. Invoice C should end up flagged as `not_an_invoice`.

## Step 5: Version the skill

Edit `parse.ts` or `SKILL.md` — for example, raise the confidence threshold constraint — and re-upload:

```bash
tar -czf ../invoice-parser-skill.tgz -C invoice-parser-skill .
curl -sS https://api.anthropic.com/v1/skills/$SKILL_ID/versions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -F "bundle=@../invoice-parser-skill.tgz"
```

The next session that starts picks up the new version. You can pin an agent to a specific `version` if you need reproducibility.

## Step 6: Plug the skill into your eval harness

Reuse the Lesson 12 harness. Produce two scorecards:

1. **Without the skill**: agent attempts to parse invoices from the prompt alone.
2. **With the skill**: same cases, same outcome criteria, skill attached.

Diff the scorecards with `diff <(jq -S . runs-no-skill/scorecard.json) <(jq -S . runs-with-skill/scorecard.json)`. If the skill helps, the per-criterion pass rate for "fields extracted correctly" should jump. If it doesn't, your `SKILL.md` — not your code — is usually the problem.

## What to watch

| Event / artifact | Meaning |
| --- | --- |
| `skill.injected` at session start | Platform surfaced your `SKILL.md` into agent context |
| `agent.tool_use` with `bash` running `bun run parse.ts` | Skill in active use |
| `agent.message` that hand-parses instead of calling the skill | `SKILL.md` "when to use" section isn't decisive enough |
| `session.status_idle` with a clean table and a flagged row | Success |

## Success

This lesson succeeds if:

1. `bun run parse.ts examples/input-acme.txt` passes locally before upload.
2. The agent chooses the skill on its own — you don't have to name it in the user prompt.
3. Editing `SKILL.md` and re-uploading changes the agent's behavior in the next session.
4. The with-skill scorecard beats the without-skill scorecard on the relevant criteria.

## Upgrade (optional)

1. **Schema enforcement**: add a `schemas/output.json` JSON Schema file to the skill and have `parse.ts` validate its output before printing.
2. **Multi-script skill**: add `reconcile.ts` that matches extracted invoices against a CSV of expected POs. `SKILL.md` routes to the right script based on intent.
3. **Private skills per agent**: mark the skill as scoped to one agent; upload a different version per team.
4. **Pair with Lesson 6**: accept PDF input by calling `pdftotext` (or the Files API) inside `parse.ts` before the regex pass.
5. **Pair with Lesson 11**: teach the agent (via memory) which vendors consistently need manual review, so it flags them regardless of confidence.

## See also

- `examples/managed-agents-lesson-4-reusable-agent.md` — same versioning model, now for skills
- `examples/managed-agents-lesson-6-real-files.md` — skills pair naturally with file inputs
- `examples/managed-agents-lesson-12-evaluations.md` — the harness that tells you if a skill is actually helping
- `examples/managed-agents-lesson-14-mcp.md` — another way to extend the agent, with different trade-offs
