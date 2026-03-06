# NHL Integration Plan

## Context

The existing NBA Box Scores app (`nba-box-scores`) is a Next.js 16 application that displays NBA game schedules, live scores, and detailed box scores using a combination of:
- **MotherDuck** (cloud DuckDB) for historical data (`nba_box_scores_v2` database)
- **NBA CDN APIs** for live scores and box scores
- **Client-side polling** with diff-based cell highlighting

The goal is to clone the entire experience for NHL data, keeping the app otherwise identical, with an Easter egg toggle: clicking "NBA" in the title switches to NHL mode (and vice versa). NHL data will live in a **separate MotherDuck database**.

---

## Items to Clarify Before Starting Work

> These could not be verified due to network restrictions in the dev environment. Each issue should be validated by calling the API locally before implementation begins.

1. **NHL `/v1/score/now` response structure** - Verify exact JSON field names, nesting, and game state values (`LIVE`, `FUT`, `OFF`, `FINAL`, `CRIT`, `PRE`)
2. **NHL `/v1/gamecenter/{id}/boxscore` response structure** - Verify `playerByGameStats` nesting (forwards/defense/goalies), exact field names for skater stats (`goals`, `assists`, `shots`, `hits`, `blockedShots`, `toi`, `plusMinus`, `pim`, etc.) and goalie stats (`savePctg`, `goalsAgainst`, `saveShotsAgainst`, `toi`, etc.)
3. **NHL `/v1/gamecenter/{id}/play-by-play` response structure** - Verify play-by-play event format for "last play" feature
4. **NHL game ID format** - Confirm format (e.g., `2024020204`) and season type prefixes (preseason=1, regular=2, playoffs=3)
5. **NHL period scoring in score endpoint** - Verify how period-by-period scores are returned (likely in `periodDescriptor` or similar)
6. **MotherDuck database name** - Decide on `nhl_box_scores` or similar for the separate database

---

## Architecture Overview

### Sport Context Pattern

Introduce a `SportContext` that tracks the active sport (`'nba' | 'nhl'`) and provides sport-specific configuration. This is the central routing mechanism that makes every downstream component sport-aware.

```
SportContext
  ├── activeSport: 'nba' | 'nhl'
  ├── setActiveSport()
  ├── config: SportConfig  (API URLs, DB names, stat columns, teams, etc.)
```

### File Organization Strategy

Create parallel NHL modules alongside existing NBA code. Shared infrastructure (polling, diff engine, UI shell) stays as-is. Sport-specific code lives in clearly separated files.

```
lib/
  sports/
    types.ts          # SportConfig interface, sport union type
    nba.ts            # NBA-specific config (existing values extracted)
    nhl.ts            # NHL-specific config
    SportContext.tsx   # React context + provider
    index.ts          # Re-exports
  nhl/
    teams.ts          # NHL team abbreviations + names (32 teams)
    seasonUtils.ts    # NHL season logic (Oct start, different ID prefixes)
    periodUtils.ts    # NHL period labels (1st/2nd/3rd/OT/SO)
constants/
  nhl-tables.ts       # NHL MotherDuck table names
pages/api/
  nhl-live-scores.ts  # NHL live scores endpoint
  nhl-live-boxscore.ts # NHL live boxscore endpoint
app/types/
  nhl-live.ts         # NHL-specific live data types
  nhl-schema.ts       # NHL-specific DB schema types (or extend existing)
components/
  NHLBoxScore.tsx     # NHL box score table (different columns: goals/assists/shots/hits/blocks/TOI/+- for skaters, separate goalie table)
```

---

## Issues Breakdown

### Issue 1: Sport Context & Easter Egg Toggle

**Files to create:**
- `lib/sports/types.ts` - `SportConfig` interface
- `lib/sports/nba.ts` - Extract existing NBA config
- `lib/sports/nhl.ts` - NHL config
- `lib/sports/SportContext.tsx` - Context provider with localStorage persistence
- `lib/sports/index.ts`

**Files to modify:**
- `app/layout.tsx` - Wrap with `SportProvider`, make title clickable

**SportConfig interface:**
```ts
interface SportConfig {
  id: 'nba' | 'nhl';
  displayName: string;           // "NBA" or "NHL"
  subtitle: string;              // "mega fast sports data"
  liveScoresEndpoint: string;    // "/api/live-scores" or "/api/nhl-live-scores"
  liveBoxScoreEndpoint: string;  // "/api/live-boxscore" or "/api/nhl-live-boxscore"
  database: string;              // "nba_box_scores_v2" or "nhl_box_scores"
  teams: Record<string, string>; // abbreviation -> full name
  teamAbbreviations: string[];
  getSeasonYear: (date: Date) => number;
  formatSeasonLabel: (year: number) => string;
  getAvailableSeasons: () => number[];
  isPlayoffGame: (gameId: string) => boolean;
  periodLabels: (period: string) => string;
  statColumns: StatColumn[];     // defines the box score table columns
  gameIdPattern: RegExp;         // for validation
}
```

