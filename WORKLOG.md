# NBA Box Scores Refactor — Work Log

> Source material for conference talk: "I vibe-coded an NBA app and here's what happened when I tried to make it production-grade"

---

## Architecture Decisions

### Why All-TypeScript?
- Original pipeline was Python/TypeScript hybrid (Python parser + bash scripts + TypeScript fetchers)
- Maintaining two languages doubled cognitive overhead and made CI/CD harder
- TypeScript everywhere means one `tsconfig`, one test framework, one linting setup
- PBPStats JSON responses map naturally to TypeScript interfaces

### Why MotherDuck v2 Database?
- v1 (`nba_box_scores`) has no season tracking, no playoff distinction, no ingestion log
- Can't do incremental ingestion — no way to know which games are already loaded
- v2 adds: `season_year`, `season_type`, `ingestion_log`, `data_quality_quarantine`
- Deploy v2 alongside v1, swap frontend when ready — zero downtime migration

### Why Direct Loading (no CSV intermediary)?
- v1 pipeline: JSON -> Python -> local DuckDB -> CSV export -> MotherDuck
- v2 pipeline: JSON -> TypeScript parser -> MotherDuck via `@duckdb/node-api`
- Eliminates 3 intermediate steps, reduces ingestion time dramatically
- `INSERT OR REPLACE` on primary keys gives idempotent upserts for free

---

## Work Log Entries

