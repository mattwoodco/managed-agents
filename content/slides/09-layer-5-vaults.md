---
order: 9
variant: content
topic: "Layer 5"
title: "Vaults — a safe deposit box"
---

## **Vaults** — a safe deposit box

### Think: the lock vs the key

The Agent knows the *shape* of the lock — it knows it needs Slack. The Session brings the ==user's actual key==. Build the product once; serve thousands of users without ever co-mingling their credentials.

<!-- col -->

**Label:** store a credential, then use it

```bash
# store the user's credential in a vault
curl -X POST https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -d '{"name": "slack_oauth", "value": "xoxb-..."}'

# attach it at session creation — agent never sees the secret
curl -X POST https://api.anthropic.com/v1/sessions \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -d '{"agent_id": "agt_...", "vault_ids": ["vlt_steve_slack"]}'
```

> Manage your *product* at the agent level. Manage your *users* at the session level.
