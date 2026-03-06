/**
 * NHL box score parser — converts raw NHL API box score data into
 * SkaterRow[] and GoalieRow[] matching the database schema.
 *
 * Key NHL API quirks handled:
 * - Player stats are grouped: playerByGameStats.{team}.forwards[], .defense[], .goalies[]
 * - Localized strings: access via .default (e.g., player.name.default)
 * - TOI format: "MM:SS" string (kept as-is)
 * - Faceoffs may come as "W/L" string or separate fields
 */

import type {
  NHLBoxScoreResponse,
  NHLSkaterStats,
  NHLGoalieStats,
  NHLTeamPlayerStats,
  SkaterRow,
  GoalieRow,
} from '../types';

// ── Helpers ──────────────────────────────────────────────────────

function num(v: number | undefined | null): number {
  return v ?? 0;
}

/**
 * Parse faceoff wins/losses from the NHL API.
 * The API sometimes provides a "W/L" string in the faceoffs field.
 */
function parseFaceoffs(skater: NHLSkaterStats): { wins: number; losses: number } {
  if (skater.faceoffs) {
    const parts = skater.faceoffs.split('/');
    if (parts.length === 2) {
      return {
        wins: parseInt(parts[0], 10) || 0,
        losses: parseInt(parts[1], 10) || 0,
      };
    }
  }
  // Fallback: no faceoff data available at individual level
  return { wins: 0, losses: 0 };
}

/**
 * Parse goalie saves/shots from the saveShotsAgainst field.
 * Format: "saves-shotsAgainst" (e.g., "28-31") or may be undefined.
 */
function parseSaveShotsAgainst(goalie: NHLGoalieStats): { saves: number; shotsAgainst: number } {
  if (goalie.saveShotsAgainst) {
    const parts = goalie.saveShotsAgainst.split('-');
    if (parts.length === 2) {
      return {
        saves: parseInt(parts[0], 10) || 0,
        shotsAgainst: parseInt(parts[1], 10) || 0,
      };
    }
  }
  return { saves: 0, shotsAgainst: 0 };
}

// ── Skater parsing ──────────────────────────────────────────────

function parseSkater(
  skater: NHLSkaterStats,
  gameId: string,
  teamAbbr: string,
  position: string,
): SkaterRow {
  const faceoffs = parseFaceoffs(skater);

  return {
    game_id: gameId,
    team_abbreviation: teamAbbr,
    entity_id: String(skater.playerId),
    player_name: skater.name.default,
    position,
    toi: skater.toi || null,
    goals: num(skater.goals),
    assists: num(skater.assists),
    points: num(skater.points),
    plus_minus: num(skater.plusMinus),
    pim: num(skater.pim),
    shots: num(skater.shots),
    hits: num(skater.hits),
    blocked_shots: num(skater.blockedShots),
    takeaways: num(skater.takeaways),
    giveaways: num(skater.giveaways),
    faceoff_wins: faceoffs.wins,
    faceoff_losses: faceoffs.losses,
    power_play_goals: num(skater.powerPlayGoals),
    starter: null, // assigned later
    period: 'FullGame',
  };
}

function parseTeamSkaters(
  teamStats: NHLTeamPlayerStats,
  gameId: string,
  teamAbbr: string,
): SkaterRow[] {
  const rows: SkaterRow[] = [];

  for (const fwd of teamStats.forwards) {
    rows.push(parseSkater(fwd, gameId, teamAbbr, 'F'));
  }
  for (const def of teamStats.defense) {
    rows.push(parseSkater(def, gameId, teamAbbr, 'D'));
  }

  return rows;
}

// ── Goalie parsing ──────────────────────────────────────────────

function parseGoalie(
  goalie: NHLGoalieStats,
  gameId: string,
  teamAbbr: string,
): GoalieRow {
  const { saves, shotsAgainst } = parseSaveShotsAgainst(goalie);

  return {
    game_id: gameId,
    team_abbreviation: teamAbbr,
    entity_id: String(goalie.playerId),
    player_name: goalie.name.default,
    toi: goalie.toi || null,
    saves,
    goals_against: num(goalie.goalsAgainst),
    save_pct: num(goalie.savePctg),
    shots_against: shotsAgainst,
    decision: goalie.decision ?? null,
    starter: goalie.starter != null ? (goalie.starter ? 1 : 0) : null,
    period: 'FullGame',
  };
}

function parseTeamGoalies(
  teamStats: NHLTeamPlayerStats,
  gameId: string,
  teamAbbr: string,
): GoalieRow[] {
  return teamStats.goalies.map(g => parseGoalie(g, gameId, teamAbbr));
}

// ── Starter assignment ──────────────────────────────────────────

/**
 * Assign starter flag to skaters.
 * NHL starters: for each team, the players who played the most (by TOI).
 * Forwards: top 12 by TOI are starters (typical lineup).
 * Actually, simpler: top 5 by TOI for each team (mirrors NBA approach).
 * But for hockey, we'll just flag all players as non-starters for now
 * since the concept doesn't map cleanly. Goalies have their own starter field.
 */
function assignSkaterStarters(rows: SkaterRow[]): void {
  const byTeam = new Map<string, SkaterRow[]>();
  for (const row of rows) {
    const list = byTeam.get(row.team_abbreviation);
    if (list) list.push(row);
    else byTeam.set(row.team_abbreviation, [row]);
  }

  for (const players of byTeam.values()) {
    // Sort by TOI descending to identify starters
    const sorted = [...players].sort((a, b) => {
      const toiA = parseTOItoSeconds(a.toi);
      const toiB = parseTOItoSeconds(b.toi);
      return toiB - toiA;
    });
    // In hockey, all dressed players play. Mark starter=1 for simplicity.
    for (const player of players) {
      player.starter = 1;
    }
    // Mark the bottom few (if any have 0 TOI) as non-starters
    for (const player of sorted) {
      if (parseTOItoSeconds(player.toi) === 0) {
        player.starter = 0;
      }
    }
  }
}

function parseTOItoSeconds(toi: string | null): number {
  if (!toi) return 0;
  const parts = toi.split(':');
  if (parts.length !== 2) return 0;
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

// ── Main entry point ─────────────────────────────────────────────

export interface ParsedBoxScore {
  skaters: SkaterRow[];
  goalies: GoalieRow[];
}

/**
 * Parse a raw NHL box score API response into SkaterRow[] and GoalieRow[].
 */
export function parseNHLBoxScore(data: NHLBoxScoreResponse): ParsedBoxScore {
  const gameId = String(data.id);
  const homeAbbr = data.homeTeam.abbrev;
  const awayAbbr = data.awayTeam.abbrev;

  // The player stats may be at the top level or nested under boxscore
  const playerStats = data.playerByGameStats ?? data.boxscore?.playerByGameStats;

  if (!playerStats) {
    return { skaters: [], goalies: [] };
  }

  const skaters: SkaterRow[] = [
    ...parseTeamSkaters(playerStats.awayTeam, gameId, awayAbbr),
    ...parseTeamSkaters(playerStats.homeTeam, gameId, homeAbbr),
  ];

  const goalies: GoalieRow[] = [
    ...parseTeamGoalies(playerStats.awayTeam, gameId, awayAbbr),
    ...parseTeamGoalies(playerStats.homeTeam, gameId, homeAbbr),
  ];

  assignSkaterStarters(skaters);

  return { skaters, goalies };
}