**Easter egg toggle in layout.tsx:**
- Make the sport name in `<h1>` a clickable `<span>` with `cursor: pointer` but no other visual indicator
- `onClick` toggles `activeSport` between `'nba'` and `'nhl'`
- Persist choice in `localStorage`
- Title changes: "NBA Box Scores" <-> "NHL Box Scores"
- Page metadata updates dynamically

---

### Issue 2: NHL Teams & Season Utilities

**Files to create:**
- `lib/nhl/teams.ts` - All 32 NHL team abbreviations and full names
- `lib/nhl/seasonUtils.ts` - NHL season year calculation (same Oct boundary as NBA), NHL season format (`20252026`), playoff detection from game ID
- `lib/nhl/periodUtils.ts` - Period labels: `1` -> "1st", `2` -> "2nd", `3` -> "3rd", `4`+ -> "OT"/"OT2"/etc., "SO" for shootout

**NHL Teams (32):**
ANA, ARI/UTA, BOS, BUF, CGY, CAR, CHI, COL, CBJ, DAL, DET, EDM, FLA, LAK, MIN, MTL, NSH, NJD, NYI, NYR, OTT, PHI, PIT, SEA, SJK, STL, TBL, TOR, VAN, VGK, WPG, WSH

**NHL Game ID prefixes:**
- Regular season: starts with `2024020...` (02 = regular)
- Playoffs: starts with `2024030...` (03 = playoffs)
- Preseason: starts with `2024010...` (01 = preseason)

---

### Issue 3: NHL MotherDuck Database & Table Constants

**Files to create:**
- `constants/nhl-tables.ts` - NHL table names pointing to separate database

```ts
export const NHL_SOURCE_TABLES = {
  SCHEDULE: 'nhl_box_scores.main.schedule',
  BOX_SCORES: 'nhl_box_scores.main.box_scores',
  TEAM_STATS: 'nhl_box_scores.main.team_stats',
};

export const NHL_TEMP_TABLES = {
  SCHEDULE: 'nhl_temp_schedule',
  BOX_SCORES: 'nhl_temp_box_scores',
  TEAM_STATS: 'nhl_temp_team_stats',
  DYNAMIC_STATS: 'nhl_temp_dynamic_stats',
};
```

**Files to modify:**
- `constants/tables.ts` - Make `resolveTable` sport-aware (accept database config param)
- `hooks/useGameData.ts` - Make hooks use the active sport's table names
- `lib/dataLoader.ts` - Parameterize database/table references

**NHL Database Schema** (mirrors NBA structure with hockey-specific columns):

`nhl_box_scores.main.schedule`:
- game_id, game_date, home_team_id, away_team_id, home_team_abbreviation, away_team_abbreviation, home_team_score, away_team_score, game_status, season_year, season_type, created_at

`nhl_box_scores.main.box_scores`:
- game_id, team_abbreviation, entity_id, player_name, position, minutes (TOI), goals, assists, points, plus_minus, pim, shots, hits, blocked_shots, takeaways, giveaways, faceoff_wins, faceoff_losses, starter, period
- For goalies (separate rows or same table with position='G'): saves, goals_against, save_pct, shots_against, toi

`nhl_box_scores.main.team_stats`:
- game_id, team_abbreviation, period, goals, shots, hits, blocked_shots, pim, faceoff_pct, power_play_goals, power_play_opportunities

---

### Issue 4: NHL Live Scores API Route

**Files to create:**
- `pages/api/nhl-live-scores.ts`

**Pattern:** Mirror `pages/api/live-scores.ts` but fetch from `https://api-web.nhle.com/v1/score/now`

**Key mapping (NHL API -> our types):**
```
game.id                      -> game_id
game.startTimeUTC            -> game_date
game.homeTeam.abbrev         -> home_team_abbreviation
game.awayTeam.abbrev         -> away_team_abbreviation
game.homeTeam.id             -> home_team_id
game.awayTeam.id             -> away_team_id
game.homeTeam.score          -> home_team_score
game.awayTeam.score          -> away_team_score
game.gameState               -> status (map: LIVE/CRIT->"In Progress", OFF/FINAL->"Final", FUT/PRE->"Scheduled")
game.period                  -> period
game.clock.timeRemaining     -> clock
```

