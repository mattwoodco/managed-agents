import { useState, useEffect, useCallback, useRef } from 'react'
import './App.css'

const LOGO_SRC = `${import.meta.env.BASE_URL}gauntlet-logo.png`

/* ─────────────────────────────────────────────
   Reusable Components
   ───────────────────────────────────────────── */

function Code({ label, children }) {
  return (
    <div className="code-block">
      {label && <div className="code-label">{label}</div>}
      <pre><code>{children}</code></pre>
    </div>
  )
}

function LayerSlide({ topic, h2Lead, h2Gold, h2Tail, analogyLead, analogyBody, codeLabel, code, footer }) {
  return (
    <>
      <div className="topic-label">{topic}</div>
      <h2>{h2Lead}<span className="gold">{h2Gold}</span>{h2Tail}</h2>
      <div className="evidence">
        <div className="two-col">
          <div className="col">
            <h3>{analogyLead}</h3>
            <p>{analogyBody}</p>
          </div>
          <div className="col">
            <Code label={codeLabel}>{code}</Code>
          </div>
        </div>
        {footer && (
          <div className="emphasis-box">
            <p>{footer}</p>
          </div>
        )}
      </div>
    </>
  )
}

/* ─────────────────────────────────────────────
   Slides — From Chatbots to Digital Workers
   ───────────────────────────────────────────── */

