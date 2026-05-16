---
order: 11
variant: content
topic: "Async"
title: "Webhooks — call me when it's done"
---

## Webhooks — **call me** when it's done

### Think: a tap on the shoulder

You don't sit and wait. You hand off the job, ==go to dinner==, and the agent calls you back when the artifact is ready. Hours of work happen in the background.

<!-- col -->

**Label:** register a webhook + receive it

```bash
# tell the platform where to call you
curl -X POST https://api.anthropic.com/v1/webhooks \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -d '{"url": "https://yourapp.com/hook", "events": ["session.outcome.satisfied"]}'

# later, you receive:
# POST https://yourapp.com/hook
# { "id": "evt_...", "type": "session.outcome.satisfied", "session_id": "sess_..." }
# fetch the artifact with a GET on receipt.
```

> Long jobs no longer block humans. ==Work that finishes itself.==