**Period scores:** Extract from the score API response (verify structure during clarification).

---

### Issue 5: NHL Live Box Score API Route

**Files to create:**
- `pages/api/nhl-live-boxscore.ts`

**Pattern:** Mirror `pages/api/live-boxscore.ts` but fetch from `https://api-web.nhle.com/v1/gamecenter/{gameId}/boxscore`

**Key differences from NBA:**
- Players grouped by position (forwards/defense/goalies) instead of flat list
- Goalies have completely different stats
- Minutes field is TOI string (e.g., "23:04") not PT format
- Stats: goals, assists, points, shots, hits, blockedShots, pim, plusMinus, toi, faceoffWinningPctg
- Goalie stats: saveShotsAgainst, savePctg, goalsAgainst, toi, decision

**Also fetch play-by-play** from `https://api-web.nhle.com/v1/gamecenter/{gameId}/play-by-play` for the "last play" feature.

---

### Issue 6: NHL Type Definitions

**Files to create:**
- `app/types/nhl-live.ts` - NHL-specific live types

```ts
interface NHLLivePlayerStats {
  personId: string;
  playerName: string;
  position: string;         // C, L, R, D, G
  toi: string;              // "23:04" format
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;              // penalty minutes
  shots: number;
  hits: number;
  blockedShots: number;
  takeaways: number;
  giveaways: number;
  faceoffWinPct: number;
  starter: boolean;
  oncourt: boolean;         // rename to "onice" for NHL
  played: boolean;
}

interface NHLLiveGoalieStats {
  personId: string;
  playerName: string;
  toi: string;
  saves: number;
  goalsAgainst: number;
  savePct: number;
  shotsAgainst: number;
  decision: string;         // W, L, OTL, or ""
  starter: boolean;
}
```

**Approach decision:** Use a union type or generalize `LivePlayerStats` with sport-specific fields. Recommendation: keep separate types for NHL since the stat shapes are fundamentally different (skaters vs goalies), and use a discriminated union at the box score response level.

---

### Issue 7: NHL Box Score Component

**Files to create:**
- `components/NHLBoxScore.tsx`

**Key differences from `components/BoxScore.tsx`:**

**Skater table columns:** Player | TOI | G | A | PTS | +/- | PIM | SOG | HIT | BLK | GV | TK | FO%

**Goalie table columns:** Player | TOI | SA | GA | SV | SV% | Decision

**Layout:**
- Two sections per team: Skaters table + Goalies table
- Skaters sorted: Forwards (C, L, R) then Defense (D), each group by TOI descending
- Goalies listed separately below skaters

**Reuse from existing BoxScore.tsx:**
- `getCellClasses()` and `getCombinedCellClasses()` for diff highlighting (extract to shared util)
- Overall table styling/layout patterns
- Player click handler for game log

**DIFF_FIELDS for NHL:**
```ts
const NHL_DIFF_FIELDS = [
  'goals', 'assists', 'points', 'plusMinus', 'pim',
  'shots', 'hits', 'blockedShots', 'toi',
  // Goalie fields:
  'saves', 'goalsAgainst', 'savePct', 'shotsAgainst',
];
```

---

### Issue 8: Make LiveDataContext Sport-Aware

**Files to modify:**
- `lib/LiveDataContext.tsx`

**Changes:**
- Read `activeSport` from `SportContext`
- Route polling to correct API endpoint based on sport (`/api/live-scores` vs `/api/nhl-live-scores`, etc.)
- Use sport-specific `DIFF_FIELDS` for the diff engine
- Reset all live state when sport changes (clear games, box scores, highlights)

**Approach:** The `LiveDataContext` already uses `/api/live-scores` and `/api/live-boxscore` strings. Make these dynamic based on the active sport config's `liveScoresEndpoint` and `liveBoxScoreEndpoint`.

---

### Issue 9: Make Game Data Hooks Sport-Aware

**Files to modify:**
- `hooks/useGameData.ts` - `useSchedule`, `useBoxScores`, `usePlayerIndex`

**Changes:**
- Accept sport config (or read from SportContext) to determine which database/tables to query
- Table names come from `SportConfig.database` + table structure
- NHL queries use the same SQL patterns but point to `nhl_box_scores.main.*` tables

---

### Issue 10: Make Main Page Sport-Aware

**Files to modify:**
- `app/page.tsx`

**Changes:**
- Read `activeSport` from SportContext
- Pass sport config to hooks and components
- Use sport-specific `BoxScore` component (NBA vs NHL)
- Team filter dropdown uses sport-specific team list
- Season filter uses sport-specific season utilities
- Game cards show period labels appropriate to sport (Q1/Q2/Q3/Q4/OT vs 1st/2nd/3rd/OT/SO)

