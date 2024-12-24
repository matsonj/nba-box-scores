import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';
import { TeamStats } from '@/types/schema';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('Fetching all period scores...');
    const periodScores = await queryDb<TeamStats>(
      `SELECT game_id, team_id, period, points 
       FROM main.team_stats 
       WHERE period != 'FullGame'
       ORDER BY game_id, team_id, CAST(period AS INTEGER)`
    );
    console.log(`Found ${periodScores.length} period scores`);

    // Group by game_id
    const scoresByGame = periodScores.reduce((acc, score) => {
      if (!acc[score.game_id]) {
        acc[score.game_id] = [];
      }
      acc[score.game_id].push({
        teamId: Number(score.team_id),
        period: score.period,
        points: Number(score.points)
      });
      return acc;
    }, {} as Record<string, { teamId: number; period: string; points: number; }[]>);

    return NextResponse.json(scoresByGame);
  } catch (error) {
    console.error('Error fetching all box scores:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
