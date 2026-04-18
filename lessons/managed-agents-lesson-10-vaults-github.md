# Managed Agents: give the agent credentials with vaults (GitHub)

> **API status (2026-04-17):** This lesson as originally written is **blocked** by the managed-agents beta. Verified findings:
>
> - `POST /v1/vaults` works, but the body field is `display_name`, not `name`. The returned type is `vault`.
> - Vault sub-resources live at `/v1/vaults/{id}/credentials` — **not** `/entries`. `POST .../entries` returns 404.
> - A credential's `auth.type` must be one of **`mcp_oauth`** or **`static_bearer`**. There is no generic "arbitrary secret" or "env var" credential type. Every credential requires an `auth.mcp_server_url`, so vaults are scoped to **MCP server authentication only**.
> - `Environment.config.vault_bindings` is **rejected** (`"config.vault_bindings: Extra inputs are not permitted"`). There is no primitive for exposing a vault value as an environment variable inside the sandbox.
> - Consequently, the "store a GitHub PAT, expose as `$GITHUB_TOKEN`, run `gh`" workflow below is not achievable with today's API. The underlying sandbox `agent_toolset_20260401` also does not ship with `gh` preinstalled, and there is no `env` or `secrets` field on Environment to inject one.
>
> The correct primitive today for "let the agent call GitHub as me" is to register GitHub as an **MCP server** on the Agent and store its bearer/OAuth credential in a vault; see Lesson 14 for the MCP wiring pattern. The working shapes (verified against the live API) are:
>
> ```bash
> # 1. Create a vault
> curl -sS https://api.anthropic.com/v1/vaults \
>   -H "x-api-key: $ANTHROPIC_API_KEY" \
>   -H "anthropic-version: 2023-06-01" \
>   -H "anthropic-beta: managed-agents-2026-04-01" \
>   -H "content-type: application/json" \
>   -d '{"display_name":"agent-secrets"}'
>
> # 2. Add a static-bearer credential scoped to an MCP server URL
> curl -sS https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials \
>   -H "x-api-key: $ANTHROPIC_API_KEY" \
>   -H "anthropic-version: 2023-06-01" \
>   -H "anthropic-beta: managed-agents-2026-04-01" \
>   -H "content-type: application/json" \
>   -d '{"display_name":"github_pat","auth":{"type":"static_bearer","token":"ghp_...","mcp_server_url":"https://api.github.com/"}}'
> ```
>
> The rest of this lesson is preserved as the *intended* authoring flow for when generic vault bindings ship. Do not expect Steps 2–5 to execute today; Steps 1 and 5 (the vault+credential CRUD) will work if you substitute the field names and sub-path above.

**Lesson 10** (vaults + GitHub; follows lessons 0–9): store a GitHub token in a vault, attach it to an environment, and let the agent open a pull request on a real repo. This is the first lesson where the agent acts on an external system with your identity — which is exactly why Lesson 7 (policies) had to come first.

## Why this step matters

So far the agent has only read things. Real workflows want it to *do* things in systems you already use: GitHub, Jira, a database, an internal API. That means handing it credentials — without pasting tokens into prompts, into the system message, or into plain environment variables on disk. Vaults are the managed platform's answer: a credential lives in a vault, a scoped reference lives in your environment, and the raw secret is only ever materialized inside the sandbox at run time.

## Prerequisites

- `ANTHROPIC_API_KEY` available in your shell environment.
- `curl` and `jq` installed.
- Include `anthropic-beta: managed-agents-2026-04-01` on every request.
- Completed Lesson 7 (permission policies) — you'll reuse the restricted-env mental model.
- A GitHub **fine-grained personal access token** with `Contents: Read and write` and `Pull requests: Read and write` scoped to **one** test repo (e.g. `yourname/agent-sandbox`). Do not use a classic token. Save it as `$GITHUB_TOKEN` in your shell, one time, so you can paste it into the vault.

## Mental model

- **Vault**: a named, encrypted store owned by your org. One vault can hold many entries.
- **Entry**: one secret (`github_pat`, `db_url`, etc.) addressed by key.
- **Binding**: an environment declares "expose entry X as env var Y inside the sandbox."
- **Exposure window**: the secret is materialized only while a session is running; it is never returned to you in an API response.
- **Rotation**: update the entry; existing environments pick up the new value on the next session.

## Step 1: Create a vault and add the GitHub token

```bash
SUFFIX=$(date +%s)

VAULT_ID=$(curl -sS https://api.anthropic.com/v1/vaults \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"agent-secrets-$SUFFIX\"}" | jq -r .id)

echo "VAULT_ID=$VAULT_ID"

curl -sS https://api.anthropic.com/v1/vaults/$VAULT_ID/entries \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg v "$GITHUB_TOKEN" '{key:"github_pat", value:$v, description:"Fine-grained PAT, sandbox repo only"}')"
```

**Verify** the entry is listed (the response will show the key and metadata, but **not** the value):

```bash
curl -sS https://api.anthropic.com/v1/vaults/$VAULT_ID/entries \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" | jq '.entries[] | {key, description}'
```

## Step 2: Create an environment that binds the vault entry

