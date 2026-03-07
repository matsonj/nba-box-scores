import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

import type { LiveScoreGame, LiveScoresResponse } from '@/app/types/live';

let cachedResponse: LiveScoresResponse | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5000;

function mapGameStatus(game: Record<string, unknown>): string {
  const gameState = String(game.gameState || '');
  const clock = game.clock as Record<string, unknown> | undefined;
  const period = Number(game.period || 0);
  const timeRemaining = String(clock?.timeRemaining || '');

  switch (gameState) {
    case 'FUT':
    case 'PRE':
      return String(game.startTimeUTC || 'Scheduled');
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

function buildPeriodScores(
  game: Record<string, unknown>
): { teamId: string; period: string; points: number }[] {
  const homeTeam = game.homeTeam as Record<string, unknown> | undefined;
  const awayTeam = game.awayTeam as Record<string, unknown> | undefined;
  const homeAbbrev = String(homeTeam?.abbrev || '');
  const awayAbbrev = String(awayTeam?.abbrev || '');

  // Try to use periodDescriptor from goals to build period scores
  const goals = game.goals as Record<string, unknown>[] | undefined;
  if (!goals || goals.length === 0) return [];

  // Accumulate goals per period per team
  const periodGoals: Record<string, { home: number; away: number }> = {};

  for (const goal of goals) {
    const period = String(goal.period || '');
    if (!periodGoals[period]) {
      periodGoals[period] = { home: 0, away: 0 };
    }
    const teamAbbrev = (goal.teamAbbrev as Record<string, unknown>)?.default || goal.teamAbbrev;
    if (String(teamAbbrev) === homeAbbrev) {
      periodGoals[period].home++;
    } else {
      periodGoals[period].away++;
    }
  }

  const scores: { teamId: string; period: string; points: number }[] = [];
  for (const [period, counts] of Object.entries(periodGoals)) {
    scores.push({ teamId: homeAbbrev, period, points: counts.home });
    scores.push({ teamId: awayAbbrev, period, points: counts.away });
  }

  return scores;
}

function getLastGoalDescription(game: Record<string, unknown>): string {
  const goals = game.goals as Record<string, unknown>[] | undefined;
  if (!goals || goals.length === 0) return '';

  const lastGoal = goals[goals.length - 1];
  const scorer = lastGoal.name as Record<string, unknown> | undefined;
  const scorerName = String(scorer?.default || '');
  const teamAbbrev = (lastGoal.teamAbbrev as Record<string, unknown>)?.default || lastGoal.teamAbbrev;
  const timeInPeriod = String(lastGoal.timeInPeriod || '');
  const period = Number(lastGoal.period || 0);
  const strength = String(lastGoal.strength || '');
  const goalsToDate = lastGoal.goalsToDate != null ? ` (${lastGoal.goalsToDate})` : '';

  const periodLabel = period > 3 ? 'OT' : `P${period}`;
  const strengthLabel = strength === 'pp' ? ' (PP)' : strength === 'sh' ? ' (SH)' : '';

  const assists = lastGoal.assists as Record<string, unknown>[] | undefined;
  let assistStr = '';
  if (assists && assists.length > 0) {
    assistStr = ' from ' + assists.map(a => String((a.name as Record<string, unknown>)?.default || '')).join(', ');
  }

  return `GOAL: ${String(teamAbbrev)} — ${scorerName}${goalsToDate}${assistStr}${strengthLabel} (${periodLabel} ${timeInPeriod})`;
}

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
    const response = await axios.get(
      'https://api-web.nhle.com/v1/score/now',
      {
        timeout: 4000,
        headers: { 'Accept': 'application/json' },
      }
    );

    const gamesData = response.data?.games || [];
    const games: LiveScoreGame[] = gamesData.map((game: Record<string, unknown>) => {
      const homeTeam = game.homeTeam as Record<string, unknown> | undefined;
      const awayTeam = game.awayTeam as Record<string, unknown> | undefined;

      return {
        game_id: String(game.id || ''),
        game_date: String(game.startTimeUTC || ''),
        home_team_id: Number(homeTeam?.id || 0),
        away_team_id: Number(awayTeam?.id || 0),
        home_team_abbreviation: String(homeTeam?.abbrev || ''),
        away_team_abbreviation: String(awayTeam?.abbrev || ''),
        home_team_score: Number(homeTeam?.score ?? 0),
        away_team_score: Number(awayTeam?.score ?? 0),
        status: mapGameStatus(game),
        period: String(game.period ?? 0),
        clock: String((game.clock as Record<string, unknown>)?.timeRemaining ?? ''),
        periodScores: buildPeriodScores(game),
        lastPlay: getLastGoalDescription(game) || undefined,
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
    console.error('NHL live scores API error:', error);

    if (cachedResponse) {
      return res.status(200).json(cachedResponse);
    }

    return res.status(200).json({
      games: [],
      timestamp: new Date().toISOString(),
    });
  }
}
