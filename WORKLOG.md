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

## Data Quality
*(To be filled as data quality issues are completed)*

## UI Evolution
*(To be filled as UI issues are completed)*

## Team Execution
*(To be filled as we observe coordination patterns)*

## Numbers
*(To be filled: total games ingested, API calls, time to backfill, issues found)*