---

### Issue 11: Make GameCard & PeriodScores Sport-Aware

**Files to modify:**
- `components/GameCard.tsx`
- `components/PeriodScores.tsx`

**Changes:**
- Use sport-specific period labels
- NBA: 4 quarters + OT periods
- NHL: 3 periods + OT + SO
- GameCard shows period-by-period scoring with correct labels

---

### Issue 12: Make SeasonFilter Sport-Aware

**Files to modify:**
- `components/SeasonFilter.tsx`

**Changes:**
- Team dropdown populated from sport-specific team list
- Season dropdown uses sport-specific formatting (2024-25 for both, similar format)
- Season type options: NBA has "Regular/Playoffs", NHL has "Regular/Playoffs" (same UI, different ID prefix logic)

---

### Issue 13: Make BoxScorePanel Sport-Aware

**Files to modify:**
- `components/BoxScorePanel.tsx`

**Changes:**
- Render `NHLBoxScore` when sport is NHL, `BoxScore` when NBA
- Pass sport-appropriate data to the selected component
- Live box score data mapped through sport-specific transformer

---

### Issue 14: NHL Data Ingestion Pipeline

**Files to create:**
- `scripts/ingest/nhl/` - NHL data ingestion scripts (mirrors existing NBA pipeline)

**This is needed to populate the `nhl_box_scores` MotherDuck database with historical data.**

- Fetch schedules from NHL API
- Fetch box scores for each game
- Transform and load into MotherDuck
- Same patterns as existing NBA ingestion in `scripts/ingest/`

---

## Implementation Order

1. **Issue 1** - Sport Context & Easter Egg Toggle (foundation)
2. **Issue 2** - NHL Teams & Season Utilities (data layer)
3. **Issue 3** - NHL Database & Table Constants (data layer)
4. **Issue 6** - NHL Type Definitions (types)
5. **Issue 4** - NHL Live Scores API Route (API)
6. **Issue 5** - NHL Live Box Score API Route (API)
7. **Issue 7** - NHL Box Score Component (UI)
8. **Issue 8** - Make LiveDataContext Sport-Aware (wiring)
9. **Issue 9** - Make Game Data Hooks Sport-Aware (wiring)
10. **Issue 10** - Make Main Page Sport-Aware (wiring)
11. **Issue 11** - GameCard & PeriodScores Sport-Aware (wiring)
12. **Issue 12** - SeasonFilter Sport-Aware (wiring)
13. **Issue 13** - BoxScorePanel Sport-Aware (wiring)
14. **Issue 14** - NHL Data Ingestion Pipeline (data)

Issues 1-7 can be worked on somewhat in parallel (1 is the foundation, 2-7 depend on 1 but not each other). Issues 8-13 are the wiring phase and can mostly be parallelized. Issue 14 is independent.

---

## Verification

1. **Unit tests**: Run existing Jest tests to ensure no NBA regressions
2. **Toggle test**: Click "NBA" in title -> verify title changes to "NHL Box Scores", page clears and reloads with NHL data
3. **Live mode test**: Enable live mode in NHL mode during game hours -> verify scores poll from NHL API
4. **Box score test**: Click an NHL game -> verify box score panel shows hockey stats (G/A/PTS/+/-/PIM/SOG/HIT/BLK) with separate goalie table
5. **Filter test**: Season filter, team filter, and player search work correctly in NHL mode
6. **Persistence test**: Refresh page -> sport selection persists via localStorage
7. **Dark mode test**: Both sports render correctly in dark mode
8. **Mobile test**: Responsive layout works for both sports

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `app/layout.tsx` | Root layout, title, providers |
| `app/page.tsx` | Main page (2100+ lines) |
| `lib/LiveDataContext.tsx` | Live polling & diff engine |
| `lib/MotherDuckContext.tsx` | DuckDB connection |
| `hooks/useGameData.ts` | Schedule/boxscore/player hooks |
| `constants/tables.ts` | MotherDuck table names + resolver |
| `lib/teams.ts` | NBA team data |
| `lib/seasonUtils.ts` | NBA season logic |
| `lib/periodUtils.ts` | Period label formatting |
| `pages/api/live-scores.ts` | NBA live scores API |
| `pages/api/live-boxscore.ts` | NBA live boxscore API |
| `components/BoxScore.tsx` | NBA box score table |
| `components/BoxScorePanel.tsx` | Box score side panel |
| `components/GameCard.tsx` | Game card display |
| `components/PeriodScores.tsx` | Period-by-period scores |
| `components/SeasonFilter.tsx` | Filter bar |
