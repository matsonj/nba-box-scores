# NHL Integration Plan — Comprehensive Review

## Executive Summary

The plan is solid in scope but has **4 critical issues** that should be addressed before execution:

1. **SportContext is over-engineered** — URL routing is simpler and eliminates 6 issues
2. **NHL API must be validated first** — types, components, and ingestion all depend on actual response shapes
3. **Database schema needs revision** — separate skater/goalie tables, not one sparse table
4. **Missing components** — PlayerGameLogPanel, DynamicTableLoader, and /charts route are not addressed

---

## Critical Architecture Decision: URL Routing vs SportContext

### Problem with SportContext
The proposed `SportConfig` bundles API endpoints, DB names, display logic, season math, game ID validation, and UI columns into one "god config" object. Retrofitting this context into every component means touching virtually every file — Issues 8-13 are entirely "make X sport-aware" wiring work.

Worse, toggling sport via React state creates **race conditions**:
- `DataLoader` has an `isLoading` guard that silently skips concurrent loads — toggling mid-load leaves WASM with stale tables
- `LiveDataContext` intervals continue firing with old endpoint URLs until effects re-run
- Hundreds of highlight timers in `highlightTimersRef`/`boldTimersRef` fire after sport switch

### Recommended Alternative: URL Routing
Make sport a path segment: `/` (NBA default) and `/nhl` (Easter egg). Benefits:
- URL is source of truth — no context propagation, no race conditions
- Route-based unmounting destroys all stale state automatically
- Shareable links, better SEO
- Each route imports sport-specific constants directly
- The easter egg toggle just navigates to the other route
- **Eliminates Issues 1, 8, 9, 10, 11, 12, 13 as separate work items**

The current `page.tsx` becomes a shared component receiving sport config as props from two thin route files.

### Impact on Issue Count
| Approach | Issues | Risk |
|----------|--------|------|
| SportContext (current plan) | 14 issues | High (race conditions, deep coupling) |
| URL routing | ~8 issues | Low (clean separation, automatic cleanup) |

---

## Issue-by-Issue Review

### Phase 0: API Validation (NEW — must come first)

**The plan acknowledges 6 unverified NHL API assumptions.** Every type definition, component, and ingestion script depends on knowing the actual response shapes. Building types first based on assumptions will cause significant rework.

**New Issue 0: NHL API Exploration**
- `curl` the real endpoints and document response structures
- `https://api-web.nhle.com/v1/score/now` — scoreboard
- `https://api-web.nhle.com/v1/gamecenter/{id}/boxscore` — box score
- `https://api-web.nhle.com/v1/gamecenter/{id}/play-by-play` — plays
- `https://api-web.nhle.com/v1/schedule/{date}` — schedule
- Verify: field names, nesting, game state values, period score structure, player grouping (forwards/defense/goalies)
- **Complexity**: S | **Blocks**: Issues 4, 5, 6, 14

---

### Issue 1: Sport Context & Easter Egg Toggle → Reframe as URL Routing
**Complexity**: M → S (if URL-routed)
**Recommendation**: Create `/app/nhl/page.tsx` that imports a shared `HomePage` component with NHL config. Add clickable title that navigates between `/` and `/nhl`. Persist last-visited sport in localStorage for the root `/` redirect.

---

### Issue 2: NHL Teams & Season Utilities
**Complexity**: S | **No changes to plan needed**