const slides = [

  // ── 1: Title ──
  {
    variant: 'title',
    render: () => (
      <>
        <h1>From Chatbots to <span className="gold">Digital Workers</span></h1>
        <div className="subtitle">Building Autonomous Infrastructure with Computer Science Principles</div>
      </>
    ),
  },

  // ── 2: The Call ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">The call</div>
        <h2>From chat to <span className="gold">work</span></h2>
        <div className="evidence">
          <p>The shift is small in words, large in consequence:</p>
          <div className="file-tree">
            <pre>{`yesterday   →   `}<span className="primary">"answer my question"</span>{`
today       →   `}<span className="primary">"finish this job"</span>
            </pre>
          </div>
          <div className="emphasis-box">
            <p>A chatbot returns <em>text</em>. A digital worker returns <span className="highlight">a completed artifact</span> — a draft, a ticket, a report, a closed loop.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 3: Paradigm Shift ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">The core abstraction</div>
        <h2>A <span className="gold">paradigm</span> shift</h2>
        <div className="evidence">
          <table className="slide-table">
            <thead>
              <tr>
                <th></th>
                <th>Messages API</th>
                <th>Managed Agents</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Infrastructure</td>
                <td>You build the loop, manage the sandbox, handle tools by hand.</td>
                <td>Pre-built agent harness running in managed cloud infrastructure.</td>
              </tr>
              <tr>
                <td>State &amp; Memory</td>
                <td>Stateless. You resend the whole story every time.</td>
                <td>Stateful sessions. Filesystem and history survive sleep.</td>
              </tr>
              <tr>
                <td>Capability</td>
                <td>Answers and fine-grained control.</td>
                <td>Long-running async work with built-in tools (Bash, files, web).</td>
              </tr>
            </tbody>
          </table>
          <div className="emphasis-box">
            <p>From hand-rolled loops over stateless prompts to <span className="highlight">managed, stateful agents</span> that finish.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 4: Meet the Mentor ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">The mentor&rsquo;s gift</div>
        <h2>Six <span className="gold">tools</span> on the table</h2>
        <div className="evidence">
          <div className="cards cards--2x3">
            <div className="card">
              <h3>Agent</h3>
              <p>The job description. Who they are, what they&rsquo;re allowed to touch.</p>
            </div>
            <div className="card">
              <h3>Environment</h3>
              <p>The private office. Clean desk, locked doors, pre-installed software.</p>
            </div>
            <div className="card">
              <h3>Session</h3>
              <p>The workday. Starts, takes breaks, comes back with the papers still on the desk.</p>
            </div>
            <div className="card">
              <h3>Skills</h3>
              <p>A table of contents — not a textbook. Read only the chapters you need.</p>
            </div>
            <div className="card">
              <h3>Vaults</h3>
              <p>A safe deposit box. Agent knows the lock; the session brings the key.</p>
            </div>
            <div className="card">
              <h3>Outcomes</h3>
              <p>The grader. Checks the work against the rubric until it&rsquo;s right.</p>
            </div>
          </div>
          <div className="emphasis-box">
            <p>The next six slides go one tool at a time. <span className="highlight">Analogy first. Code second.</span></p>
          </div>
        </div>
      </>
    ),
  },

  // ── 5: Layer 1 — Agent ──
  {
    variant: 'content',
    render: () => (
      <LayerSlide
        topic="Layer 1"
        h2Lead="The "
        h2Gold="Agent"
        h2Tail=" — a job description"
        analogyLead="Think: hiring paperwork"
        analogyBody={
          <>
            An Agent is who the worker is and <span className="highlight">what tools the role is allowed to touch</span>. Same Agent can be hired into many jobs — the description doesn&rsquo;t change between shifts.
          </>
        }
        codeLabel="create an agent"
        code={`curl -X POST https://api.anthropic.com/v1/agents \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2026-04-01" \\
  -H "content-type: application/json" \\
  -d '{
    "name": "social-asset-generator",
    "model": {"id": "claude-opus-4-7"},
    "system": "You draft social posts...",
    "tools": [{"type": "agent_toolset_20260401"}]
  }'`}
        footer={<>One Agent definition, versioned and reused. The <span className="highlight">brain</span>, separated from any single task.</>}
      />
    ),
  },

  // ── 6: Layer 2 — Environment ──
  {
    variant: 'content',
    render: () => (
      <LayerSlide
        topic="Layer 2"
        h2Lead="The "
        h2Gold="Environment"
        h2Tail=" — a private office"
        analogyLead="Think: a clean desk in a locked room"
        analogyBody={
          <>
            A pre-built workspace with the right software already installed and <span className="highlight">locked doors</span> to systems the worker shouldn&rsquo;t touch. Same room shape, fresh for every workday.
          </>
        }
        codeLabel="create an environment"
        code={`curl -X POST https://api.anthropic.com/v1/environments \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2026-04-01" \\
  -H "content-type: application/json" \\
  -d '{
    "os": "ubuntu-22.04",
    "packages": ["python==3.12", "pandas==2.2.0"],
    "networking": "limited",
    "allowed_hosts": ["api.internal-data.com"]
  }'`}
        footer={<>A reproducible container — secure, isolated, predictable. Your core systems stay untouched.</>}
      />
    ),
  },

  // ── 7: Layer 3 — Session ──
  {
    variant: 'content',
    render: () => (
      <LayerSlide
        topic="Layer 3"
        h2Lead="The "
        h2Gold="Session"
        h2Tail=" — a workday"
        analogyLead="Think: a desk that remembers"
        analogyBody={
          <>
            A worker clocks in, does the job, takes a break — and when they return, <span className="highlight">the papers are still on the desk</span>. Sessions checkpoint when idle and resume exactly where they left off.
          </>
        }
        codeLabel="start a session"
        code={`curl -X POST https://api.anthropic.com/v1/sessions \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2026-04-01" \\
  -d '{"agent_id": "agt_...", "environment_id": "env_..."}'

# send a message
curl -X POST https://api.anthropic.com/v1/sessions/$ID/messages \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -d '{"content": "Draft next weeks campaign."}'

# container checkpoints on idle. resume tomorrow.`}
        footer={<>Long jobs don&rsquo;t need to fit in one conversation. <span className="highlight">State survives sleep.</span></>}
      />
    ),
  },

  // ── 8: Layer 4 — Skills ──
  {
    variant: 'content',
    render: () => (
      <LayerSlide
        topic="Layer 4"
        h2Lead=""
        h2Gold="Skills"
        h2Tail=" — a table of contents, not a textbook"
        analogyLead="Think: scanning the index"
        analogyBody={
          <>
            Skills are folders of expertise. The agent scans the <span className="highlight">titles</span>, opens only the chapters it needs, ignores the rest. The whole library is <em>available</em>; the context window stays light.
          </>
        }
        codeLabel="attach a skill"
        code={`curl -X PATCH https://api.anthropic.com/v1/agents/$AGENT_ID \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2026-04-01" \\
  -d '{
    "version": 3,
    "skills": [
      {"type": "anthropic", "skill": "docx"},
      {"type": "custom", "skill_id": "skl_brand_voice"}
    ]
  }'`}
        footer={<>Progressive disclosure: <span className="highlight">load on demand</span>, not all at once. Deep expertise without token bloat.</>}
      />
    ),
  },

  // ── 9: Layer 5 — Vaults ──
  {
    variant: 'content',
    render: () => (
      <LayerSlide
        topic="Layer 5"
        h2Lead=""
        h2Gold="Vaults"
        h2Tail=" — a safe deposit box"
        analogyLead="Think: the lock vs the key"
        analogyBody={
          <>
            The Agent knows the <em>shape</em> of the lock — it knows it needs Slack. The Session brings the <span className="highlight">user&rsquo;s actual key</span>. Build the product once; serve thousands of users without ever co-mingling their credentials.
          </>
        }
        codeLabel="store a credential, then use it"
        code={`# store the user's credential in a vault
curl -X POST https://api.anthropic.com/v1/vaults/$VAULT_ID/credentials \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -d '{"name": "slack_oauth", "value": "xoxb-..."}'

# attach it at session creation — agent never sees the secret
curl -X POST https://api.anthropic.com/v1/sessions \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -d '{"agent_id": "agt_...", "vault_ids": ["vlt_steve_slack"]}'`}
        footer={<>Manage your <em>product</em> at the agent level. Manage your <em>users</em> at the session level.</>}
      />
    ),
  },

  // ── 10: Layer 6 — Outcomes (replacement for direct prompts) ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Layer 6</div>
        <h2><span className="gold">Outcomes</span> — replace the back-and-forth</h2>
        <div className="evidence">
          <div className="two-col">
            <div className="col">
              <h3>Direct prompt</h3>
              <p>You ask. It answers. <span className="highlight">You</span> read it, decide if it&rsquo;s right, and re-ask until it is.</p>
              <p><em>You are the grader. You can&rsquo;t go to dinner.</em></p>
            </div>
            <div className="col">
              <h3>Outcome</h3>
              <p>You state the rubric once. An <span className="highlight">independent grader</span> checks each draft and sends it back until it passes.</p>
              <p><em>You read the final draft only.</em></p>
            </div>
          </div>
          <Code label="define an outcome">{`curl -X POST https://api.anthropic.com/v1/sessions/$ID/outcomes \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -H "anthropic-version: 2026-04-01" \\
  -d '{
    "rubric": "10 LinkedIn posts. Each under 280 chars. Each ends with a question.",
    "max_iterations": 5
  }'
# returns: status = satisfied | needs_revision | max_iterations_reached`}</Code>
          <div className="emphasis-box">
            <p>Conversation becomes <span className="highlight">work</span> the moment you can name &ldquo;done.&rdquo;</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 11: Async + Webhooks ──
  {
    variant: 'content',
    render: () => (
      <LayerSlide
        topic="Async"
        h2Lead="Webhooks — "
        h2Gold="call me"
        h2Tail=" when it&rsquo;s done"
        analogyLead="Think: a tap on the shoulder"
        analogyBody={
          <>
            You don&rsquo;t sit and wait. You hand off the job, <span className="highlight">go to dinner</span>, and the agent calls you back when the artifact is ready. Hours of work happen in the background.
          </>
        }
        codeLabel="register a webhook + receive it"
        code={`# tell the platform where to call you
curl -X POST https://api.anthropic.com/v1/webhooks \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -d '{"url": "https://yourapp.com/hook", "events": ["session.outcome.satisfied"]}'

# later, you receive:
# POST https://yourapp.com/hook
# { "id": "evt_...", "type": "session.outcome.satisfied", "session_id": "sess_..." }
# fetch the artifact with a GET on receipt.`}
        footer={<>Long jobs no longer block humans. <span className="highlight">Work that finishes itself.</span></>}
      />
    ),
  },

  // ── 12: Permissions ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Trust</div>
        <h2><span className="gold">Permissions</span> — how much rope?</h2>
        <div className="evidence">
          <div className="scope-stack">
            <div className="scope-row">
              <div className="scope-label">Always ask</div>
              <div className="scope-desc">human approves every action — training wheels</div>
            </div>
            <div className="scope-row">
              <div className="scope-label">Ask once</div>
              <div className="scope-desc">approve at the start of a session, then run free</div>
            </div>
            <div className="scope-row">
              <div className="scope-label">Always allow</div>
              <div className="scope-desc">read-only or well-tested tasks — full autonomy</div>
            </div>
          </div>
          <Code label="set a permission policy">{`curl -X PATCH https://api.anthropic.com/v1/sessions/$ID/tools/slack \\
  -H "x-api-key: $ANTHROPIC_API_KEY" \\
  -d '{"permission_policy": "always_ask"}'`}</Code>
          <div className="emphasis-box">
            <p>Trust isn&rsquo;t binary. <span className="highlight">Turn it tool-by-tool</span>, agent-by-agent, as confidence grows.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 13: Apex — Orchestration ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">The apex</div>
        <h2>A <span className="gold">crew</span>, not a soloist</h2>
        <div className="evidence">
          <div className="file-tree">
            <pre>{`Manager
└── `}<span className="primary">Coordinator Agent</span>{`
    ├── `}<span className="primary">Drafter Agent</span>{`        `}<span className="comment"># writes the post copy</span>{`
    └── `}<span className="primary">Reviewer Agent</span>{`       `}<span className="comment"># checks tone + brand</span>
            </pre>
          </div>
          <div className="cards">
            <div className="card">
              <h3>Coordinator</h3>
              <p>The manager. Splits the work, hands out tasks, gathers results.</p>
            </div>
            <div className="card">
              <h3>Specialists</h3>
              <p>Each agent has its own job description, tools, and rubric.</p>
            </div>
            <div className="card">
              <h3>Shared substrate</h3>
              <p>Same office, same files. Agents work in parallel without stepping on each other.</p>
            </div>
          </div>
          <div className="emphasis-box">
            <p>Parallelization and specialization. <span className="highlight">More hands, sharper work.</span></p>
          </div>
        </div>
      </>
    ),
  },

  // ── 14: Steve story ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">A day in the life</div>
        <h2>Steve ships a week of <span className="gold">campaigns</span> over the weekend</h2>
        <div className="evidence">
          <div className="two-col">
            <div className="col">
              <h3>The human story</h3>
              <ul>
                <li><span className="highlight">Friday 5:30pm</span> — Steve kicks off the agent: &ldquo;Draft next week&rsquo;s launch posts for LinkedIn, X, and Instagram.&rdquo;</li>
                <li><span className="highlight">5:35pm</span> — He closes his laptop and goes home for the weekend.</li>
                <li><span className="highlight">Monday 8:00am</span> — His phone buzzes. The agent is done.</li>
                <li><span className="highlight">8:10am</span> — He reviews 15 posts and 5 images. Approves them. Coffee.</li>
              </ul>
            </div>
            <div className="col">
              <h3>Under the hood</h3>
              <ul>
                <li><code className="inline">POST /sessions</code> with the social-asset-generator agent</li>
                <li>Session checkpoints when Steve disconnects</li>
                <li>Grader returns <code className="inline">satisfied</code> on iteration 3</li>
                <li>Webhook fires; Steve gets the artifact link</li>
              </ul>
            </div>
          </div>
          <div className="emphasis-box">
            <p>The agent worked <span className="highlight">most of the weekend</span>. Steve worked ten minutes.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 15: Reward ──
  {
    variant: 'title',
    render: () => (
      <>
        <h1>What just <span className="gold">changed</span></h1>
        <div className="subtitle">
          Work that finishes itself.
          <br />
          Permissions you control.
          <br />
          Memory that survives the meeting.
        </div>
      </>
    ),
  },

  // ── 16: Templates Intro ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Take this with you</div>
        <h2>Ten patterns you can ship <span className="gold">Monday</span></h2>
        <div className="evidence">
          <p>Each is a pre-built starting point — a job description, a toolbelt, a system prompt — ready to clone and customize.</p>
          <div className="scope-stack">
            <div className="scope-row">
              <div className="scope-label">Research</div>
              <div className="scope-desc">Blank Agent &middot; Deep Researcher &middot; Structured Extractor</div>
            </div>
            <div className="scope-row">
              <div className="scope-label">Marketing &amp; Ops</div>
              <div className="scope-desc">Social Asset Generator &middot; Sprint Retro &middot; Field Monitor</div>
            </div>
            <div className="scope-row">
              <div className="scope-label">Customer</div>
              <div className="scope-desc">Support Agent &middot; Support-to-Eng &middot; Contract Tracker &middot; Data Analyst</div>
            </div>
          </div>
          <div className="emphasis-box">
            <p>Three groups. <span className="highlight">Steal what fits.</span></p>
          </div>
        </div>
      </>
    ),
  },

  // ── 17: Research & Extraction ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Group 1 &mdash; Research &amp; Extraction</div>
        <h2>Turn information into <span className="gold">answers</span></h2>
        <div className="evidence">
          <div className="cards">
            <div className="card">
              <h3>Blank Agent</h3>
              <p>The core toolset, nothing more. A foundation to build any custom agent from scratch.</p>
              <p><code className="inline">no MCP</code></p>
            </div>
            <div className="card">
              <h3>Deep Researcher</h3>
              <p>Breaks a question into sub-questions, hunts authoritative sources, synthesizes with citations.</p>
              <p><code className="inline">no MCP</code></p>
            </div>
            <div className="card">
              <h3>Structured Extractor</h3>
              <p>Messy text in, typed JSON out. Validated against your schema.</p>
              <p><code className="inline">no MCP</code></p>
            </div>
          </div>
          <div className="emphasis-box">
            <p>Best when the input is text or web data and the output is <span className="highlight">structured truth</span>.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 18: Marketing & Ops ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Group 2 &mdash; Marketing &amp; Ops</div>
        <h2>Ship the <span className="gold">recurring</span> work</h2>
        <div className="evidence">
          <div className="cards">
            <div className="card">
              <h3>Social Asset Generator</h3>
              <p>Drafts posts across platforms, generates images, schedules the week.</p>
              <p><code className="inline">Figma &middot; Buffer &middot; Slack</code></p>
            </div>
            <div className="card">
              <h3>Sprint Retro Facilitator</h3>
              <p>Pulls a closed sprint, synthesizes themes, writes the retro doc before the meeting.</p>
              <p><code className="inline">Linear &middot; Slack</code></p>
            </div>
            <div className="card">
              <h3>Field Monitor</h3>
              <p>Scans blogs on a topic, writes a weekly &ldquo;what changed&rdquo; brief.</p>
              <p><code className="inline">Notion</code></p>
            </div>
          </div>
          <div className="emphasis-box">
            <p>Best when work spans <span className="highlight">multiple tools</span> and happens on a cadence.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 19: Customer & Revenue ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Group 3 &mdash; Customer &amp; Revenue</div>
        <h2>Closer to the <span className="gold">customer</span></h2>
        <div className="evidence">
          <div className="cards cards--2x3">
            <div className="card">
              <h3>Support Agent</h3>
              <p>Answers from docs and the knowledge base. Escalates when it&rsquo;s stuck.</p>
              <p><code className="inline">Notion &middot; Slack</code></p>
            </div>
            <div className="card">
              <h3>Support-to-Eng Escalator</h3>
              <p>Reads an Intercom thread, reproduces the bug, files a Jira ticket with repro steps.</p>
              <p><code className="inline">Intercom &middot; Atlassian &middot; Slack</code></p>
            </div>
            <div className="card">
              <h3>Contract Tracker</h3>
              <p>Extracts clauses, sets deadline reminders, tracks obligations in Asana.</p>
              <p><code className="inline">Box &middot; Asana</code></p>
            </div>
            <div className="card">
              <h3>Data Analyst</h3>
              <p>Loads, explores, visualizes. Answers ad-hoc questions from datasets.</p>
              <p><code className="inline">Amplitude</code></p>
            </div>
          </div>
          <div className="emphasis-box">
            <p>Best when there&rsquo;s a <span className="highlight">human on the other end</span> waiting for an answer.</p>
          </div>
        </div>
      </>
    ),
  },

  // ── 20: Spotlight — Social Asset Generator ──
  {
    variant: 'content',
    render: () => (
      <>
        <div className="topic-label">Spotlight</div>
        <h2>Social Asset Generator — <span className="gold">the full template</span></h2>
        <div className="evidence">
          <div className="two-col">
            <div className="col">
              <Code label="social-asset-generator.yaml">{`name: Social asset generator
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
  - agent_toolset_20260401`}</Code>
            </div>
            <div className="col">
              <h3>Why this template</h3>
              <p><span className="highlight">claude-sonnet-4-6</span> — fast and cost-effective. This work is volume, not depth.</p>
              <p><span className="highlight">Three MCP servers</span> — the toolbelt is the whole point. Each one is a tab a marketer would otherwise switch between.</p>
              <p><span className="highlight">Numbered system prompt</span> — five clear steps. The agent has a playbook, not a vibe.</p>
            </div>
          </div>
          <div className="emphasis-box">
            <p>Clone it. Swap <em>Buffer</em> for your scheduler. <span className="highlight">Ship Monday.</span></p>
          </div>
        </div>
      </>
    ),
  },

  // ── 21: Closing ──
  {
    variant: 'title',
    render: () => (
      <>
        <div
          style={{
            fontSize: 'clamp(1rem, 2vw, 1.5rem)',
            fontWeight: 300,
            color: 'var(--gray-400)',
            letterSpacing: '0.02em',
            marginBottom: '2rem',
          }}
        >
          You came for <span className="gold">chatbots</span>.
        </div>
        <h1>You&rsquo;re leaving with a <span className="gold">workforce</span>.</h1>
      </>
    ),
  },

  // ── 22: Demo ──
  {
    variant: 'title',
    render: () => (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem' }}>
        <h1><span className="gold">Demo</span></h1>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent('https://github.com/mattwoodco/braid')}&color=ffffff&bgcolor=000000&format=svg`}
          alt="QR code to github.com/mattwoodco/braid"
          style={{ width: 'min(38vh, 75vw)', height: 'min(38vh, 75vw)' }}
        />
        <a
          href="https://github.com/mattwoodco/braid"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            color: 'var(--gray-300)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'clamp(0.9rem, 1.4vw, 1.25rem)',
            textDecoration: 'none',
            borderBottom: '1px solid var(--gray-600)',
            paddingBottom: '0.25rem',
          }}
        >
          github.com/mattwoodco/braid
        </a>
      </div>
    ),
  },

]

