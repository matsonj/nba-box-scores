# Conference Talk Outline
## "Parallel Agentic Data Pipelines with Claude Code"
### ~25 minutes | Standard talk

---

## Narrative Thread

**The exponential thesis**: "Dumb guy data engineering" showed that modern tools
(DuckDB, dbt, SQL) let anyone build real pipelines without distributed systems
expertise. AI coding tools are the next step on that exponential curve — and
labs are 12 months ahead of what's publicly available. We're lighting up the path.

**The personal arc**: Jacob's workflow evolved through 5 phases, each a step
change in leverage. The audience should leave thinking not "Claude is cool" but
"I need to rethink how I organize my work."

---

## Act 0: The App (2 min)

### Slide 1 — Title
- "Parallel Agentic Data Pipelines with Claude Code"
- Name, title (MotherDuck), date

### Slide 2 — The App (Demo GIFs)
- **Visual**: Animated GIF of the NBA box scores app
- Show: game card grid → click into box score panel → live score updates
- "I built this NBA box scores app. Real data, real users, real pipeline."
- **Purpose**: Ground the talk in something concrete before going abstract

### Slide 3 — The Interactive Features (Demo GIFs)
- **Visual**: GIF montage — player search autocomplete, season/team filters,
  player performance trend chart with stat toggles, dark mode
- "Full-stack app: Next.js frontend, MotherDuck WASM for client-side queries,
  TypeScript data pipeline pulling from PBPStats API"
- Quick flash of the tech stack

---

## Act 1: The Problem (3 min)

### Slide 4 — "I Vibe-Coded This"
- The original app worked! But...
- Python/TypeScript hybrid (two languages, two configs, two test frameworks)
- No incremental ingestion — full reload every time
- SQL injection vulnerabilities in the WASM queries
- Dead code, magic numbers, no tests
- "It was a prototype pretending to be production"

### Slide 5 — 23 Issues
- **Visual**: Screenshot or list of the 23 GitHub issues
- Prioritized: P0 (schema, security, dead code), P1 (pipeline, parser, tests),
  P2 (UI, charts, CI/CD), P3 (nice-to-haves)
- "I needed to close all of these. And I had a weekend."
- **Speaker note**: This is the setup — the audience should feel the weight

---

## Act 2: The Workflow Evolution (8 min) — *Heart of the talk*

### Slide 6 — Phase 1: One Window, Sequential
- **Visual**: Single terminal window
- "Fix this bug. Now this one. Now refactor that."
- Linear throughput — you're both the planner and executor
- This is how most people use AI coding tools today

### Slide 7 — Phase 2: Three Windows (Planner / Executor / Reviewer)
- **Visual**: Three terminal windows side by side
- More throughput! But YOU become the bottleneck
- Copy-pasting context between windows
- Manual orchestration — "wait for window 1, then tell window 2..."
- "I was the human scheduler. And I was bad at it."

### Slide 8 — Phase 3: Agent Teams (Back to One Window)
- **Visual**: One terminal with sub-agent output
- Claude Code launches sub-agents on isolated git worktrees
- You become the team lead, not the executor
- Show the actual execution model from WORKLOG:
  - Wave 1: `schema-designer` + `security-fixer` + `code-cleaner` (parallel)
  - Wave 2: `pipeline-builder` + `parser` + `tests` (unblocked by wave 1)
  - Wave 3: `db-layer` + `charts` + `responsive` (unblocked by wave 2)
- "Dependency-aware wave dispatch. Same pattern as a data pipeline."
- **Speaker note**: This is the key insight — the parallel agent model mirrors
  the parallel pipeline model

### Slide 9 — Phase 4: Multiple Projects, Multiple Agent Teams
- **Visual**: Multiple terminal windows, each running agent teams
- Realization: if one window can manage a team, run multiple windows
- Each window owns a different project or workstream
- "Your throughput is now limited by your ability to design task graphs"

### Slide 10 — Phase 5: The Exponential Curve
- **Visual**: Exponential curve with labeled points
  - 2020: "Dumb guy data engineering" — DuckDB/dbt let anyone build pipelines
  - 2023: AI autocomplete (Copilot) — faster typing
  - 2024: AI chat (Claude) — faster thinking
  - 2025: Agent teams — faster orchestration
  - 2026: Parallel agent teams — step change in leverage
  - 2027?: (dotted line) — labs are 12 months ahead
- "We're lighting up the path. What you see today is the floor, not the ceiling."
- **Speaker note**: Reference the "dumb guy data engineering" tweet/thesis.
  The through-line: each era makes the bottleneck less about technical skill
  and more about knowing what to build.

---

## Act 3: What the Agents Built (10 min)

### Slide 11 — Architecture Overview
- **Visual**: Full architecture diagram
  ```
  PBPStats API
       ↓
  CLI Orchestrator (index.ts)
       ↓
  Worker Pool (bounded concurrency)
       ↓
  ┌─────────┬─────────┬─────────┐
  │Season 1 │Season 2 │Season 3 │  ← parallel via pool
  └────┬────┴────┬────┴────┬────┘
       └─────────┼─────────┘
                 ↓
  Adaptive Rate Limiter (rolling window)
                 ↓
  ┌──────────────────────────────┐
  │ MAX_IN_FLIGHT = 8 games     │
  │ concurrent HTTP requests     │
  └──────────────┬───────────────┘
                 ↓
       ┌─────────┴─────────┐
       │                   │
  Box Score Parser    Raw Data Lake
  (derived mart)     (full JSON archive)
       │                   │
       └─────────┬─────────┘
                 ↓
           MotherDuck
      (cloud DuckDB warehouse)
                 ↓
        Next.js + WASM client
      (browser-side SQL queries)
  ```
