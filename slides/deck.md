---
marp: true
theme: default
paginate: true
backgroundColor: #1a1a2e
color: #eee
style: |
  section {
    font-family: 'Inter', 'Helvetica Neue', sans-serif;
  }
  h1 {
    color: #e94560;
  }
  h2 {
    color: #0f3460;
    color: #64b5f6;
  }
  code {
    background: #16213e;
    color: #e94560;
  }
  pre {
    background: #16213e !important;
    border-radius: 8px;
  }
  a {
    color: #64b5f6;
  }
  table {
    font-size: 0.8em;
  }
  th {
    background: #0f3460;
  }
  blockquote {
    border-left: 4px solid #e94560;
    color: #aaa;
    font-style: italic;
  }
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1em;
  }
  .small {
    font-size: 0.7em;
  }
  .accent {
    color: #e94560;
  }
  .dim {
    color: #888;
  }
  img[alt~="center"] {
    display: block;
    margin: 0 auto;
  }
---

# Parallel Agentic Data Pipelines
## Building with Claude Code

**Jacob Matson** · MotherDuck
<!-- _footer: "" -->

<!--
Speaker notes:
- Quick intro: name, role at MotherDuck
- "I'm going to tell you a story about how I turned a vibe-coded NBA app
  into a production pipeline — and how the way I work changed more than the code."
- ~30 seconds
-->

---

# The App

<!-- TODO: Replace with animated GIF of the app -->
<!-- ![center](../public/demo-app.gif) -->

**NBA Box Scores** — real data, real pipeline, real users

<div class="columns">
<div>

- Game scores, player stats, box scores
- Live updates with real-time highlighting
- Player search, trend charts, season filters

</div>
<div>

- 26 seasons of NBA data (2000–2025)
- Adaptive rate limiting, incremental ingestion
- **All queries run in your browser** via MotherDuck WASM

</div>
</div>

<!--
Speaker notes:
- SHOW THE APP — either live demo or animated GIF
- Click through: home grid → box score panel → live mode toggle
- Player search autocomplete → performance trend chart
- "Full stack. All TypeScript. And I built it in a weekend with AI."
- ~2 min
-->

---

# "I Vibe-Coded This"

The app **worked**. But under the hood:

- 🔀 Python + TypeScript hybrid (two languages, two configs)
- 🔄 Full reload every time — no incremental ingestion
- 💉 SQL injection vulnerabilities in WASM queries
- 💀 Dead code, magic numbers, zero tests
- 📝 No schema versioning, no data quality checks

> A prototype pretending to be production. And **23 GitHub issues** staring at me.

| Priority | Issues | Examples |
|----------|--------|---------|
| **P0** | 7 | Schema design, SQL injection, dead code |
| **P1** | 8 | Parser rewrite, test suite, DB layer |
| **P2–P3** | 8 | Charts, CI/CD, live mode, backfill |

<!--
Speaker notes:
- "Vibe coding is great for getting something up. But eventually you need
  to make it real."
- "These aren't trivial issues. Schema migration. Security fixes. A full
  Python-to-TypeScript parser rewrite. CI/CD pipelines. Data quality detectors."
- "How do you close 23 issues — schema design to CI/CD — in a weekend?
  Let me tell you how my workflow evolved."
-->

---

# Phase 1: One Window

```
┌─────────────────────────────┐
│  You ←→ Claude              │
│                             │
│  "Fix this bug"             │
│  "Now this one"             │
│  "Now refactor that"        │
└─────────────────────────────┘
```

**Sequential.** You're the planner, executor, and reviewer.

This is how most people use AI coding tools today.

<!--
Speaker notes:
- "Phase 1 is conversational. You chat with Claude, fix things one at a time.
  It's great — maybe 3-5x faster than typing it yourself. But it's linear."
-->

---

# Phase 2: Three Windows

```
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Planner  │  │ Executor │  │ Reviewer │
│          │→ │          │→ │          │
│ "Design  │  │ "Write   │  │ "Check   │
│  the API"│  │  the code"│  │  the PR" │
└──────────┘  └──────────┘  └──────────┘
                   ↑
              YOU (the bottleneck)
```

More throughput! But **you** become the scheduler.

Copy-pasting context. Waiting on one window to unblock another.

