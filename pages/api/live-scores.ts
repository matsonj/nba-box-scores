import { NextApiRequest, NextApiResponse } from 'next';
import { fetchJson } from '@/lib/fetchJson';
import { ESPN_NBA_BASE, toNbaTricode } from '@/lib/espn';

import type { LiveScoreGame, LiveScoresResponse } from '@/app/types/live';

let cachedResponse: LiveScoresResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Security-Policy', "default-src 'self'");

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const now = Date.now();

  if (cachedResponse && now - cacheTimestamp < CACHE_TTL_MS) {
    return res.status(200).json(cachedResponse);
  }

  try {
    const data = await fetchJson(`${ESPN_NBA_BASE}/scoreboard`, 4000);

    const events = (data?.events || []) as Record<string, unknown>[];
    const games: LiveScoreGame[] = events.map((event) => {
      const competition = ((event.competitions as Record<string, unknown>[]) || [])[0] || {};
      const competitors = (competition.competitors as Record<string, unknown>[]) || [];
      const home = competitors.find((c) => c.homeAway === 'home') || {};
      const away = competitors.find((c) => c.homeAway === 'away') || {};
      const homeTeam = home.team as Record<string, unknown> | undefined;
      const awayTeam = away.team as Record<string, unknown> | undefined;
      const homeTricode = toNbaTricode(homeTeam?.abbreviation);
      const awayTricode = toNbaTricode(awayTeam?.abbreviation);

      const status = event.status as Record<string, unknown> | undefined;
      const statusType = status?.type as Record<string, unknown> | undefined;

      const linescores = (team: Record<string, unknown>, tricode: string) =>
        ((team.linescores as { value: number }[]) || []).map((l, i) => ({
          teamId: tricode,
          period: String(i + 1),
          points: Number(l.value || 0),
        }));

      return {
        game_id: String(event.id || ''),
        game_date: String(event.date || ''),
        home_team_abbreviation: homeTricode,
        away_team_abbreviation: awayTricode,
        home_team_id: Number(homeTeam?.id || 0),
        away_team_id: Number(awayTeam?.id || 0),
        home_team_score: Number(home.score || 0),
        away_team_score: Number(away.score || 0),
        status: String(statusType?.shortDetail || ''),
        period: String(status?.period || '0'),
        clock: String(status?.displayClock || ''),
        periodScores: [...linescores(home, homeTricode), ...linescores(away, awayTricode)],
      };
    });

    const result: LiveScoresResponse = {
      games,
      timestamp: new Date().toISOString(),
    };

    cachedResponse = result;
    cacheTimestamp = now;

    res.setHeader('Cache-Control', 'no-store, max-age=0');
    return res.status(200).json(result);
  } catch (error) {
    console.error('Live scores API error:', error);

    // Return cached data if available, even if stale
    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    return res.status(200).json({
      games: [],
      timestamp: new Date().toISOString(),
    });
  }
}
