---
order: 12
variant: content
topic: "Trust"
title: "Permissions — how much rope?"
---

## **Permissions** — how much rope?

- **Always ask** — human approves every action — training wheels
- **Ask once** — approve at the start of a session, then run free
- **Always allow** — read-only or well-tested tasks — full autonomy

**Label:** set a permission policy

```bash
curl -X PATCH https://api.anthropic.com/v1/sessions/$ID/tools/slack \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -d '{"permission_policy": "always_ask"}'
```

> Trust isn't binary. ==Turn it tool-by-tool==, agent-by-agent, as confidence grows.