### 2026-03-02 — Team Lead — Project kickoff and parallel task dispatch
- **What was done**: Analyzed all 23 GitHub issues, identified dependency graph, created agent team with 3 parallel executors on isolated worktrees
- **Key decisions**: Start with unblocked P0s (#14 schema, #21 SQL injection, #22 dead code) in parallel since they have no dependencies on each other
- **Execution model**: Team of 3 agents on git worktrees + team lead coordinating
- **Created**: WORKLOG.md, memory/MEMORY.md, memory/issue-tracker.md

### 2026-03-02 — schema-designer agent — Design v2 database schema (#14)
- **What was done**: Created `nba_box_scores_v2` database in MotherDuck with 4 tables + 1 view
- **Tables created**: `schedule` (PK: game_id, new: season_year, season_type), `box_scores` (composite PK: game_id, entity_id, period), `ingestion_log` (PK: game_id), `data_quality_quarantine` (PK: id), `team_stats` (VIEW derived from box_scores)
- **Files created**: `scripts/ingest/db/schema.ts` (named DDL constants), `docs/schema.md` (full documentation with v1-vs-v2 comparison)
- **Key decisions**: team_stats as a VIEW instead of materialized table — simpler, always consistent with box_scores. Composite PK on box_scores enables idempotent INSERT OR REPLACE.

### 2026-03-02 — security-fixer agent — Fix SQL injection vulnerabilities (#21)
- **What was done**: Created `lib/queryUtils.ts` with 3 sanitization functions, patched 2 components, added 12 unit tests
- **Files created**: `lib/queryUtils.ts`, `lib/__tests__/queryUtils.test.ts`
- **Files modified**: `components/BoxScorePanel.tsx` (sanitized gameId in 3 queries), `components/PlayerGameLogPanel.tsx` (sanitized entityId)
- **Key decisions**: Input validation over parameterized queries because MotherDuck WASM client doesn't support parameterized queries natively. Strict numeric-only validation for IDs, 3-letter uppercase for team abbreviations.

### 2026-03-02 — code-cleaner agent — Remove dead code (#22)
- **What was done**: Deleted 4 dead files, removed 2 empty directories, cleaned up 2 files
- **Files deleted**: `context/ScheduleContext.tsx`, `context/PopoverContext.tsx`, `hooks/useBoxScore.ts`, `lib/__tests__/db.test.ts`
- **Dirs deleted**: `context/`, `lib/__tests__/`
- **Files edited**: `app/page.tsx` (removed ScheduleProvider import/wrapper + loadingGames state), `hooks/useGameData.ts` (removed dead fetcher + fetchSchedule)
- **Key decisions**: Verified every deletion by confirming no imports existed anywhere in codebase
- **Build verification**: `npm run build` passes clean

### 2026-03-02 — code-cleaner agent — Extract constants, period utils, consolidate dates (#23)
- **What was done**: Created `constants/game.ts` and `lib/periodUtils.ts`, moved team abbreviations to `lib/teams.ts`, added `parseGameDate` to `lib/dateUtils.ts`
- **Files created**: `constants/game.ts`, `lib/periodUtils.ts`
- **Files modified**: `lib/teams.ts`, `lib/dateUtils.ts`, `components/GameCard.tsx` (113→69 lines via dedup), `lib/queries/dynamicTableQuery.ts` (6 magic number replacements), `app/page.tsx`, `components/BoxScorePanel.tsx`
- **Key decisions**: Period logic consolidated into 3 pure functions. GameCard.tsx cut by 40% by eliminating triple-duplicated period calculation. `parseGameDate` handles both string and Date inputs with consistent UTC handling.

### 2026-03-02 — security-fixer agent — Add comprehensive test suite (#31)
- **What was done**: Created 5 new test files, 54 total tests passing across 6 suites
- **Files created**: `lib/__tests__/dateUtils.test.ts` (4 tests), `lib/__tests__/periodUtils.test.ts` (16 tests), `lib/__tests__/teams.test.ts` (5 tests), `lib/__tests__/dataLoader.test.ts` (7 tests), `components/__tests__/GameCard.test.tsx` (7 tests)
- **Key decisions**: Used timezone-independent assertions for date tests. Mocked MotherDuck evaluateQuery for dataLoader tests. Tested concurrent dedup and error propagation in DataLoader.

---

## Pipeline Design

### 2026-03-02 — schema-designer agent — Core pipeline infrastructure (#15)
- **What was done**: Created 7 foundational modules under `scripts/ingest/`
- **Modules**: `config.ts` (CLI parser), `types.ts` (shared interfaces), `api/rate-limiter.ts` (token-bucket 150ms), `api/client.ts` (Axios + PBPStats with backoff), `workers/pool.ts` (async worker pool with AbortSignal), `util/logger.ts` (structured JSON logging), `util/shutdown.ts` (graceful SIGINT/SIGTERM)
- **Dependency added**: `@duckdb/node-api` ^1.4.4-r.2
- **Key decisions**: JSON logging to stdout/stderr (machine-parseable for GitHub Actions). Token-bucket rate limiter is singleton to prevent thundering herd. Worker pool uses shared queue pattern — items pulled on demand, not pre-distributed. 3x backoff multiplier on 429s (PBPStats rate limit is aggressive).
- **Design note**: Config uses simple arg parsing (no external deps like yargs) — keeps pipeline dependency-light

### 2026-03-02 — pipeline-builder agent — Build CLI orchestrator (#18)
- **What was done**: Created `scripts/ingest/workers/season-worker.ts` (processSeason function) and `scripts/ingest/index.ts` (CLI entry point). Added 5 npm scripts (ingest, ingest:current, ingest:backfill, ingest:playoffs, ingest:status).
- **Key decisions**: Season worker fetches game list, checks ingestion_log for incremental skip, fans out to game worker pool. Per-game errors logged but don't halt processing. CLI supports dry-run mode. Team stats view refreshed after all seasons complete.
- **Milestone**: This was the last P0 — all 7 P0 issues now complete.

### 2026-03-02 — frontend-dev agent — Build streaming mode foundation (#29)
- **What was done**: Created server-side API proxy (`pages/api/live-scores.ts`), live polling hook (`hooks/useLivePolling.ts`), and header toggle (`components/LiveModeToggle.tsx`). Integrated into `app/layout.tsx`.
- **Key decisions**: 5s in-memory cache on proxy to prevent API hammering. Polling pauses when tab hidden (visibility API). Pulsing green dot + time-ago display for UX.

### 2026-03-02 — infra-dev agent — Build ingestion status dashboard (#35)
- **What was done**: Created `scripts/ingest/status.ts` CLI tool and `scripts/ingest/db/queries.ts` with reusable status queries.
- **Key decisions**: ASCII table output, supports --season and --errors flags.

### 2026-03-02 — frontend-dev agent — Set up GitHub Actions (#28)
- **What was done**: Created 3 workflow files: nightly-sync.yml (6AM UTC cron), hourly-update.yml (hourly Oct-Jun), backfill.yml (manual workflow_dispatch with season inputs).
- **Key decisions**: Node 22, npm ci with cache, MOTHERDUCK_TOKEN as secret. Hourly limited to NBA season months. Backfill has 4hr timeout for 25 seasons.

### 2026-03-02 — schema-designer agent — MotherDuck database layer and batch loader (#17)
- **What was done**: Created `scripts/ingest/db/connection.ts` (MotherDuckConnection class using @duckdb/node-api) and `scripts/ingest/db/loader.ts` (Loader class with batch operations)
- **Loader methods**: `loadBoxScoreRows`, `loadScheduleRows`, `markIngested`, `isGameIngested`, `getIngestedGameIds`, `deriveTeamStats`, `ensureSchema`
- **Key decisions**: Batch INSERT OR REPLACE with configurable batch size (default 500). SQL values go through `esc()` (single-quote doubling) and `num()` (null-safe number) helpers. Connection uses `md:` prefix for MotherDuck.

### 2026-03-02 — security-fixer agent — Rewrite box score parser Python→TypeScript (#16)
- **What was done**: Ported `src/nba_box_scores/box_score_parser.py` to `scripts/ingest/parse/box-score-parser.ts` + `season-utils.ts`. 31 tests validated against 3 real JSON fixtures (regulation, single OT, double OT).
- **Key decisions**: FullGame rows computed by aggregating per-period data (matches Python SQL view approach). Starter heuristic: top 5 scorers per team. FG mapping: fg_made = FG2M + FG3M. Minutes summed as MM:SS across periods. Season type derived from game_id prefix.

### 2026-03-02 — Team Lead — v1 vs v2 parser validation (spot check)
- **What was done**: Compared v1 MotherDuck data against new TypeScript parser output for game 0022500825 (CHI 99 - NYK 105, 2026-02-23)
- **Result**: All core stats (PTS, REB, AST, STL, BLK, TO, FG, 3PT, FT) match perfectly across all 19 players
- **Bug found in v1**: Minutes inflated by ~1:00 for 7 players. New parser matches raw JSON exactly. Example: Matas Buzelis v1=26:58, v2=25:58, rawJSON=25:58. Root cause likely in the Python parser's minutes handling.
- **Starter diffs**: 5 players differ due to tie-breaking in "top 5 scorers" heuristic — neither is wrong, just different ordering
- **Conclusion**: v2 parser is more accurate than v1. Safe to proceed with backfill.

## Data Quality
*(To be filled as data quality issues are completed)*

## UI Evolution

### 2026-03-02 — code-cleaner agent — Season and playoff filtering (#24)
- **What was done**: Created `components/SeasonFilter.tsx` (3 dropdowns) and `lib/seasonUtils.ts`. URL params (`?season=2024&type=playoffs&team=LAL`) persist filters. Updated hooks to accept filters. Playoff games get amber left border.
- **Key decisions**: Season type derived from game_id prefix (002=regular, 004=playoffs) since v2 columns don't exist in v1 data yet. Season year derived from game_date (Oct+ = new season).

### 2026-03-02 — code-cleaner agent — MViz data visualizations (#25)
- **What was done**: Added recharts. Created 3 chart components: `PlayerPerformanceTrend` (line chart), `TeamComparisonChart` (bar chart), `GameQualityDistribution` (histogram). Added `/charts` route. Integrated charts as toggles in existing panels.
- **Key decisions**: All charts use `dynamic(() => import(...), { ssr: false })` to avoid SSR hydration issues with recharts. Dark-mode-compatible styling.

### 2026-03-02 — schema-designer agent — Responsive design and UI polish (#34)
- **What was done**: Fixed text-[50%] → text-xs in BoxScorePanel, fixed sticky header overlap, added pagination (7 dates/page), added player name search with 300ms debounce, added DynamicStatsTable auto-retry polling, audited breakpoints.
- **Key decisions**: Player search uses `escapeSqlString()` for injection protection. Pagination by date groups (not individual games) for natural browsing. Debounced search to avoid excessive MotherDuck queries.

## Team Execution

### Session 1: 2026-03-02 — 3 parallel agents
- **Model**: 3 agents (`schema-designer`, `security-fixer`, `code-cleaner`) on shared worktree, team lead coordinating
- **Wave 1** (P0, no blockers): #14 schema, #21 SQL injection, #22 dead code — all 3 completed in parallel
- **Wave 2** (P0+P1, unblocked by wave 1): #15 pipeline infra, #16 parser, #23 constants, #24 filtering, #31 tests
- **Wave 3** (P1+P2, unblocked by wave 2): #17 DB layer, #25 MViz, #34 responsive
- **What went well**: Dependency-aware task dispatch kept all agents busy. Pipeline critical path (#14→#15→#16→#17) completed in 4 waves.
- **What to improve**: Agents initially on isolated worktrees caused merge complexity. Switched to shared worktree mid-session. Need clearer commit discipline per-agent.
- **Issues completed**: 11 of 23 (48%) in one session
- **Test coverage**: 0 → 93 tests across 9 suites
- **Lines added**: ~4,000+ (new pipeline, charts, tests, utils)
- **Lines removed**: ~900 (dead code, duplicated logic)

## Numbers
### Session 2: 2026-03-02 — Continued with 3 new agents
- **Model**: 3 agents (`pipeline-builder`, `frontend-dev`, `infra-dev`) on shared branch
- **Wave 4**: #18 orchestrator (last P0!), #29 streaming mode, #35 status dashboard
- **Wave 5**: #28 GitHub Actions, #20 Python removal, #26 data quality, #27 GH Issues automation
- **Wave 6**: #33 frontend v2 swap (in progress)
- **Validation**: Ran build + tests after every wave — all green throughout
- **v1 vs v2 spot check**: Game 0022500825 — all stats match, found v1 minutes inflation bug

## Numbers
- **Issues completed**: 21 of 23 (91%) — only #19 (backfill, operational) and #30 (pre-2000, P3) remain
- **Tests**: 93 passing across 9 suites
- **Commits on branch**: 18
- **New routes**: `/charts`, `/api/live-scores`
- **Pipeline modules**: 12 (config, types, rate-limiter, client, pool, logger, shutdown, schema, connection, loader, season-worker, index)
- **Data quality detectors**: 4 (team-switch, impossible-stats, score-mismatch, duplicates)
- **GitHub Actions workflows**: 3 (nightly, hourly, backfill)
- **Chart components**: 3 (PlayerPerformanceTrend, TeamComparisonChart, GameQualityDistribution)
- **Python/legacy files removed**: ~10 files + entire `src/nba_box_scores/` directory