<!--
Speaker notes:
- "Phase 2 was my first attempt at parallelism. Three terminal windows.
  I'm manually shuttling context between them."
- "It's faster, but I realized I was the bottleneck. I was the
  single-threaded orchestrator in a multi-threaded system."
-->

---

# Phase 3: Agent Teams

```
┌─────────────────────────────────────────────┐
│  You (Team Lead)                            │
│                                             │
│  ┌─────────────┐ ┌──────────┐ ┌──────────┐ │
│  │schema-      │ │security- │ │code-     │ │
│  │designer     │ │fixer     │ │cleaner   │ │
│  │             │ │          │ │          │ │
│  │ #14 schema  │ │ #21 sqli │ │ #22 dead │ │
│  └─────────────┘ └──────────┘ └──────────┘ │
│                                             │
│  Claude manages the agents.                 │
│  You manage the task graph.                 │
└─────────────────────────────────────────────┘
```

**Back to one window.** But now it's a command center.

<!--
Speaker notes:
- "Phase 3 was the breakthrough. Claude Code can launch sub-agents on
  isolated git worktrees. Each agent gets a task, works independently,
  and reports back."
- "I stopped being the executor. I became the team lead."
-->

---

# Wave Dispatch

The agents don't run randomly — they run in **dependency-aware waves**.

| Wave | Agents | Issues |
|------|--------|--------|
| **1** | schema-designer, security-fixer, code-cleaner | #14, #21, #22 |
| **2** | pipeline-builder, parser, test-writer | #15, #16, #31 |
| **3** | db-layer, charts, responsive | #17, #25, #34 |
| **4** | orchestrator, live-mode, status-dashboard | #18, #29, #35 |
| **5** | github-actions, python-removal, data-quality | #28, #20, #26 |

Build + test validation **after every wave**. All green throughout.

<!--
Speaker notes:
- "Wave 1 has no dependencies — schema, security, cleanup can all run in parallel.
  Wave 2 depends on wave 1 outputs. Wave 3 depends on wave 2. And so on."
- "Sound familiar? This is exactly how a data pipeline DAG works."
- "Validate after every wave. If something breaks, you catch it before
  downstream agents build on a broken foundation."
-->

---

# Now Let's Look at What the Agents Built

<!--
Speaker notes:
- Transition slide — shift from workflow story to technical deep dive
- "So what did 5 waves of agents actually produce?
  Let me show you the pipeline."
-->

---

# Architecture

```
    PBPStats API (rate-limited)
           │
    CLI Orchestrator (index.ts)
           │
    Worker Pool (bounded concurrency)
           │
    ┌──────┼──────┐
    │ S1   │ S2   │ S3 ...    ← parallel seasons
    └──┬───┴──┬───┘
       │      │
    Adaptive Rate Limiter
    (rolling window, auto-tuning)
       │
    ┌──┴──────────────────┐
    │ MAX_IN_FLIGHT = 8   │    ← 8 games concurrently
    │ per season           │
    └──┬──────────────────┘
       │
    ┌──┴──────┬───────────┐
    │         │           │
    Parser    Raw Lake    Ingestion Log
    │         │
    box_scores raw_game_data_pbpstats
    │         │
    └────┬────┘
         │
    MotherDuck (cloud DuckDB)
         │
    Next.js + WASM client
    (browser-side SQL queries)
```

<!--
Speaker notes:
- Walk through top to bottom
- "All TypeScript. No Python. No CSV intermediary. JSON straight to MotherDuck."
- "Two layers of parallelism: seasons in parallel via worker pool,
  games in parallel via adaptive dispatch queue."
-->

---

# MotherDuck: The Glue

<div class="columns">
<div>

### Pipeline (Server)
`@duckdb/node-api`

- Batch `INSERT OR REPLACE`
- Idempotent upserts on PKs
- Direct SQL (no ORM)
- v2 schema alongside v1
- Zero-downtime migration

</div>
<div>

### Frontend (Browser)
MotherDuck WASM

- SQL runs **client-side**
- No backend for reads
- Temp tables per session
- Same database, two access patterns

</div>
</div>

<br>

> One cloud DuckDB warehouse. Server writes, browser reads.

