---
order: 5
variant: content
topic: "Layer 1"
title: "The Agent — a job description"
---

## The **Agent** — a job description

### Think: hiring paperwork

An Agent is who the worker is and ==what tools the role is allowed to touch==. Same Agent can be hired into many jobs — the description doesn't change between shifts.

<!-- col -->

**Label:** create an agent

```bash
curl -X POST https://api.anthropic.com/v1/agents \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "name": "social-asset-generator",
    "model": {"id": "claude-opus-4-7"},
    "system": "You draft social posts...",
    "tools": [{"type": "agent_toolset_20260401"}]
  }'
```

> One Agent definition, versioned and reused. The ==brain==, separated from any single task.