The environment exposes `github_pat` as `$GITHUB_TOKEN` inside the sandbox, and restricts network to GitHub only.

```bash
ENVIRONMENT_ID=$(curl -sS https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "github-env-'"$SUFFIX"'",
    "config": {
      "type": "cloud",
      "networking": {"type": "restricted", "allowed_domains": ["api.github.com", "github.com"]},
      "vault_bindings": [
        {"vault_id": "'"$VAULT_ID"'", "key": "github_pat", "env_var": "GITHUB_TOKEN"}
      ],
      "permissions": {
        "rules": [
          {"match": {"tool": "bash", "command_prefix": ["gh", "git", "cat", "ls", "echo", "grep"]}, "decision": "allow"},
          {"match": {"tool": "bash"}, "decision": "ask"}
        ]
      }
    }
  }' | jq -r .id)

echo "ENVIRONMENT_ID=$ENVIRONMENT_ID"
```

The secret never leaves the platform boundary: you wrote it into the vault once, and the environment holds a pointer to it, not the value.

## Step 3: Create a GitHub-aware agent

```bash
AGENT_ID=$(curl -sS https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"name\":\"github-agent-$SUFFIX\",\"model\":\"claude-opus-4-6\",\"tools\":[{\"type\":\"agent_toolset_20260401\"}],\"system\":\"You are a GitHub operations assistant. Authenticate using \\\$GITHUB_TOKEN (already set in your environment). Prefer the GitHub CLI (gh) or the REST API at api.github.com. Never print the token. When making changes, always open a pull request rather than pushing directly to main.\"}" | jq -r .id)

echo "AGENT_ID=$AGENT_ID"
```

## Step 4: Start a session and ask for a real PR

Replace `OWNER/REPO` with your sandbox repo.

```bash
SESSION_ID=$(curl -sS https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "{\"agent\":\"$AGENT_ID\",\"environment_id\":\"$ENVIRONMENT_ID\",\"title\":\"GitHub PR run\"}" | jq -r .id)

REPO="OWNER/REPO"
TEXT="Clone $REPO, create a branch named agent/changelog-1.4, add or update CHANGELOG.md with a new '## 1.4.0' section dated today that lists three plausible example entries, commit, push, and open a pull request titled 'chore: changelog for 1.4.0'. Report the PR URL at the end."

curl -sS https://api.anthropic.com/v1/sessions/$SESSION_ID/events \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg t "$TEXT" '{events:[{type:"user.message",content:[{type:"text",text:$t}]}]}')"

curl -sS -N --max-time 900 https://api.anthropic.com/v1/sessions/$SESSION_ID/events/stream \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01"
```

You should see the agent run `gh auth status` (or similar), clone, edit, commit, push, and then `gh pr create`. The final `agent.message` should include the PR URL.

## Step 5: Rotate the token

Rotation is the test that proves the indirection works. Update the entry in place and run the same session flow again — no agent or environment changes.

```bash
NEW_TOKEN="ghp_newvalue..."
curl -sS -X PATCH https://api.anthropic.com/v1/vaults/$VAULT_ID/entries/github_pat \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "anthropic-beta: managed-agents-2026-04-01" \
  -H "content-type: application/json" \
  -d "$(jq -n --arg v "$NEW_TOKEN" '{value:$v}')"
```

The next session you start will see the new value. Old sessions, if still live, continue with the value they were launched with.

## What to watch

| Event | Meaning |
| --- | --- |
| `agent.tool_use` with `bash` calling `gh` or `git` | Agent is acting with your identity |
| `permission.request` for anything unexpected | Your allowlist is working — approve or deny |
| `agent.message` containing the token | **Should never happen.** If it does, revoke immediately and tighten the system prompt |
| `session.status_idle` with a PR URL in the final message | Success |

## Success

This lesson succeeds if:

1. The vault entry exists and its value is never visible in any API response.
2. The agent successfully opens a PR on your sandbox repo.
3. Network calls to non-GitHub hosts are denied in the journal.
4. After rotation, a fresh session authenticates with the new token without any config change.

## Upgrade (optional)

1. **Multiple repos, one agent**: create a second environment bound to the same vault entry but with a different `allowed_domains` profile (e.g. GitHub Enterprise). Same agent, different scopes.
2. **Scoped subagents**: combine with Lesson 9 so an orchestrator delegates *read-only* research to a subagent in a no-secret environment and reserves the token-bearing environment for the "make changes" specialist.
3. **Add a DB secret**: put a read-only `DATABASE_URL` in the same vault, bind it to a different environment, and have the agent run read-only analytics queries.
4. **Audit**: after the session, `GET /sessions/{id}/events | jq '.data[] | select(.type=="agent.tool_use")'` to produce a full record of what was run with your token.

## See also

- `examples/managed-agents-lesson-4-reusable-agent.md` — the agent pattern reused here
- `examples/managed-agents-lesson-7-permission-policies.md` — the guardrails that make this safe
- `examples/managed-agents-lesson-11-memory.md` — persistence for what the agent learns about your repo
- `examples/managed-agents-lesson-9-multiagent.md` — scope secrets per subagent
