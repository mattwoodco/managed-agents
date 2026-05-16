---
order: 10
variant: content
topic: "Layer 6"
title: "Outcomes — replace the back-and-forth"
---

## **Outcomes** — replace the back-and-forth

### Direct prompt

You ask. It answers. ==You== read it, decide if it's right, and re-ask until it is.

*You are the grader. You can't go to dinner.*

<!-- col -->

### Outcome

You state the rubric once. An ==independent grader== checks each draft and sends it back until it passes.

*You read the final draft only.*

**Label:** define an outcome

```bash
curl -X POST https://api.anthropic.com/v1/sessions/$ID/outcomes \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2026-04-01" \
  -d '{
    "rubric": "10 LinkedIn posts. Each under 280 chars. Each ends with a question.",
    "max_iterations": 5
  }'
# returns: status = satisfied | needs_revision | max_iterations_reached
```

> Conversation becomes ==work== the moment you can name "done."