- "All TypeScript. No Python. No CSV intermediary. JSON → parse → MotherDuck."

### Slide 12 — MotherDuck: The Glue
- **Visual**: MotherDuck logo + diagram showing dual role
- **Pipeline side**: `@duckdb/node-api` for server-side batch inserts
  - `INSERT OR REPLACE` for idempotent upserts
  - Batch size 500, direct SQL (no ORM)
- **Frontend side**: MotherDuck WASM client runs in the browser
  - No backend needed for reads — SQL runs client-side
  - Temp tables created per-session for performance
- **Why MotherDuck**: Cloud DuckDB = serverless analytical warehouse that
  also runs in the browser. One database, two access patterns.
- v1 → v2 migration: deploy alongside, swap when ready, zero downtime

### Slide 13 — The Adaptive Rate Limiter (Code Walkthrough)
- **Visual**: Actual code from `rate-limiter.ts` (simplified)
- Key concepts:
  - Rolling window of 15 outcomes (success/throttle)
  - Probe every 8 successes → adjust speed
  - Clean window: speed up 15% (aggressive)
  - Low errors (<10%): speed up 5% (gentle)
  - High errors: slow down 50-100%
  - Range: 200ms–10,000ms
- "It finds the fastest safe speed automatically. Like cruise control for APIs."
- **Speaker note**: This is the most technical slide. Walk through the
  speedup/slowdown logic. Emphasize that an agent wrote this — the design
  came from a conversation about "how do we not get rate limited?"

### Slide 14 — Bounded Concurrency
- **Visual**: Diagram showing dispatch queue + in-flight pool
- `MAX_IN_FLIGHT = 8` games simultaneously
- Rate limiter serializes dispatch (promise chain)
- But 8 HTTP requests can be in-flight at once
- Failed games requeued up to 3 retries
- "Serialized dispatch, parallel execution. The limiter controls the faucet,
  not the pipes."

### Slide 15 — Raw Data Lake Pattern
- **Visual**: Two-tier diagram (raw → derived)
- Problem: PBPStats returns 90+ fields, box_scores captures 19
- Re-fetching a full season = ~90 minutes (rate limits)
- Solution: store full JSON in `raw_game_data_pbpstats`
- `box_scores` becomes a derived mart — regenerate anytime
- `npm run hydrate` re-derives from raw without API calls
- "Store everything. Derive later. Your future self will thank you."

### Slide 16 — Data Quality
- 4 automated detectors: wrong-team, impossible-stats, score-mismatch, duplicates
- Quarantine table for anomalies
- Incremental auditing (only check new data)
- Auto-creates GitHub issues for pending anomalies
- "The agents didn't just build the pipeline — they built the guardrails too"

---

## Act 4: The Meta-Parallel (3 min)

### Slide 17 — Parallel Agents Built a Parallel Pipeline
- **Visual**: Side-by-side comparison
  | Development Parallelism | Pipeline Parallelism |
  |---|---|
  | Agent worker pool | Season worker pool |
  | Wave dispatch (dependency-aware) | Game dispatch (rate-aware) |
  | Worktree isolation | Batch isolation |
  | Validation after each wave | Data quality after each ingest |
  | Team lead coordinates | CLI orchestrator coordinates |
- "We used parallel agents to build a parallel pipeline.
  The development model mirrors the runtime model."

### Slide 18 — The Numbers
- 55 commits in 3 days
- 23 GitHub issues → 21 closed (91%)
- 93 tests across 9 suites (from 0)
- ~11K lines added, ~900 removed
- Python entirely eliminated
- 4 data quality detectors
- 3 GitHub Actions workflows
- 12 pipeline modules
- v1 minutes bug discovered (v2 more accurate than v1!)

---

## Act 5: Takeaways (2 min)

### Slide 19 — What Worked
- Dependency-aware wave dispatch (no agent blocked waiting)
- Shared branch > isolated worktrees (merge pain wasn't worth it)
- Validate after every wave (build + tests = green throughout)
- WORKLOG.md as shared memory between agents and sessions
- "Design the task graph. Let the agents execute."

### Slide 20 — What's Next
- The exponential curve isn't slowing down
- Labs are 12 months ahead of public tools
- The bottleneck is shifting: writing code → designing systems → asking the right questions
- "Dumb guy data engineering meant you didn't need a CS degree to build pipelines.
  Agentic engineering means you don't need to type the code either.
  What you DO need is taste, judgment, and the ability to decompose problems."

### Slide 21 — Thank You / Q&A
- Links: GitHub repo, MotherDuck, @matsonj
- "Try it: give Claude Code 23 issues and a weekend."

---

## Suggested GIF/Visual Checklist

- [ ] App home page: game card grid with scores
- [ ] Box score panel slide-in with stats
- [ ] Live mode toggle → green dot → real-time cell highlighting
- [ ] Player search autocomplete → filter results
- [ ] Player performance trend chart with stat toggles
- [ ] Season/team filter dropdowns
- [ ] Dark mode toggle
- [ ] Terminal screenshot: agent team output (3 agents running)
- [ ] Terminal screenshot: pipeline running with adaptive rate limiter output
- [ ] GitHub issues list (23 issues)

## Timing Budget

| Section | Minutes |
|---------|---------|
| Act 0: The App (demo) | 2 |
| Act 1: The Problem | 3 |
| Act 2: Workflow Evolution | 8 |
| Act 3: What Agents Built | 10 |
| Act 4: Meta-Parallel | 3 |
| Act 5: Takeaways | 2 |
| **Total** | **28** |
