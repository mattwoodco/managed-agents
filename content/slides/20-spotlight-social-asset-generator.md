---
order: 20
variant: content
topic: "Spotlight"
title: "Social Asset Generator — the full template"
---

## Social Asset Generator — **the full template**

**Label:** social-asset-generator.yaml

```yaml
name: Social asset generator
model: claude-sonnet-4-6
system: |
  You draft a week of social posts
  across LinkedIn, X, and Instagram
  with images and schedules them.

  1. Read the brand brief
  2. Draft posts per platform tone
  3. Generate images in Figma
  4. Schedule via Buffer
  5. Notify the team in Slack
mcp_servers:
  - figma
  - buffer
  - slack
tools:
  - agent_toolset_20260401
```

<!-- col -->

### Why this template

==claude-sonnet-4-6== — fast and cost-effective. This work is volume, not depth.

==Three MCP servers== — the toolbelt is the whole point. Each one is a tab a marketer would otherwise switch between.

==Numbered system prompt== — five clear steps. The agent has a playbook, not a vibe.

> Clone it. Swap *Buffer* for your scheduler. ==Ship Monday.==