<!--
Speaker notes:
- "MotherDuck is doing double duty. On the pipeline side, it's a cloud
  data warehouse receiving batch inserts. On the frontend, the WASM client
  lets the browser query directly — no API server needed for reads."
- "We deployed v2 alongside v1, tested it, and swapped. Zero downtime."
-->

---

# The Pipeline Engine

<div class="columns">
<div>

### Adaptive Rate Limiter
```typescript
// Rolling window of 15 outcomes
const WINDOW_SIZE = 15;

// Speedup/slowdown multipliers
const AGGRESSIVE_SPEEDUP  = 0.85;
const AGGRESSIVE_SLOWDOWN = 2.0;
```

Range: **200ms – 10s**
Finds the fastest safe speed automatically.

> Like cruise control for APIs.

</div>
<div>

### Bounded Concurrency
```typescript
const MAX_IN_FLIGHT = 8;

while (queue.length > 0) {
  if (inFlight.size < MAX_IN_FLIGHT) {
    await sleep(getCurrentDelay());
    dispatch(queue.shift()!);
    continue;
  }
  await Promise.race(inFlight);
}
```

Serialized dispatch, parallel execution.
The limiter controls the **faucet**, not the pipes.

</div>
</div>

<!--
Speaker notes:
- LEFT: "The rate limiter watches the last 15 API responses. Every 8 successes,
  it probes: can we go faster? Clean window — speed up 15%. High errors — slam
  the brakes. Cruise control for APIs."
- RIGHT: "Queue of games, 8 in-flight at a time. Rate limiter gates dispatch.
  Failed games go back to the queue. Up to 18 total attempts before we give up."
- "This pattern — bounded fan-out with adaptive throttling — is reusable
  for any rate-limited API."
-->

---

# Raw Data + Quality

<div class="columns">
<div>

### Raw Data Lake
PBPStats returns **90+ fields** per player per period.
`box_scores` captures 19. Re-fetching = **~90 min/season**.

```
raw_game_data_pbpstats  →  box_scores
(full API response)        (19 columns)
```

```bash
npm run hydrate -- --season 2024
# Re-derive without API calls
```

> Store everything. Derive later.

</div>
<div>

### Data Quality Detectors

| Detector | Catches |
|----------|---------|
| **wrong-team** | Player on two teams |
| **impossible-stats** | Stats violating NBA rules |
| **score-mismatch** | Scores ≠ schedule |
| **duplicates** | Same player twice |

- Quarantine table for anomalies
- Incremental auditing
- Auto-creates GitHub issues

</div>
</div>

<!--
Speaker notes:
- LEFT: "Classic data lake pattern. The raw table is your source of truth.
  box_scores is a materialized view you can regenerate anytime.
  Want a new analytic? Don't re-fetch 26 seasons. Write a new parser."
- RIGHT: "The agents didn't just build the pipeline — they built the guardrails too.
  Found a real bug in v1: minutes were inflated by ~1:00 for some players.
  The v2 parser matches the raw JSON exactly. Better than the original."
-->

---

# The Numbers

<div class="columns">
<div>

### Development
- **55** commits in 3 days
- **23** issues → 21 closed (91%)
- **93** tests (from 0)
- **~11K** lines added
- **~900** lines removed
- **6** agent identities
- **5** waves of execution

</div>
<div>

### Pipeline
- **26** seasons of data
- **12** pipeline modules
- **4** data quality detectors
- **3** GitHub Actions workflows
- **8** max concurrent requests
- **200ms–10s** adaptive delay range
- Python: **eliminated**

</div>
</div>

<!--
Speaker notes:
- Let the numbers speak. Don't oversell — just state facts.
- "93 tests from zero. Python fully eliminated. v2 more accurate than v1."
-->

---

# What Worked

**Dependency-aware wave dispatch**
No agent ever blocked waiting on another. Critical path optimized.

**Shared branch > isolated worktrees**
Worktree isolation caused merge pain. Shared branch + careful coordination won.

**Validate after every wave**
Build + tests = green throughout. Caught issues before they propagated.

**WORKLOG.md as shared memory**
Agents and humans read the same log. Context persists across sessions.

<!--
Speaker notes:
- "The biggest lesson: design the task graph carefully. If you get the
  dependency ordering right, the agents stay busy and nothing blocks."
