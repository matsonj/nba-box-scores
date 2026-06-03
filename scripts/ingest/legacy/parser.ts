/**
 * Legacy parser — maps normalized Kaggle rows to the canonical ScheduleRow /
 * BoxScoreRow shapes used by the rest of the pipeline.
 *
 * Differences from the live parser (scripts/ingest/parse/box-score-parser.ts):
 *  - Produces FullGame rows ONLY (no per-quarter splits exist in the source).
 *  - Game IDs are prefixed with 'L' so they can never collide with the live
 *    '00…' IDs (box_scores/schedule use INSERT OR REPLACE).
 *  - 3-pointers before 1979-80 are a structural 0 (the rule didn't exist).
 *  - Steals/blocks (pre-1973-74) and turnovers (pre-1977-78) are regression-
 *    imputed at the season level and distributed to games by minutes; imputed
 *    fields are recorded in estimated_stats.
 *
 * Pure module — no I/O.
 */

import type { BoxScoreRow, ScheduleRow } from '../types';
import {
  THREE_POINT_CUTOFF,
  STEALS_BLOCKS_CUTOFF,
  TURNOVERS_CUTOFF,
  type NormalizedGameRow,
  type NormalizedPlayerRow,
  type PlayerSeasonAgg,
} from './types';
import {
  predictSeasonRate,
  distributeToGame,
  type ImputationModels,
  type ImputableStat,
} from './imputer';

export const LEGACY_ID_PREFIX = 'L';

// Fallbacks mirroring source-reader's COALESCE, for the rare row with missing bio.
const DEFAULT_HEIGHT_INCHES = 78;
const DEFAULT_AGE_YEARS = 27;

/** Prefix a source game id so it cannot collide with a live '00…' id. */
export function legacyGameId(sourceId: string): string {
  return `${LEGACY_ID_PREFIX}${sourceId}`;
}

// ── Team tricode normalization ────────────────────────────────────────────────
// The source may store a team as a full name, a nickname, or already a tricode.
// Nicknames are the most stable key across relocations (Lakers, Warriors, Kings…).
// NOTE: validate this map against the real dataset via source-reader.introspectSchema;
// unmapped teams fall back to a deterministic 3-letter code (and are still usable,
// just possibly not matching the modern tricode).
const NICKNAME_TO_TRICODE: Record<string, string> = {
  lakers: 'LAL', warriors: 'GSW', celtics: 'BOS', knicks: 'NYK', nationals: 'SYR',
  '76ers': 'PHI', sixers: 'PHI', pistons: 'DET', royals: 'CIN', kings: 'SAC',
  hawks: 'ATL', bullets: 'WAS', wizards: 'WAS', bulls: 'CHI', suns: 'PHX',
  bucks: 'MIL', rockets: 'HOU', spurs: 'SAS', nuggets: 'DEN', pacers: 'IND',
  nets: 'BKN', clippers: 'LAC', braves: 'BUF', trailblazers: 'POR', blazers: 'POR',
  jazz: 'UTA', mavericks: 'DAL', mavs: 'DAL', heat: 'MIA', hornets: 'CHA',
  timberwolves: 'MIN', wolves: 'MIN', magic: 'ORL', raptors: 'TOR', grizzlies: 'MEM',
  cavaliers: 'CLE', cavs: 'CLE', supersonics: 'SEA', sonics: 'SEA', thunder: 'OKC',
  pelicans: 'NOP', hawks_stl: 'ATL',
};

/** Best-effort tricode from a team string (full name, nickname, or code). */
export function normalizeTeamTricode(team: string): string {
  const raw = (team ?? '').trim();
  if (!raw) return 'UNK';
  // Already a tricode?
  if (/^[A-Z]{2,4}$/.test(raw)) return raw;

  const lastWord = raw.toLowerCase().replace(/[^a-z0-9 ]/g, '').split(/\s+/).pop() ?? '';
  if (NICKNAME_TO_TRICODE[lastWord]) return NICKNAME_TO_TRICODE[lastWord];

  // Fallback: first three letters of the last word, uppercased.
  return lastWord.slice(0, 3).toUpperCase().padEnd(3, 'X');
}

/** Deterministic positive 31-bit int from a string (for synthesizing team ids). */
function stableIntHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0) || 1;
}

