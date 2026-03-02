import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

interface LiveScoreGame {
  game_id: string;
  game_date: string;
  home_team_abbreviation: string;
  away_team_abbreviation: string;
  home_team_score: number;
  away_team_score: number;
  status: string;
  period: string;
  clock: string;
}

interface LiveScoresResponse {
  games: LiveScoreGame[];
  timestamp: string;
}

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
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const response = await axios.get(
      `https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json`,
      {
        timeout: 4000,
        headers: {
          'Accept': 'application/json',
        },
      }
    );

    const scoreboard = response.data?.scoreboard;
    const games: LiveScoreGame[] = (scoreboard?.games || []).map((game: Record<string, unknown>) => {
      const homeTeam = game.homeTeam as Record<string, unknown> | undefined;
      const awayTeam = game.awayTeam as Record<string, unknown> | undefined;
      return {
        game_id: String(game.gameId || ''),
        game_date: String(game.gameTimeUTC || ''),
        home_team_abbreviation: String(homeTeam?.teamTricode || ''),
        away_team_abbreviation: String(awayTeam?.teamTricode || ''),
        home_team_score: Number(homeTeam?.score || 0),
        away_team_score: Number(awayTeam?.score || 0),
        status: String(game.gameStatusText || ''),
        period: String(game.period || '0'),
        clock: String(game.gameClock || ''),
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