- "We tried full worktree isolation first. It was theoretically clean
  but practically painful — merge conflicts wiped out the time savings."
-->

---

# The Meta-Parallel

We used **parallel agents** to build a **parallel pipeline**.

| Development | Pipeline |
|-------------|----------|
| Agent worker pool | Season worker pool |
| Wave dispatch (dependency-aware) | Game dispatch (rate-aware) |
| Worktree isolation | Batch isolation |
| Validate after each wave | Quality check after each ingest |
| Team lead coordinates | CLI orchestrator coordinates |

**The development model mirrors the runtime model.**

<!--
Speaker notes:
- "This is the part that blew my mind. The structure of how we built it
  is the same structure as what we built."
- "Parallel workers, bounded concurrency, dependency-aware scheduling,
  validation checkpoints. Same patterns, different domains."
- PAUSE. Let this land before moving to the big picture.
-->

---

# The Exponential Curve

```
  Leverage
    │
    │                                        ╱ 🔮 ???
    │                                      ╱
    │                                ·····╱  labs are here
    │                              ╱
    │                      ● 2026: Parallel agent teams
    │                    ╱
    │              ● 2025: Agent teams
    │            ╱
    │        ● 2024: AI chat (Claude)
    │      ╱
    │  ● 2023: AI autocomplete (Copilot)
    │╱
    ● 2020: "Dumb guy data engineering"
    └──────────────────────────────────── Time
```

<!--
Speaker notes:
- "In 2020 I wrote about 'dumb guy data engineering' — the idea that
  DuckDB and dbt let anyone build real pipelines. You don't need Spark.
  You don't need a CS degree. Just SQL and good tools."
- "Each point on this curve reduces the bottleneck. First: infrastructure
  complexity. Then: typing speed. Then: thinking speed. Now: orchestration."
- "And here's the thing — labs are already ahead of what's public.
  Let me show you what they're doing."
-->

---

# Harness Engineering

OpenAI built an **internal product** with Codex agents (Feb 2026):

- **~1M lines of code** in 5 months
- **3 engineers**, zero hand-written code (by design)
- **3.5 PRs per engineer per day**

The human role shifted from **writing code** to **designing the harness**:
repository structure, CI rules, dependency layers, AGENTS.md as a table of contents.

> "2025 was agents. 2026 is agent harnesses."

<p class="small">Source: <a href="https://openai.com/index/harness-engineering/">openai.com/index/harness-engineering</a></p>

<!--
Speaker notes:
- "This is what labs are doing RIGHT NOW. OpenAI published this in February 2026.
  Three engineers, a million lines, zero hand-written code."
- "The term is 'harness engineering' — your job isn't to write the code,
  it's to design the environment the agents work in. CI config, repo structure,
  dependency rules, architectural tests."
- "Sound familiar? That's exactly what we did with wave dispatch and WORKLOG.md.
  We designed the harness — the agents did the work."
-->

---

# The Bottleneck Keeps Shifting

- ~~Infrastructure complexity~~ → DuckDB / dbt
- ~~Typing speed~~ → autocomplete
- ~~Thinking speed~~ → AI chat
- ~~Orchestration~~ → agent teams
- ~~Writing code~~ → harness engineering
- **Knowing what to build** → that's still you

> "Dumb guy data engineering" meant you didn't need distributed systems
> expertise to build pipelines. Agentic engineering means you don't need
> to type the code either. What you **do** need is **taste**, **judgment**,
> and the ability to **decompose problems**.

<!--
Speaker notes:
- "Every era makes the bottleneck less about technical skill and more
  about judgment. About taste. About asking the right questions."
- "The constant across every era: knowing what to build matters more
  than knowing how to build it. AI accelerates the how. You supply the what."
- Pause. Let this land.
-->

---

# Try It

Give Claude Code **23 issues** and a **weekend**.

<br>

**GitHub**: github.com/matsonj/nba-box-scores
**MotherDuck**: motherduck.com
**Twitter/X**: @matsonj

<br>

### Questions?

<!--
Speaker notes:
- "The repo is public. The WORKLOG.md documents every decision.
  Try it yourself — pick a project with a bunch of issues and
  see how your workflow evolves."
- Open for Q&A
-->
