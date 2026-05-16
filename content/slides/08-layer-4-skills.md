---
order: 8
variant: content
topic: "Layer 4"
title: "Skills — a table of contents, not a textbook"
---

## **Skills** — a table of contents, not a textbook

### Think: scanning the index

Skills are folders of expertise. The agent scans the ==titles==, opens only the chapters it needs, ignores the rest. The whole library is *available*; the context window stays light.

<!-- col -->

**Label:** attach a skill

```bash
curl -X PATCH https://api.anthropic.com/v1/agents/$AGENT_ID \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2026-04-01" \
  -d '{
    "version": 3,
    "skills": [
      {"type": "anthropic", "skill": "docx"},
      {"type": "custom", "skill_id": "skl_brand_voice"}
    ]
  }'
```

> Progressive disclosure: ==load on demand==, not all at once. Deep expertise without token bloat.