Key details to add:
- 32 NHL teams (note UTA replacing ARI for current season)
- NHL uses same October season boundary as NBA
- NHL game ID prefixes: position 4-5 where `01`=preseason, `02`=regular, `03`=playoffs
- NHL periods: 3 regular + OT + SO (vs NBA's 4 quarters + OT)
- Map NHL `goals` to the shared `points` field in `PeriodScore` interface to minimize component changes

**Acceptance criteria**:
- [ ] All 32 NHL teams with abbreviations and full names
- [ ] Season year calculation works (Oct boundary)
- [ ] Period labels: 1→"1st", 2→"2nd", 3→"3rd", 4→"OT", 5→"SO"
- [ ] Playoff detection from game ID works
- [ ] Unit tests for all utility functions

---

### Issue 3: NHL Database & Table Constants
**Complexity**: S | **Minor revision needed**

Add `getSourceTables(sport)` and `getTempTables(sport)` functions to `constants/tables.ts`. Keep existing exports for backward compatibility.

**Key decision**: Alias NHL `goals AS points` in the team_stats view so `useBoxScores` SQL works unchanged for both sports.

---

### Issue 4: NHL Live Scores API Route
**Complexity**: M | **Blocked by Issue 0**

Mirror `pages/api/live-scores.ts` but fetch from NHL API. Response must conform to existing `LiveScoresResponse` interface so `LiveDataContext` works without modification.

**Agent instructions**: First `curl` the real endpoint, then build the mapper.

---

### Issue 5: NHL Live Box Score API Route
**Complexity**: L | **Blocked by Issue 0**

Most complex API route. NHL box scores group players by position (forwards/defense/goalies) vs NBA's flat array. Goalie stats are completely different fields.

**Key decision**: Create `NHLLiveBoxScoreResponse` type (not reuse NBA's). Use discriminated union with `sport` field. The `LiveDataContext` handles either type.

---

### Issue 6: NHL Type Definitions
**Complexity**: S | **Blocked by Issue 0** (must match actual API)

Create `app/types/nhl-live.ts` and `app/types/nhl-schema.ts`. Keep `LiveScoreGame` shared (scoreboard shape is identical). Separate skater and goalie stat interfaces.

---

### Issue 7: NHL Box Score Component
**Complexity**: L | **No changes to plan needed**

**Pre-requisite extraction**: Pull `getCellClasses()` and `getCombinedCellClasses()` from `BoxScore.tsx` into `lib/cellHighlightUtils.ts` before building `NHLBoxScore.tsx`.

Two tables per team:
- **Skaters**: Player | TOI | G | A | PTS | +/- | PIM | SOG | HIT | BLK | GV | TK | FO%
- **Goalies**: Player | TOI | SA | GA | SV | SV% | Dec

Skaters sorted: forwards (C/L/R) first, then defense (D), by TOI descending within each group.

---

### Issues 8-13: Wiring (Sport-Aware Components)
**If URL routing is adopted**: These collapse into the route setup + shared component parameterization. Each component receives sport config as props instead of reading from context.

**If SportContext is kept**: Each needs careful attention to:
- Adding `activeSport` to all `useCallback`/`useMemo` dependency arrays
- Resetting state on sport change
- The `LiveDataContext` sport-switch cleanup (clear timers, abort in-flight fetches)

---

### Issue 14: NHL Data Ingestion Pipeline
**Complexity**: XL | **Independent of frontend work**

**Recommended to start early** — it's a blocker for testing Issues 3, 9, 10, 13 with real data.

Reuse shared infrastructure: `db/connection.ts`, `api/rate-limiter.ts`, `workers/pool.ts`, `util/logger.ts`, `util/shutdown.ts`.

**Key decisions**:
- Separate script (`scripts/ingest/nhl/index.ts`), not a `--sport` flag on existing pipeline
- Single `box_scores` table with `position` column (skaters + goalies) — *Architect recommends separate tables, see Database Design below*
- Add npm script: `"ingest:nhl": "tsx scripts/ingest/nhl/index.ts"`

---

## Database Design Revision

### Problem: Skaters and Goalies in One Table
The plan puts both in `nhl_box_scores.main.box_scores` with `position='G'` for goalies. This creates:
- ~50% NULL columns per row (skaters don't have saves/goalsAgainst; goalies don't have goals/assists/hits)
- Semantic confusion (`goals` means different things for skaters vs goalies)
- Every query needs position filtering

### Recommendation: Two Tables
```
nhl_box_scores.main.skater_stats
  game_id, team_abbreviation, entity_id, player_name, position,
  toi, goals, assists, points, plus_minus, pim, shots, hits,
  blocked_shots, takeaways, giveaways, faceoff_wins, faceoff_losses,
  starter, period

nhl_box_scores.main.goalie_stats
  game_id, team_abbreviation, entity_id, player_name,
  toi, saves, goals_against, save_pct, shots_against,
  decision, starter, period
```

This mirrors the NHL API's own structure and maps cleanly to the two separate UI tables.

---

## Missing Pieces the Plan Must Address

### 1. PlayerGameLogPanel (Critical)
`components/PlayerGameLogPanel.tsx` queries `box_scores` and `schedule` directly and renders NBA-specific columns (PTS, REB, AST). Clicking a player name in NHL mode would show basketball stats for a hockey player. **Must be made sport-aware or disabled for NHL.**

### 2. DynamicTableLoader / Game Quality
`DynamicTableLoader` creates `temp_dynamic_stats` with NBA fantasy scoring logic (FG%, FT%, 3PM). None of this applies to NHL. **Must be disabled or recreated for NHL.**

### 3. /charts Route
The `/charts` route displays NBA analytics. **Must be hidden or made sport-aware in NHL mode.**

### 4. MotherDuck WASM Cross-Database Access
The plan assumes the WASM client can query `nhl_box_scores.main.*` from the same connection scoped to `nba_box_scores_v2`. **Must verify cross-database queries work in the WASM client before committing to separate databases.**

### 5. Error States
- What if `nhl_box_scores` database doesn't exist or is empty?
- Loading UX when toggling sports
- NHL API unreachable during off-season (no games)
- No data for selected season

### 6. Testing Strategy
Every existing test hard-codes NBA assumptions. Need:
- NHL period utils tests (3 periods, OT, SO)
- NHL team mapping tests
- NHL API response parsing tests
- Integration tests for sport toggle

---

## Revised Implementation Order

```
Phase 0: Validation
  NEW: NHL API Exploration (curl + document responses)
  NEW: Verify MotherDuck WASM cross-database queries

Phase 1: Foundation (parallel)
  Issue 1:  URL routing setup (or SportContext if preferred)
  Issue 2:  NHL teams & season utilities
  Issue 14: NHL ingestion pipeline (independent, start early)

Phase 2: Data Layer (parallel, after Phase 0)
  Issue 3:  NHL database & table constants
  Issue 6:  NHL type definitions (informed by real API responses)
  Issue 4:  NHL live scores API route
  Issue 5:  NHL live box score API route

Phase 3: UI (after Phase 2)
  Issue 7:  NHL box score component (extract shared utils first)

Phase 4: Wiring (after Phases 1-3)
  Issues 8-13: Make components sport-aware (or skip if URL-routed)
  NEW: PlayerGameLogPanel sport-awareness
  NEW: DynamicTableLoader/charts handling

Phase 5: Polish
  Issue 1:  Easter egg toggle UX
  Testing & verification
```

---

## Parallelization Map

```
         Phase 0          Phase 1              Phase 2           Phase 3    Phase 4
        ┌─────────┐   ┌──────────────┐    ┌──────────────┐    ┌────────┐  ┌────────┐
        │ API     │──▶│ Issue 2      │──▶ │ Issue 6      │──▶ │Issue 7 │─▶│ Wire   │
        │ Explore │   │ Teams/Utils  │    │ Types        │    │NHL Box │  │ all    │
        └─────────┘   ├──────────────┤    ├──────────────┤    └────────┘  └────────┘
        ┌─────────┐   │ Issue 1      │    │ Issue 3      │
        │ WASM    │──▶│ URL Routing  │    │ Table Consts │
        │ Verify  │   ├──────────────┤    ├──────────────┤
        └─────────┘   │ Issue 14     │    │ Issue 4      │
                      │ Ingestion ──────▶ │ Live Scores  │
                      │ Pipeline    │    ├──────────────┤
                      └──────────────┘    │ Issue 5      │
                                          │ Live BoxScore│
                                          └──────────────┘
```

---

## Decisions (Resolved)

1. **URL routing** — Use path segments (`/` for NBA, `/nhl` for NHL). No SportContext. Easter egg toggle navigates between routes. Issues 8-13 collapse into route setup.
2. **Separate skater/goalie tables** — `nhl_box_scores.main.skater_stats` and `nhl_box_scores.main.goalie_stats`. Also keep `raw_nhl_box_scores` table with full API JSON so we can extract more data later.
3. **NHL data start year: 2015** — 10 seasons of historical data. `getAvailableSeasons()` starts from 2015.
4. **Pipeline auto-creates database** — Use `CREATE DATABASE IF NOT EXISTS nhl_box_scores` in the ingestion pipeline.
5. **Stub NHL-specific features as TBD** — UI is identical between sports. Features that don't work in NHL mode (charts, game quality) show a cheeky "Coming soon — NHL analytics are in the penalty box" style message. No hidden routes.

## NHL API Findings (Validated)

API reference doc: `docs/nhl-api-reference.md`

Key findings that impact the plan:
- **No auth required** — all endpoints publicly accessible
- **No period linescores in box score** — `summary` field is always `{}`. Period scoring must be reconstructed from scoreboard `goals[]` array (has running `awayScore`/`homeScore`) or play-by-play goal events
- **Player grouping**: `playerByGameStats.{team}.forwards[]`, `.defense[]`, `.goalies[]` — each with distinct stat fields
- **Localized strings**: Many fields use `{ default: string, fr?: string }` — must access `.default`
- **Game states**: `FUT` → `LIVE` → `FINAL` → `OFF`
- **Game outcomes**: `lastPeriodType` is `"REG"`, `"OT"` (with `otPeriods` count), or `"SO"`
- **TOI format**: `"MM:SS"` string — no parsing needed
- **Game ID format**: 10-digit, e.g. `2024020705` (YYYY + type + game number, where 01=pre, 02=regular, 03=playoffs)
- **Play-by-play**: 14 event types including `goal`, `shot-on-goal`, `penalty`, etc. — usable for "last play" feature
