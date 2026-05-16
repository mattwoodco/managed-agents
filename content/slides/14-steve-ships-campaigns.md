---
order: 14
variant: content
topic: "A day in the life"
title: "Steve ships a week of campaigns over the weekend"
---

## Steve ships a week of **campaigns** over the weekend

### The human story

- ==Friday 5:30pm== — Steve kicks off the agent: "Draft next week's launch posts for LinkedIn, X, and Instagram."
- ==5:35pm== — He closes his laptop and goes home for the weekend.
- ==Monday 8:00am== — His phone buzzes. The agent is done.
- ==8:10am== — He reviews 15 posts and 5 images. Approves them. Coffee.

<!-- col -->

### Under the hood

- `POST /sessions` with the social-asset-generator agent
- Session checkpoints when Steve disconnects
- Grader returns `satisfied` on iteration 3
- Webhook fires; Steve gets the artifact link

> The agent worked ==most of the weekend==. Steve worked ten minutes.
