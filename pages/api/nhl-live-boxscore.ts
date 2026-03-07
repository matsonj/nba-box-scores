import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface NHLSkaterStats {
  personId: string;
  playerName: string;
  position: 'F' | 'D';
  toi: string;
  goals: number;
  assists: number;
  points: number;
  plusMinus: number;
  pim: number;
  shots: number;
  hits: number;
  blockedShots: number;
  faceoffWins: number;
  faceoffLosses: number;
}

interface NHLGoalieStats {
  personId: string;
  playerName: string;
  position: 'G';
  toi: string;
  saves: number;
  shotsAgainst: number;
  goalsAgainst: number;
  savePctg: number;
  decision: string;
  starter: boolean;
}

interface NHLBoxScoreTeam {
  teamId: string;
  teamAbbrev: string;
  score: number;
  skaters: NHLSkaterStats[];
  goalies: NHLGoalieStats[];
}

interface NHLBoxScoreResponse {
  gameId: string;
  gameStatus: string;
  lastPlay: string;
  homeTeam: NHLBoxScoreTeam;
  awayTeam: NHLBoxScoreTeam;
}

interface CacheEntry {
  data: NHLBoxScoreResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;

function mapSkater(player: Record<string, unknown>, position: 'F' | 'D'): NHLSkaterStats {
  const name = player.name as Record<string, unknown> | undefined;
  const faceoffs = String(player.faceoffs || '');
  let faceoffWins = 0;
  let faceoffLosses = 0;

  // Faceoffs may come as "X/Y" string
  if (faceoffs.includes('/')) {
    const parts = faceoffs.split('/');
    faceoffWins = parseInt(parts[0], 10) || 0;
    const total = parseInt(parts[1], 10) || 0;
    faceoffLosses = total - faceoffWins;
  } else if (player.faceoffWinningPctg !== undefined) {
    // Some responses have faceoffWinningPctg and faceoffs as a total count
    const totalFaceoffs = Number(player.faceoffs || 0);
    const pctg = Number(player.faceoffWinningPctg || 0);
    faceoffWins = Math.round(totalFaceoffs * pctg);
    faceoffLosses = totalFaceoffs - faceoffWins;
  }

  return {
    personId: String(player.playerId || ''),
    playerName: String(name?.default || ''),
    position,
    toi: String(player.toi || '0:00'),
    goals: Number(player.goals || 0),
    assists: Number(player.assists || 0),
    points: Number(player.points || 0),
    plusMinus: Number(player.plusMinus || 0),
    pim: Number(player.pim || 0),
    shots: Number(player.shots || 0),
    hits: Number(player.hits || 0),
    blockedShots: Number(player.blockedShots || 0),
    faceoffWins,
    faceoffLosses,
  };
}

function mapGoalie(player: Record<string, unknown>): NHLGoalieStats {
  const name = player.name as Record<string, unknown> | undefined;

  return {
    personId: String(player.playerId || ''),
    playerName: String(name?.default || ''),
    position: 'G',
    toi: String(player.toi || '0:00'),
    saves: Number(player.saves ?? 0),
    shotsAgainst: Number(player.shotsAgainst ?? 0),
    goalsAgainst: Number(player.goalsAgainst ?? 0),
    savePctg: Number(player.savePctg ?? 0),
    decision: String(player.decision ?? ''),
    starter: Boolean(player.starter ?? false),
  };
}

function mapGameStatus(game: Record<string, unknown>): string {
  const gameState = String(game.gameState || '');
  const clock = game.clock as Record<string, unknown> | undefined;
  const period = Number(game.period || 0);
  const timeRemaining = String(clock?.timeRemaining || '');

  switch (gameState) {
    case 'FUT':
    case 'PRE':
      return 'Scheduled';
    case 'LIVE':
    case 'CRIT': {
      const periodLabel = period > 3
        ? (period === 4 ? 'OT' : `OT${period - 3}`)
        : period > 0
          ? `P${period}`
          : 'Pre-game';
      return timeRemaining ? `${periodLabel} ${timeRemaining}` : periodLabel;
    }
    case 'FINAL':
    case 'OFF':
      return period > 3 ? 'Final/OT' : 'Final';
    default:
      return gameState || 'Unknown';
  }
}

function mapTeam(
  teamData: Record<string, unknown>,
  playersByGameStats: Record<string, unknown>,
  side: 'homeTeam' | 'awayTeam'
): NHLBoxScoreTeam {
  const teamStats = playersByGameStats[side] as Record<string, unknown> | undefined;

  const forwards = (teamStats?.forwards as Record<string, unknown>[]) || [];
  const defense = (teamStats?.defense as Record<string, unknown>[]) || [];
  const goalies = (teamStats?.goalies as Record<string, unknown>[]) || [];

  const skaters: NHLSkaterStats[] = [
    ...forwards.map((p) => mapSkater(p, 'F')),
    ...defense.map((p) => mapSkater(p, 'D')),
  ];

  const mappedGoalies: NHLGoalieStats[] = goalies.map((p) => mapGoalie(p));

  return {
    teamId: String(teamData?.id || ''),
    teamAbbrev: String(teamData?.abbrev || ''),
    score: Number(teamData?.score ?? 0),
    skaters,
    goalies: mappedGoalies,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const gameId = req.query.gameId;
  if (!gameId || typeof gameId !== 'string' || !/^\d+$/.test(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId parameter' });
  }

  const now = Date.now();
  const cached = cache.get(gameId);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const response = await axios.get(
      `https://api-web.nhle.com/v1/gamecenter/${gameId}/boxscore`,
      {
        timeout: 4000,
        headers: { 'Accept': 'application/json' },
      }
    );

    const data = response.data;
    if (!data) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const playersByGameStats = (data.playerByGameStats || {}) as Record<string, unknown>;
    const homeTeamData = (data.homeTeam || {}) as Record<string, unknown>;
    const awayTeamData = (data.awayTeam || {}) as Record<string, unknown>;

    // Note: the boxscore endpoint's `summary` is always empty.
    // Last play info comes from the scoreboard goals[] via LiveScoreGame.lastPlay instead.
    const lastPlay = '';

    const result: NHLBoxScoreResponse = {
      gameId,
      gameStatus: mapGameStatus(data),
      lastPlay,
      homeTeam: mapTeam(homeTeamData, playersByGameStats, 'homeTeam'),
      awayTeam: mapTeam(awayTeamData, playersByGameStats, 'awayTeam'),
    };

    cache.set(gameId, { data: result, timestamp: now });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(result);
  } catch (error) {
    console.error('NHL live boxscore API error:', error);

    if (cached) {
      return res.status(200).json(cached.data);
    }

    return res.status(500).json({ error: 'Failed to fetch NHL live box score' });
  }
}