/** Stable entity id: prefer the source person id; else a deterministic name hash. */
export function deriveEntityId(personId: string | null, playerName: string): string {
  if (personId != null && String(personId).trim() !== '') return String(personId);
  return `LP-${stableIntHash(playerName.trim().toLowerCase())}`;
}

/** Format decimal minutes as the M:SS string the schema/views expect. */
export function formatMinutes(decimalMinutes: number | null): string {
  if (decimalMinutes == null || decimalMinutes <= 0 || !isFinite(decimalMinutes)) return '0:00';
  const totalSeconds = Math.round(decimalMinutes * 60);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function n(v: number | null | undefined): number {
  return v ?? 0;
}

// ── Schedule ──────────────────────────────────────────────────────────────────

export function parseGames(rows: NormalizedGameRow[]): ScheduleRow[] {
  return rows.map((g) => {
    const homeAbbr = normalizeTeamTricode(g.home_team);
    const awayAbbr = normalizeTeamTricode(g.away_team);
    return {
      game_id: legacyGameId(g.source_game_id),
      game_date: g.game_date,
      home_team_id: g.home_team_id ?? stableIntHash(homeAbbr),
      away_team_id: g.away_team_id ?? stableIntHash(awayAbbr),
      home_team_abbreviation: homeAbbr,
      away_team_abbreviation: awayAbbr,
      home_team_score: n(g.home_score),
      away_team_score: n(g.away_score),
      game_status: 'Final',
      season_year: g.season_year,
      season_type: g.season_type,
    };
  });
}

// ── Box scores ──────────────────────────────────────────────────────────────

interface WorkingRow {
  row: BoxScoreRow;
  entityId: string;
  seasonYear: number;
  minutes: number | null;
  fouls: number | null;
  height: number | null;
  age: number | null;
  posGuard: number | null;
  posForward: number | null;
  posCenter: number | null;
  estimated: string[];
}

/**
 * Parse normalized player rows into FullGame BoxScoreRows, imputing untracked-era
 * steals/blocks/turnovers at the season level and distributing to games.
 */
export function parsePlayerRows(
  rows: NormalizedPlayerRow[],
  models: ImputationModels,
): BoxScoreRow[] {
  const working: WorkingRow[] = rows.map((r) => {
    const entityId = deriveEntityId(r.person_id, r.player_name);
    const seasonYear = r.season_year;
    const structuralNo3pt = seasonYear < THREE_POINT_CUTOFF;

    const box: BoxScoreRow = {
      game_id: legacyGameId(r.source_game_id),
      team_abbreviation: normalizeTeamTricode(r.team),
      entity_id: entityId,
      player_name: r.player_name,
      period: 'FullGame',
      minutes: formatMinutes(r.minutes),
      points: n(r.points),
      rebounds: n(r.rebounds),
      assists: n(r.assists),
      // Imputable stats: keep the real value when the era recorded it, else mark
      // for imputation by leaving null for now.
      steals: seasonYear >= STEALS_BLOCKS_CUTOFF ? n(r.steals) : null,
      blocks: seasonYear >= STEALS_BLOCKS_CUTOFF ? n(r.blocks) : null,
      turnovers: seasonYear >= TURNOVERS_CUTOFF ? n(r.turnovers) : null,
      fg_made: n(r.fg_made),
      fg_attempted: n(r.fg_attempted),
      fg3_made: structuralNo3pt ? 0 : n(r.fg3_made),
      fg3_attempted: structuralNo3pt ? 0 : n(r.fg3_attempted),
      ft_made: n(r.ft_made),
      ft_attempted: n(r.ft_attempted),
      starter: r.is_starter == null ? null : r.is_starter ? 1 : 0,
      estimated_stats: null,
    };

    return {
      row: box,
      entityId,
      seasonYear,
      minutes: r.minutes,
      fouls: r.fouls,
      height: r.height,
      age: r.age,
      posGuard: r.pos_guard,
      posForward: r.pos_forward,
      posCenter: r.pos_center,
      estimated: [],
    };
  });

  imputeMissing(working, models);
  assignStarters(working);
  finalizeEstimatedFlags(working);

  return working.map((w) => w.row);
}

/** Which targets need imputing for a given season (the stat wasn't tracked yet). */
function targetsForSeason(seasonYear: number): ImputableStat[] {
  const targets: ImputableStat[] = [];
  if (seasonYear < STEALS_BLOCKS_CUTOFF) targets.push('steals', 'blocks');
  if (seasonYear < TURNOVERS_CUTOFF) targets.push('turnovers');
  return targets;
}

/**
 * Fill untracked stats: aggregate each (player, season) that needs imputation,
 * predict the per-36 season rate, then distribute to each game by its minutes.
 */
function imputeMissing(working: WorkingRow[], models: ImputationModels): void {
  // Group rows that need any imputation by player-season.
  const groups = new Map<string, WorkingRow[]>();
  for (const w of working) {
    if (targetsForSeason(w.seasonYear).length === 0) continue;
    const key = `${w.entityId}:${w.seasonYear}`;
    const list = groups.get(key);
    if (list) list.push(w);
    else groups.set(key, [w]);
  }

  for (const group of groups.values()) {
    const seasonYear = group[0].seasonYear;
    const agg = buildSeasonAgg(group);

    for (const target of targetsForSeason(seasonYear)) {
      const rate = predictSeasonRate(models, target, agg);
      if (rate == null) continue; // no model — leave NULL (safety net)
      for (const w of group) {
        const value = distributeToGame(rate, w.minutes);
        if (value == null) continue; // missing minutes — leave NULL
        w.row[target] = value;
        w.estimated.push(target);
      }
    }
  }
}

/** Aggregate a player-season's recorded predictor totals for the imputer. */
function buildSeasonAgg(group: WorkingRow[]): PlayerSeasonAgg {
  const agg: PlayerSeasonAgg = {
    person_id: group[0].entityId,
    season_year: group[0].seasonYear,
    games: group.length,
    minutes: 0,
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    fg_attempted: 0,
    ft_attempted: 0,
    fouls: 0,
    height: 0,
    age: 0,
    pos_guard: 0,
    pos_forward: 0,
    pos_center: 0,
  };
  let heightSum = 0;
  let ageSum = 0;
  for (const w of group) {
    agg.minutes += w.minutes ?? 0;
    agg.points += w.row.points;
    agg.rebounds += w.row.rebounds;
    agg.assists += w.row.assists;
    agg.fg_attempted += w.row.fg_attempted;
    agg.ft_attempted += w.row.ft_attempted;
    agg.fouls += w.fouls ?? 0;
    heightSum += w.height ?? DEFAULT_HEIGHT_INCHES;
    ageSum += w.age ?? DEFAULT_AGE_YEARS;
    // Position flags are player-level constants; take the max across the group.
    agg.pos_guard = Math.max(agg.pos_guard, w.posGuard ?? 0);
    agg.pos_forward = Math.max(agg.pos_forward, w.posForward ?? 0);
    agg.pos_center = Math.max(agg.pos_center, w.posCenter ?? 0);
  }
  // height/age are player-level — use the season mean (height is ~constant).
  agg.height = heightSum / group.length;
  agg.age = ageSum / group.length;
  return agg;
}

/**
 * Resolve the starter flag per team per game. If the source flagged any starter
 * (via startingPosition), the remaining players are bench (0). If a game has no
 * starter info at all (common for very old games), fall back to the live parser's
 * top-5-scorers heuristic.
 */
function assignStarters(working: WorkingRow[]): void {
  const byGameTeam = new Map<string, WorkingRow[]>();
  for (const w of working) {
    const key = `${w.row.game_id}:${w.row.team_abbreviation}`;
    const list = byGameTeam.get(key);
    if (list) list.push(w);
    else byGameTeam.set(key, [w]);
  }

  for (const players of byGameTeam.values()) {
    const hasSourceStarters = players.some((w) => w.row.starter === 1);
    if (hasSourceStarters) {
      // Trust the source: anyone not flagged a starter is bench.
      for (const w of players) {
        if (w.row.starter !== 1) w.row.starter = 0;
      }
    } else {
      // No starter info — heuristic: top-5 scorers start.
      const sorted = [...players].sort((a, b) => b.row.points - a.row.points);
      const starterIds = new Set(sorted.slice(0, 5).map((w) => w.entityId));
      for (const w of players) {
        w.row.starter = starterIds.has(w.entityId) ? 1 : 0;
      }
    }
  }
}

function finalizeEstimatedFlags(working: WorkingRow[]): void {
  for (const w of working) {
    w.row.estimated_stats = w.estimated.length > 0 ? w.estimated.join(',') : null;
  }
}
