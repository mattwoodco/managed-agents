---
order: 7
variant: content
topic: "Layer 3"
title: "The Session — a workday"
---

## The **Session** — a workday

### Think: a desk that remembers

A worker clocks in, does the job, takes a break — and when they return, ==the papers are still on the desk==. Sessions checkpoint when idle and resume exactly where they left off.

<!-- col -->

**Label:** start a session

```bash
curl -X POST https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2026-04-01" \
  -d '{"agent_id": "agt_...", "environment_id": "env_..."}'

# send a message
curl -X POST https://api.anthropic.com/v1/sessions/$ID/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -d '{"content": "Draft next weeks campaign."}'

# container checkpoints on idle. resume tomorrow.
```

> Long jobs don't need to fit in one conversation. ==State survives sleep.==
