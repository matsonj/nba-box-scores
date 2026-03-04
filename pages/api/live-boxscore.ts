import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import type { LiveBoxScoreResponse, LivePlayerStats } from '@/app/types/live';

interface CacheEntry {
  data: LiveBoxScoreResponse;
  timestamp: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5000;

function parseMinutes(ptMinutes: string): string {
  if (!ptMinutes) return '0:00';
  // Format: "PT36M12.00S" or "PT05M30.00S"
  const match = ptMinutes.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return '0:00';
  const minutes = parseInt(match[1], 10);
  const seconds = Math.floor(parseFloat(match[2]));
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  if (!gameId || typeof gameId !== 'string' || !/^\d{10}$/.test(gameId)) {
    return res.status(400).json({ error: 'Invalid gameId parameter' });
  }

  const now = Date.now();
  const cached = cache.get(gameId);

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return res.status(200).json(cached.data);
  }

  try {
    const response = await axios.get(
      `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${gameId}.json`,
      {
        timeout: 4000,
        headers: { 'Accept': 'application/json' },
      }
    );

    const game = response.data?.game;
    if (!game) {
      return res.status(404).json({ error: 'Game not found' });
    }

    const mapPlayers = (players: Record<string, unknown>[]): LivePlayerStats[] =>
      (players || []).map((p) => {
        const stats = p.statistics as Record<string, unknown> | undefined;
        return {
          personId: String(p.personId || ''),
          playerName: `${p.firstName || ''} ${p.familyName || ''}`.trim(),
          minutes: parseMinutes(String(stats?.minutes || '')),
          points: Number(stats?.points || 0),
          rebounds: Number(stats?.reboundsTotal || 0),
          assists: Number(stats?.assists || 0),
          steals: Number(stats?.steals || 0),
          blocks: Number(stats?.blocks || 0),
          turnovers: Number(stats?.turnovers || 0),
          fieldGoalsMade: Number(stats?.fieldGoalsMade || 0),
          fieldGoalsAttempted: Number(stats?.fieldGoalsAttempted || 0),
          threePointersMade: Number(stats?.threePointersMade || 0),
          threePointersAttempted: Number(stats?.threePointersAttempted || 0),
          freeThrowsMade: Number(stats?.freeThrowsMade || 0),
          freeThrowsAttempted: Number(stats?.freeThrowsAttempted || 0),
          plusMinus: Number(stats?.plusMinusPoints || 0),
          starter: p.starter === '1' || p.starter === 1,
          oncourt: p.oncourt === '1' || p.oncourt === 1,
          played: p.played === '1' || p.played === 1,
        };
      });

    // Fetch last play from play-by-play endpoint (best effort)
    let lastPlay: string | null = null;
    try {
      const pbpResponse = await axios.get(
        `https://cdn.nba.com/static/json/liveData/playbyplay/playbyplay_${gameId}.json`,
        { timeout: 3000, headers: { 'Accept': 'application/json' } }
      );
      const actions = pbpResponse.data?.game?.actions as Record<string, unknown>[] | undefined;
      if (actions && actions.length > 0) {
        // Walk backwards to find the last action with a description (skip "Period End" etc.)
        for (let i = actions.length - 1; i >= 0; i--) {
          const desc = actions[i].description as string | undefined;
          const actionType = actions[i].actionType as string | undefined;
          if (desc && actionType !== 'game' && actionType !== 'period') {
            lastPlay = desc;
            break;
          }
        }
      }
    } catch {
      // play-by-play is optional, don't fail the request
    }

    const homeTeam = game.homeTeam as Record<string, unknown>;
    const awayTeam = game.awayTeam as Record<string, unknown>;

    const result: LiveBoxScoreResponse = {
      gameId,
      gameStatus: String(game.gameStatusText || ''),
      lastPlay,
      homeTeam: {
        teamId: String(homeTeam?.teamId || ''),
        teamTricode: String(homeTeam?.teamTricode || ''),
        score: Number(homeTeam?.score || 0),
        players: mapPlayers(homeTeam?.players as Record<string, unknown>[] || []),
      },
      awayTeam: {
        teamId: String(awayTeam?.teamId || ''),
        teamTricode: String(awayTeam?.teamTricode || ''),
        score: Number(awayTeam?.score || 0),
        players: mapPlayers(awayTeam?.players as Record<string, unknown>[] || []),
      },
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
