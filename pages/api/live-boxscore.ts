import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { ESPN_NBA_BASE, toNbaTricode } from '@/lib/espn';
import type { LiveBoxScoreResponse, LiveBoxScoreTeam, LivePlayerStats } from '@/app/types/live';

interface CacheEntry {
  data: LiveBoxScoreResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;

// ESPN play types that aren't real plays (skipped when picking the last play)
const NON_PLAY_TYPES = new Set(['End Period', 'End Game', 'Start Period', 'Start Game']);

/** Splits an ESPN "made-attempted" stat like "3-7" into [3, 7]. */
function parseMadeAttempted(value: string | undefined): [number, number] {
  const [made, attempted] = String(value || '0-0').split('-');
  return [parseInt(made, 10) || 0, parseInt(attempted, 10) || 0];
}

function mapTeam(
  teamPlayers: Record<string, unknown> | undefined,
  competitor: Record<string, unknown> | undefined
): LiveBoxScoreTeam {
  const team = (teamPlayers?.team || competitor?.team) as Record<string, unknown> | undefined;
  const statGroup = ((teamPlayers?.statistics as Record<string, unknown>[]) || [])[0];
  const keys = (statGroup?.keys as string[]) || [];
  const athletes = (statGroup?.athletes as Record<string, unknown>[]) || [];

  const players: LivePlayerStats[] = athletes.map((a) => {
    const athlete = a.athlete as Record<string, unknown> | undefined;
    const stats = (a.stats as string[]) || [];
    const stat = (key: string) => stats[keys.indexOf(key)];
    const num = (key: string) => parseInt(stat(key) || '0', 10) || 0;
    const [fgm, fga] = parseMadeAttempted(stat('fieldGoalsMade-fieldGoalsAttempted'));
    const [tpm, tpa] = parseMadeAttempted(stat('threePointFieldGoalsMade-threePointFieldGoalsAttempted'));
    const [ftm, fta] = parseMadeAttempted(stat('freeThrowsMade-freeThrowsAttempted'));

    return {
      personId: String(athlete?.id || ''),
      playerName: String(athlete?.displayName || ''),
      // ESPN only reports whole minutes
      minutes: stat('minutes') || '0',
      points: num('points'),
      rebounds: num('rebounds'),
      assists: num('assists'),
      steals: num('steals'),
      blocks: num('blocks'),
      turnovers: num('turnovers'),
      fieldGoalsMade: fgm,
      fieldGoalsAttempted: fga,
      threePointersMade: tpm,
      threePointersAttempted: tpa,
      freeThrowsMade: ftm,
      freeThrowsAttempted: fta,
      plusMinus: num('plusMinus'),
      starter: Boolean(a.starter),
      // ESPN's `active` flag marks players currently on the court
      oncourt: Boolean(a.active),
      played: !a.didNotPlay && stats.length > 0,
    };
  });

  return {
    teamId: String(team?.id || ''),
    teamTricode: toNbaTricode(team?.abbreviation),
    score: Number(competitor?.score || 0),
    players,
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
    const response = await axios.get(`${ESPN_NBA_BASE}/summary`, {
      params: { event: gameId },
      timeout: 4000,
      headers: { 'Accept': 'application/json' },
    });

    const data = response.data;
    const competition = ((data?.header?.competitions as Record<string, unknown>[]) || [])[0];
    if (!competition) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const competitors = (competition.competitors as Record<string, unknown>[]) || [];
    const home = competitors.find((c) => c.homeAway === 'home');
    const away = competitors.find((c) => c.homeAway === 'away');
    const teamIdOf = (c: Record<string, unknown> | undefined) =>
      String((c?.team as Record<string, unknown> | undefined)?.id || '');

    const boxPlayers = (data.boxscore?.players as Record<string, unknown>[]) || [];
    const playersFor = (teamId: string) =>
      boxPlayers.find((p) => String((p.team as Record<string, unknown> | undefined)?.id) === teamId);

    // Walk backwards to find the last real play (skip period/game markers)
    const plays = (data.plays as Record<string, unknown>[]) || [];
    let lastPlay: string | null = null;
    for (let i = plays.length - 1; i >= 0; i--) {
      const text = plays[i].text as string | undefined;
      const playType = (plays[i].type as Record<string, unknown> | undefined)?.text as string | undefined;
      if (text && !NON_PLAY_TYPES.has(playType || '')) {
        lastPlay = text;
        break;
      }
    }

    const statusType = (competition.status as Record<string, unknown> | undefined)?.type as
      | Record<string, unknown>
      | undefined;

    const result: LiveBoxScoreResponse = {
      gameId,
      gameStatus: String(statusType?.shortDetail || ''),
      lastPlay,
      homeTeam: mapTeam(playersFor(teamIdOf(home)), home),
      awayTeam: mapTeam(playersFor(teamIdOf(away)), away),
    };

    cache.set(gameId, { data: result, timestamp: now });

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Live boxscore API error:', error);

    if (cached) {
      return res.status(200).json(cached.data);
    }

    return res.status(500).json({ error: 'Failed to fetch live box score' });
  }
}
