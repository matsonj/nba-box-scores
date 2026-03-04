/**
 * Box score parser — converts raw NBA JSON box score data into BoxScoreRow[]
 * matching the v2 database schema.
 *
 * Ported from the original Python box_score_parser
 */

import type { BoxScoreRow } from '../types';

// ── Raw JSON shape from the NBA API ──────────────────────────────

/** A single player or team entity within a period's stats array. */
interface RawPlayerStats {
  EntityId: string;
  Name: string;
  Minutes?: string;
  Points?: number;
  Rebounds?: number;
  OffRebounds?: number;
  DefRebounds?: number;
  Assists?: number;
  Steals?: number;
  Blocks?: number;
  Turnovers?: number;
  FG2M?: number;
  FG2A?: number;
  FG3M?: number;
  FG3A?: number;
  FtPoints?: number;
  FTA?: number;
  [key: string]: unknown;
}

/** boxScore.stats has "Away" and "Home", each mapping period keys to player arrays. */
type TeamPeriodStats = Record<string, RawPlayerStats[]>;

interface RawTeamInfo {
  teamId: number;
  teamTricode: string;
}

interface RawGameData {
  game: {
    gameId: string;
    gameDateEst: string;
    homeTeam: RawTeamInfo;
    awayTeam: RawTeamInfo;
  };
  boxScore: {
    stats: {
      Away: TeamPeriodStats;
      Home: TeamPeriodStats;
    };
  };
}

// ── Helpers ──────────────────────────────────────────────────────

/** Convert a raw stat value to a number, defaulting to 0 for undefined/null. */
function num(v: number | undefined | null): number {
  return v ?? 0;
}

/**
 * Sum minutes strings in MM:SS format and return a summed MM:SS string.
 */
function sumMinutes(minutesArr: (string | null | undefined)[]): string {
  let totalSeconds = 0;
  for (const m of minutesArr) {
    if (!m) continue;
    const parts = m.split(':');
    if (parts.length !== 2) continue;
    totalSeconds += parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parse a single player's raw stats into a BoxScoreRow for a given period.
 * Returns null for team entities (EntityId "0").
 */
function parsePlayerPeriod(
  raw: RawPlayerStats,
  gameId: string,
  teamAbbr: string,
  period: string,
): BoxScoreRow | null {
  if (raw.EntityId === '0') return null; // skip team-level aggregates

  const offReb = num(raw.OffRebounds);
  const defReb = num(raw.DefRebounds);
  // Use the explicit Rebounds field if present; otherwise sum off+def
  const rebounds = raw.Rebounds != null ? num(raw.Rebounds) : offReb + defReb;

  return {
    game_id: gameId,
    team_abbreviation: teamAbbr,
    entity_id: raw.EntityId,
    player_name: raw.Name,
    period,
    minutes: raw.Minutes ?? null,
    points: num(raw.Points),
    rebounds,
    assists: num(raw.Assists),
    steals: num(raw.Steals),
    blocks: num(raw.Blocks),
    turnovers: num(raw.Turnovers),
    fg_made: num(raw.FG2M) + num(raw.FG3M),
    fg_attempted: num(raw.FG2A) + num(raw.FG3A),
    fg3_made: num(raw.FG3M),
    fg3_attempted: num(raw.FG3A),
    ft_made: num(raw.FtPoints),
    ft_attempted: num(raw.FTA),
    starter: null, // assigned later via heuristic
  };
}

/**
 * Assign the starter flag to FullGame rows.
 * Heuristic: for each team, the 5 players with the highest points are starters.
 * Ties are broken by the order they appear in the data.
 */
function assignStarters(fullGameRows: BoxScoreRow[]): void {
  const byTeam = new Map<string, BoxScoreRow[]>();
  for (const row of fullGameRows) {
    const list = byTeam.get(row.team_abbreviation);
    if (list) {
      list.push(row);
    } else {
      byTeam.set(row.team_abbreviation, [row]);
    }
  }

  for (const players of byTeam.values()) {
    // Sort descending by points (stable sort preserves original order for ties)
    const sorted = [...players].sort((a, b) => b.points - a.points);
    const starterIds = new Set(sorted.slice(0, 5).map(p => p.entity_id));
    for (const player of players) {
      player.starter = starterIds.has(player.entity_id) ? 1 : 0;
    }
  }
}

// ── Main entry point ─────────────────────────────────────────────

/**
 * Parse a raw NBA box score JSON object into an array of BoxScoreRows.
 *
 * Produces one row per player per period (quarters + OT periods),
 * plus a computed FullGame row that sums across all per-period rows.
 *
 * The FullGame data from the raw JSON is NOT used directly — instead it is
 * recomputed from the per-period data for consistency. This mirrors the
 * approach taken by the original Python parser's SQL view.
 */
export function parseBoxScore(data: unknown): BoxScoreRow[] {
  const raw = data as RawGameData;
  const gameId = raw.game.gameId;
  const homeAbbr = raw.game.homeTeam.teamTricode;
  const awayAbbr = raw.game.awayTeam.teamTricode;

  const teamSides: Array<{ key: 'Away' | 'Home'; abbr: string }> = [
    { key: 'Away', abbr: awayAbbr },
    { key: 'Home', abbr: homeAbbr },
  ];

  const periodRows: BoxScoreRow[] = [];

  for (const { key, abbr } of teamSides) {
    const teamStats = raw.boxScore.stats[key];
    for (const [period, players] of Object.entries(teamStats)) {
      // Skip FullGame from raw data — we'll compute our own
      if (period === 'FullGame') continue;

      for (const player of players) {
        const row = parsePlayerPeriod(player, gameId, abbr, period);
        if (row) periodRows.push(row);
      }
    }
  }

  // Compute FullGame rows by aggregating per-period data for each player
  const playerMap = new Map<string, BoxScoreRow[]>();
  for (const row of periodRows) {
    const key = `${row.team_abbreviation}:${row.entity_id}`;
    const list = playerMap.get(key);
    if (list) {
      list.push(row);
    } else {
      playerMap.set(key, [row]);
    }
  }

  const fullGameRows: BoxScoreRow[] = [];
  for (const [, periods] of playerMap) {
    const first = periods[0];
    const fullGame: BoxScoreRow = {
      game_id: first.game_id,
      team_abbreviation: first.team_abbreviation,
      entity_id: first.entity_id,
      player_name: first.player_name,
      period: 'FullGame',
      minutes: sumMinutes(periods.map(p => p.minutes)),
      points: periods.reduce((s, p) => s + p.points, 0),
      rebounds: periods.reduce((s, p) => s + p.rebounds, 0),
      assists: periods.reduce((s, p) => s + p.assists, 0),
      steals: periods.reduce((s, p) => s + p.steals, 0),
      blocks: periods.reduce((s, p) => s + p.blocks, 0),
      turnovers: periods.reduce((s, p) => s + p.turnovers, 0),
      fg_made: periods.reduce((s, p) => s + p.fg_made, 0),
      fg_attempted: periods.reduce((s, p) => s + p.fg_attempted, 0),
      fg3_made: periods.reduce((s, p) => s + p.fg3_made, 0),
      fg3_attempted: periods.reduce((s, p) => s + p.fg3_attempted, 0),
      ft_made: periods.reduce((s, p) => s + p.ft_made, 0),
      ft_attempted: periods.reduce((s, p) => s + p.ft_attempted, 0),
      starter: null,
    };
    fullGameRows.push(fullGame);
  }

  assignStarters(fullGameRows);

  // Also assign starter=null for per-period rows (consistent with schema)
  // The starter flag only applies to FullGame rows

  return [...periodRows, ...fullGameRows];
}
