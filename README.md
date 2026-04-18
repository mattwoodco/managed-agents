# Managed Agents Lessons

Hands-on lessons for the [Anthropic Managed Agents API](https://docs.anthropic.com/en/docs/about-claude/models/managed-agents). Every example runs from the terminal using `curl` and `jq` — no framework, no UI.

## Setup

You need an Anthropic API key with access to the managed-agents beta.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

Every request requires the beta header:

```
anthropic-beta: managed-agents-2026-04-01
```

Install `curl` and `jq` if you don't already have them.

## Lessons

| # | Lesson | Topic |
|---|--------|-------|
| 0 | [Hello World](lessons/managed-agents-lesson-0-hello-world.md) | Create an agent, environment, and session; stream events |
| 1 | [Prompt Playground](lessons/managed-agents-lesson-1-prompt-playground.md) | Vary the system prompt; compare outputs |
| 2 | [Tool-Using Agent](lessons/managed-agents-lesson-2-tool-using-agent.md) | `agent_toolset_20260401`, unrestricted networking, event trace |
| 3 | [Multi-Step Session](lessons/managed-agents-lesson-3-multi-step-session.md) | Keep one session alive across multiple turns |
| 4 | [Reusable Agent](lessons/managed-agents-lesson-4-reusable-agent.md) | Define an agent once; reuse across sessions |
| 5 | [Live Session](lessons/managed-agents-lesson-5-live-session.md) | Steer a running session in real time |
| 6 | [Real Files](lessons/managed-agents-lesson-6-real-files.md) | Upload PDFs, spreadsheets, and text; attach to a session |
| 7 | [Permission Policies](lessons/managed-agents-lesson-7-permission-policies.md) | Guardrails, human-in-the-loop approval, network restrictions |
| 8 | [Define Outcomes](lessons/managed-agents-lesson-8-define-outcomes.md) | Give the agent a success rubric; watch it self-evaluate |
| 9 | [Multiagent](lessons/managed-agents-lesson-9-multiagent.md) | Fan out to parallel specialist agents; stitch results |
| 10 | [Vaults / GitHub](lessons/managed-agents-lesson-10-vaults-github.md) | Credential vaults *(blocked in current beta)* |
| 11 | [Memory](lessons/managed-agents-lesson-11-memory.md) | Persist context across sessions *(blocked in current beta)* |
| 12 | [Evaluations](lessons/managed-agents-lesson-12-evaluations.md) | Score runs automatically; build a scorecard |
| 13 | [Skills](lessons/managed-agents-lesson-13-skills.md) | Attach Anthropic-provided skills (pdf, docx, xlsx) |
| 14 | [MCP](lessons/managed-agents-lesson-14-mcp.md) | Connect an HTTP MCP server to your agent |
| 15 | [Hardening](lessons/managed-agents-lesson-15-hardening.md) | Defend against adversarial inputs |

Start at lesson 0 and work forward — each lesson builds on the last.

## Presentations

Two slide decks are in [`presentations/`](presentations/):

- **managed-agents-concepts.pptx** — concepts and mental model
- **managed-agents-handson.pptx** — hands-on walkthrough

## What's Next

Once you've worked through the lessons, two extras in this repo show how to move beyond raw `curl`:

- **[`server/`](server/)** — a minimal single-file Bun proxy that holds your API key server-side and exposes `/run` + `/stream/:sessionId` endpoints so a browser can talk to Managed Agents safely.
- **[`cli/`](cli/)** — a `clapp`-based CLI that wraps the proxy. Instead of hand-crafting `curl` commands you run `bun src/index.ts <command>`. The CLI never calls Anthropic directly — all requests go through the proxy.

## Docs

[Managed Agents API reference](https://docs.anthropic.com/en/docs/about-claude/models/managed-agents)