/* ─────────────────────────────────────────────
   Deck
   ───────────────────────────────────────────── */

function App() {
  const [current, setCurrent] = useState(0)
  const [direction, setDirection] = useState('forward')
  const total = slides.length
  const touchRef = useRef(null)

  const go = useCallback((next) => {
    if (next < 0 || next >= total || next === current) return
    setDirection(next > current ? 'forward' : 'backward')
    setCurrent(next)
  }, [current, total])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ' || e.key === 'PageDown' || e.key === 'j') {
        e.preventDefault()
        go(current + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp' || e.key === 'k') {
        e.preventDefault()
        go(current - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        go(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        go(total - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, total, go])

  const onTouchStart = useCallback((e) => {
    const t = e.changedTouches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }
  }, [])

  const onTouchEnd = useCallback((e) => {
    const start = touchRef.current
    if (!start) return
    touchRef.current = null
    const t = e.changedTouches[0]
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    const elapsed = Date.now() - start.time
    const absDx = Math.abs(dx)
    const absDy = Math.abs(dy)
    // Horizontal swipe: long enough, mostly horizontal, not too slow
    if (absDx > 40 && absDx > absDy * 1.2 && elapsed < 800) {
      go(dx < 0 ? current + 1 : current - 1)
    }
  }, [current, go])

  const progress = ((current + 1) / total) * 100

  return (
    <div
      className="deck"
      role="region"
      aria-roledescription="slide deck"
      aria-label="From Chatbots to Digital Workers"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="bg-grid" aria-hidden="true" />

      <img
        src={LOGO_SRC}
        alt=""
        aria-hidden="true"
        className="deck-logo"
      />

      <div
        className="progress-bar"
        role="progressbar"
        aria-valuenow={current + 1}
        aria-valuemin={1}
        aria-valuemax={total}
        aria-label="Slide progress"
        style={{ width: `${progress}%` }}
      />

      {slides.map((slide, i) => {
        const isActive = i === current
        let className = `slide slide--${slide.variant}`
        if (slide.sectionStyle) className += ` slide--${slide.sectionStyle}`
        if (isActive) className += ' active'
        else if (
          (direction === 'forward' && i < current) ||
          (direction === 'backward' && i > current)
        ) {
          className += ' exit'
        }

        return (
          <div
            key={`slide-${i}`}
            className={className}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${i + 1} of ${total}`}
            aria-hidden={!isActive}
            style={{ display: Math.abs(i - current) <= 1 ? undefined : 'none' }}
          >
            {slide.render()}
          </div>
        )
      })}

      <div className="slide-counter" aria-hidden="true">
        {String(current + 1).padStart(2, '0')} / {String(total).padStart(2, '0')}
      </div>

      <div className="nav-hint" aria-hidden="true">
        <kbd>&larr;</kbd> <kbd>&rarr;</kbd> navigate
      </div>
    </div>
  )
}

export default App
