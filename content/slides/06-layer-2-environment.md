---
order: 6
variant: content
topic: "Layer 2"
title: "The Environment — a private office"
---

## The **Environment** — a private office

### Think: a clean desk in a locked room

A pre-built workspace with the right software already installed and ==locked doors== to systems the worker shouldn't touch. Same room shape, fresh for every workday.

<!-- col -->

**Label:** create an environment

```bash
curl -X POST https://api.anthropic.com/v1/environments \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2026-04-01" \
  -H "content-type: application/json" \
  -d '{
    "os": "ubuntu-22.04",
    "packages": ["python==3.12", "pandas==2.2.0"],
    "networking": "limited",
    "allowed_hosts": ["api.internal-data.com"]
  }'
```

> A reproducible container — secure, isolated, predictable. Your core systems stay untouched.
