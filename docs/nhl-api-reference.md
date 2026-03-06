# NHL API Reference (api-web.nhle.com)

> Documented 2026-03-05 via live API exploration. No authentication required. Base URL: `https://api-web.nhle.com/v1`

---

## Table of Contents

1. [Scoreboard](#1-scoreboard)
2. [Schedule (by date)](#2-schedule-by-date)
3. [Box Score](#3-box-score)
4. [Play-by-Play](#4-play-by-play)
5. [Schedule Calendar](#5-schedule-calendar)
6. [Common Patterns](#6-common-patterns)

---

## 1. Scoreboard

### Endpoints

| URL | Description |
|-----|-------------|
| `GET /v1/score/now` | Today's scoreboard (redirects via 307 to `/v1/score/{today}`) |
| `GET /v1/score/{date}` | Scoreboard for a specific date (YYYY-MM-DD) |

**Note:** `/v1/score/now` returns a 307 redirect. Use `-L` with curl or follow redirects in your HTTP client.

### Top-Level Response

```
{
  prevDate: string              // "2025-01-14"
  currentDate: string           // "2025-01-15"
  nextDate: string              // "2025-01-16"
  gameWeek: GameWeekEntry[]     // 7 entries (Sun-Sat)
  oddsPartners: OddsPartner[]   // betting partner metadata
  games: Game[]                 // all games for currentDate
}
```

### `gameWeek` entry (summary only, no game details)

```
{
  date: string          // "2025-01-12"
  dayAbbrev: string     // "SUN"
  numberOfGames: number // 5
}
```

### `games[]` (Scoreboard Game Object)

```
{
  id: number                    // 2024020705 (game ID)
  season: number                // 20242025
  gameType: number              // 2 (regular season)
  gameDate: string              // "2025-01-15"
  venue: { default: string }
  startTimeUTC: string          // "2025-01-15T23:00:00Z"
  easternUTCOffset: string      // "-05:00"
  venueUTCOffset: string        // "-05:00"
  tvBroadcasts: TvBroadcast[]
  gameState: string             // "FUT" | "LIVE" | "FINAL" | "OFF"
  gameScheduleState: string     // "OK"
  awayTeam: ScoreboardTeam
  homeTeam: ScoreboardTeam
  gameCenterLink: string        // "/gamecenter/car-vs-buf/2025/01/15/2024020705"
  clock: Clock
  neutralSite: boolean
  venueTimezone: string         // "America/New_York"
  period: number                // 3 (current/final period number)
  periodDescriptor: PeriodDescriptor
  gameOutcome: GameOutcome      // present when FINAL/OFF
  goals: GoalSummary[]          // scoring plays with player info

  // Video recap links (present for completed games)
  threeMinRecap?: string
  threeMinRecapFr?: string
  condensedGame?: string
  condensedGameFr?: string
}
```

### ScoreboardTeam (within scoreboard games)

```
// For LIVE/FINAL/OFF games:
{
  id: number              // 12
  name: { default: string }  // "Hurricanes"
  abbrev: string          // "CAR"
  score: number           // 2
  sog: number             // 37 (shots on goal)
  logo: string            // SVG URL
}

// For FUT games (no score/sog, has record instead):
{
  id: number
  name: { default: string }
  abbrev: string
  record: string          // e.g. "30-20-5"
  logo: string
}
```

### GoalSummary (scoreboard `goals[]`)

```
{
  period: number
  periodDescriptor: PeriodDescriptor
  timeInPeriod: string          // "00:43"
  playerId: number              // 8480802
  name: { default: string }     // "R. McLeod"
  firstName: { default: string }
  lastName: { default: string }
  goalModifier: string          // "none" | "awarded-empty-net"
  assists: [
    {
      playerId: number
      name: { default: string }
      assistsToDate: number
    }
  ]
  mugshot: string               // player headshot PNG URL
  teamAbbrev: string            // "BUF"
  goalsToDate: number           // season total after this goal
  awayScore: number             // running score after this goal
  homeScore: number
  strength: string              // "ev" | "pp" | "sh"
  highlightClip: number         // video clip ID
  highlightClipSharingUrl: string
}
```

### FUT-only fields on scoreboard games

```
{
  ticketsLink: string           // Ticketmaster URL
  ticketsLinkFr: string
  teamLeaders: TeamLeader[]     // list of 6 (3 per team)
}
```

---

## 2. Schedule (by date)

### Endpoint

`GET /v1/schedule/{date}`

### Top-Level Response

```
{
  nextStartDate: string         // "2025-01-22"
  previousStartDate: string     // "2025-01-08"
  gameWeek: ScheduleWeekEntry[]
}
```

### `gameWeek[]` (Schedule Week Entry)

```
{
  date: string              // "2025-01-15"
  dayAbbrev: string         // "WED"
  numberOfGames: number     // 2
  datePromo: DatePromo[]    // promotional info
  games: ScheduleGame[]
}
```

### ScheduleGame

Similar to scoreboard games but with additional team detail fields:

```
{
  id: number
  season: number
  gameType: number
  venue: { default: string }
  neutralSite: boolean
  startTimeUTC: string
  easternUTCOffset: string
  venueUTCOffset: string
  venueTimezone: string
  gameState: string
  gameScheduleState: string
  tvBroadcasts: TvBroadcast[]
  awayTeam: {
    id: number
    commonName: { default: string }         // "Hurricanes"
    placeName: { default: string, fr?: string }  // "Carolina"
    placeNameWithPreposition: { default: string, fr?: string }
    abbrev: string                          // "CAR"
    logo: string
    darkLogo: string
    awaySplitSquad: boolean
    score: number                           // present for completed games
  }
  homeTeam: { ... same structure, homeSplitSquad instead of awaySplitSquad }
  periodDescriptor: PeriodDescriptor
  gameOutcome?: GameOutcome
  winningGoalie?: { playerId, firstInitial, lastName }
  winningGoalScorer?: { playerId, firstInitial, lastName }
  gameCenterLink: string
}
```

---

## 3. Box Score

### Endpoint

`GET /v1/gamecenter/{gameId}/boxscore`

### Top-Level Response

```
{
  id: number                    // 2024020705
  season: number                // 20242025
  gameType: number              // 2
  limitedScoring: boolean       // false
  gameDate: string              // "2025-01-15"
  venue: { default: string }
  venueLocation: { default: string }
  startTimeUTC: string
  easternUTCOffset: string
  venueUTCOffset: string
  tvBroadcasts: TvBroadcast[]
  gameState: string             // "OFF" | "LIVE" | "FINAL"
  gameScheduleState: string     // "OK"
  periodDescriptor: PeriodDescriptor
  regPeriods: number            // 3
  awayTeam: BoxScoreTeam
  homeTeam: BoxScoreTeam
  clock: Clock
  playerByGameStats: PlayerByGameStats
  summary: {}                   // Always empty object (unused)
  gameOutcome?: GameOutcome     // present for completed games
}
```

### BoxScoreTeam

```
{
  id: number
  commonName: { default: string }
  abbrev: string            // "CAR"
  score: number             // 2
  sog: number               // 37 (shots on goal)
  logo: string
  darkLogo: string
  placeName: { default: string, fr?: string }
  placeNameWithPreposition: { default: string, fr?: string }
}
```

### PlayerByGameStats

Players are grouped by position category within each team:

```
{
  awayTeam: {
    forwards: SkaterStats[]
    defense: SkaterStats[]
    goalies: GoalieStats[]
  }
  homeTeam: {
    forwards: SkaterStats[]
    defense: SkaterStats[]
    goalies: GoalieStats[]
  }
}
```

### SkaterStats (forwards and defense)

```
{
  playerId: number              // 8473533
  sweaterNumber: number         // 11
  name: { default: string }     // "J. Staal" (may have locale variants)
  position: string              // "C" | "L" | "R" | "D"
  goals: number                 // 0
  assists: number               // 0
  points: number                // 0
  plusMinus: number              // -1
  pim: number                   // 0 (penalty minutes)
  hits: number                  // 3
  powerPlayGoals: number        // 0
  sog: number                   // 0 (shots on goal)
  faceoffWinningPctg: number    // 0.352941 (decimal, not percentage)
  toi: string                   // "11:36" (MM:SS format)
  blockedShots: number          // 0
  shifts: number                // 18
  giveaways: number             // 0
  takeaways: number             // 0
}
```

### GoalieStats

```
{
  playerId: number
  sweaterNumber: number
  name: { default: string }
  position: string                      // "G"
  evenStrengthShotsAgainst: string      // "13/16" (saves/shots format)
  powerPlayShotsAgainst: string         // "4/4"
  shorthandedShotsAgainst: string       // "4/4"
  saveShotsAgainst: string              // "21/24" (total saves/total shots)
  savePctg?: number                     // 0.875 (absent if 0 shots faced)
  evenStrengthGoalsAgainst: number      // 3
  powerPlayGoalsAgainst: number         // 0
  shorthandedGoalsAgainst: number       // 0
  pim: number                           // 0
  goalsAgainst: number                  // 3
  toi: string                           // "57:43" (MM:SS)
  starter: boolean                      // true
  decision?: string                     // "W" | "L" (only on starter/decisive goalie)
  shotsAgainst: number                  // 24
  saves: number                         // 21
}
```

**Note:** The `summary` field is always an empty object `{}` regardless of game state (LIVE, FINAL, OFF). Period-by-period scoring is NOT available in the box score endpoint. Use the scoreboard `goals[]` array or play-by-play to reconstruct period scoring.

---

## 4. Play-by-Play

### Endpoint

`GET /v1/gamecenter/{gameId}/play-by-play`

### Top-Level Response

```
{
  id: number
  season: number
  gameType: number
  limitedScoring: boolean
  gameDate: string
  venue: { default: string }
  venueLocation: { default: string }
  startTimeUTC: string
  easternUTCOffset: string
  venueUTCOffset: string
  tvBroadcasts: TvBroadcast[]
  gameState: string
  gameScheduleState: string
  periodDescriptor: PeriodDescriptor
  awayTeam: BoxScoreTeam        // same structure as box score
  homeTeam: BoxScoreTeam
  shootoutInUse: boolean        // true
  otInUse: boolean              // true
  clock: Clock
  displayPeriod: number         // 1
  maxPeriods: number            // 5
  regPeriods: number            // 3
  gameOutcome?: GameOutcome
  plays: Play[]                 // all events (333 plays in sample game)
  rosterSpots: RosterSpot[]     // all players from both teams (40 in sample)
  summary: {}                   // always empty
}
```

### Play Event

```
{
  eventId: number
  periodDescriptor: PeriodDescriptor
  timeInPeriod: string              // "00:43" (MM:SS)
  timeRemaining: string             // "19:17" (MM:SS)
  situationCode: string             // "1551" (see below)
  homeTeamDefendingSide: string     // "left" | "right"
  typeCode: number                  // event type numeric code
  typeDescKey: string               // event type string key
  sortOrder: number                 // ordering within game
  details?: object                  // event-specific details (see below)
  pptReplayUrl?: string             // replay sprite URL (goals only)
}
```

### Event Types

| typeCode | typeDescKey | Description |
|----------|-------------|-------------|
| 502 | `faceoff` | Faceoff |
| 503 | `hit` | Hit/body check |
| 504 | `giveaway` | Giveaway |
| 505 | `goal` | Goal scored |
| 506 | `shot-on-goal` | Shot on goal (saved) |
| 507 | `missed-shot` | Missed shot (wide/high) |
| 508 | `blocked-shot` | Blocked shot |
| 509 | `penalty` | Penalty assessed |
| 516 | `stoppage` | Play stoppage |
| 520 | `period-start` | Period begins |
| 521 | `period-end` | Period ends |
| 524 | `game-end` | Game over |
| 525 | `takeaway` | Takeaway |
| 535 | `delayed-penalty` | Delayed penalty signal |

### Event Details by Type

**Goal (typeCode 505)**
```
{
  xCoord: number
  yCoord: number
  zoneCode: string                  // "O" (offensive)
  shotType: string                  // "wrist" | "snap" | "slap" | "backhand" | etc.
  scoringPlayerId: number
  scoringPlayerTotal: number        // season total
  assist1PlayerId?: number
  assist1PlayerTotal?: number
  assist2PlayerId?: number
  assist2PlayerTotal?: number
  eventOwnerTeamId: number
  goalieInNetId: number
  awayScore: number                 // running score after goal
  homeScore: number
  highlightClipSharingUrl: string
  highlightClip: number
  discreteClip: number
}
```

**Shot on Goal (typeCode 506)**
```
{
  xCoord: number
  yCoord: number
  zoneCode: string                  // "O" | "D"
  shotType: string                  // "wrist" | "snap" | etc.
  shootingPlayerId: number
  goalieInNetId: number
  eventOwnerTeamId: number
  awaySOG: number                   // running shot count
  homeSOG: number
}
```

**Faceoff (typeCode 502)**
```
{
  eventOwnerTeamId: number          // winning team
  losingPlayerId: number
  winningPlayerId: number
  xCoord: number
  yCoord: number
  zoneCode: string                  // "N" | "O" | "D"
}
```

**Penalty (typeCode 509)**
```
{
  xCoord: number
  yCoord: number
  zoneCode: string
  typeCode: string                  // "MIN" | "MAJ" | "MIS" (minor/major/misconduct)
  descKey: string                   // "kneeing" | "tripping" | "hooking" | etc.
  duration: number                  // 2, 4, 5, 10 (minutes)
  committedByPlayerId: number
  drawnByPlayerId: number
  eventOwnerTeamId: number
}
```

**Hit (typeCode 503)**
```
{
  xCoord: number
  yCoord: number
  zoneCode: string
  eventOwnerTeamId: number
  hittingPlayerId: number
  hitteePlayerId: number
}
```

**Blocked Shot (typeCode 508)**
```
{
  xCoord: number
  yCoord: number
  zoneCode: string
  blockingPlayerId: number
  shootingPlayerId: number
  eventOwnerTeamId: number
  reason: string                    // "blocked"
}
```

**Stoppage (typeCode 516)**
```
{
  reason: string                    // "icing" | "puck-frozen" | "offside" | etc.
}
```

**Giveaway/Takeaway (typeCode 504/525)**
```
{
  xCoord: number
  yCoord: number
  zoneCode: string
  eventOwnerTeamId: number
  playerId: number
}
```

**Period Start/End, Game End (520/521/524)**: No `details` field.

### Extracting "Last Play"

The last element in the `plays[]` array is the most recent event. For a completed game, this is always `typeDescKey: "game-end"`. For a live game, it is the most recent play event. Sort by `sortOrder` if needed (plays are already ordered).

### RosterSpot

```
{
  teamId: number
  playerId: number
  firstName: { default: string }
  lastName: { default: string }
  sweaterNumber: number
  positionCode: string          // "C" | "L" | "R" | "D" | "G"
  headshot: string              // PNG URL
}
```

### Situation Code Format

The `situationCode` is a 4-character string encoding the on-ice situation:

```
Format: "{awayGoalie}{awaySkaters}{homeSkaters}{homeGoalie}"

Examples:
  "1551" = away goalie in (1), away 5 skaters, home 5 skaters, home goalie in (1) -> 5v5
  "1451" = away goalie in (1), away 4 skaters, home 5 skaters, home goalie in (1) -> away shorthanded (4v5)
  "1541" = 5v4 (home shorthanded)
  "0651" = away goalie pulled (0), away 6 skaters, home 5 skaters, home goalie in (1) -> extra attacker
```

- Position 1: away goalie (1=in net, 0=pulled)
- Position 2: away skater count
- Position 3: home skater count
- Position 4: home goalie (1=in net, 0=pulled)

---

## 5. Schedule Calendar

### Endpoint

`GET /v1/schedule-calendar/{date}`

Returns team list and date range metadata. Does NOT return individual game data.

### Response

```
{
  startDate: string             // "2024-10-01"
  endDate: string               // "2024-10-07"
  nextStartDate: string         // "2024-10-08"
  previousStartDate: string     // "2024-09-24"
  teams: Team[]                 // all 32 NHL teams
}
```

### Team

```
{
  id: number                    // 1
  seasonId: number              // 20242025
  commonName: { default: string }   // "Devils"
  abbrev: string                // "NJD"
  name: { default: string, fr?: string }  // "New Jersey Devils"
  placeNameWithPreposition: { default: string, fr?: string }
  placeName: { default: string }
  logo: string                  // light SVG
  darkLogo: string              // dark SVG
  french: boolean               // true for Canadiens
}
```

---

## 6. Common Patterns

### Game ID Format

- 10-digit integer: `SSSSTTTNNN`
  - `SSSS` = season start year (e.g., `2024` for 2024-25 season)
  - `TTT` = game type prefix: `020` = regular season, `030` = playoffs, `010` = preseason
  - `NNN` = sequential game number within type (e.g., `0705`)
- Examples: `2024020705` (regular season game 705, 2024-25), `2025020983` (regular season game 983, 2025-26)

### Game Type Values

| gameType | Description |
|----------|-------------|
| 1 | Preseason |
| 2 | Regular Season |
| 3 | Playoffs |

### Game State Values

| gameState | Description |
|-----------|-------------|
| `FUT` | Future/scheduled (not yet started) |
| `LIVE` | Currently in progress |
| `FINAL` | Just completed (final score posted) |
| `OFF` | Official/completed (post-game processing done) |

Typical lifecycle: `FUT` -> `LIVE` -> `FINAL` -> `OFF`

There may also be `PRE` (pregame) and `CRIT` (critical/close game) states based on other NHL API documentation, but these were not observed during testing.

### Game Schedule State

- `OK` = game is scheduled normally
- Other values may include `PPD` (postponed) or `CNCL` (cancelled)

### Game Outcome

```
{
  lastPeriodType: string        // "REG" | "OT" | "SO"
  otPeriods?: number            // present for OT games (e.g., 1)
}
```

- `REG` = decided in regulation
- `OT` = decided in overtime (`otPeriods` indicates how many OT periods)
- `SO` = decided in shootout

### Period Descriptor

```
{
  number: number                // 1, 2, 3, 4 (OT), 5 (SO)
  periodType: string            // "REG" | "OT" | "SO"
  maxRegulationPeriods: number  // 3
}
```

### Clock

```
{
  timeRemaining: string         // "16:57" (MM:SS)
  secondsRemaining: number      // 1017
  running: boolean              // true during active play
  inIntermission: boolean       // true during period breaks
}
```

### TV Broadcast

```
{
  id: number
  market: string            // "N" (national) | "H" (home) | "A" (away)
  countryCode: string       // "US" | "CA"
  network: string           // "TNT" | "ESPN" | "TSN4" | etc.
  sequenceNumber: number
}
```

### Localized String Fields

Many string fields use an object with locale keys instead of a plain string:

```
{
  default: string           // always present (English)
  fr?: string               // French (common for Canadian teams)
  cs?: string               // Czech
  sk?: string               // Slovak
  fi?: string               // Finnish
}
```

Access the value as `field.default` for English.

### Period-by-Period Scoring

The API does NOT provide a pre-aggregated linescore / period-by-period scoring breakdown. To reconstruct it:

1. **From scoreboard `goals[]`**: Each goal has `period`, `awayScore`, `homeScore` (running totals). Group by period and take the max scores per period to derive period scoring.
2. **From play-by-play**: Filter `plays[]` for `typeDescKey === "goal"` events. Each has `details.awayScore` and `details.homeScore` as running totals, plus `periodDescriptor.number`.

### Authentication

No authentication headers or API keys are required. All endpoints are publicly accessible.

### Rate Limiting

No explicit rate limiting headers were observed. However, responsible usage is recommended.

### CORS

These endpoints are designed for server-to-server or native app use. CORS headers were not tested but the API is commonly used from browser applications.
