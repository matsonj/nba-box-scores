import { NextResponse } from 'next/server';
import { queryDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  try {
    console.log('Fetching schedule from DuckDB...');
    const games = await queryDb(`
      SELECT 
        game_id,
        game_date as "gameDate",
        home_team_abbreviation,
        away_team_abbreviation,
        home_team_score,
        away_team_score,
        status
      FROM schedule
      ORDER BY game_date DESC
      LIMIT 100;
    `);
    console.log('Successfully fetched games:', games.length);
    return NextResponse.json(games);
  } catch (error) {
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return NextResponse.json(
      { error: `Error fetching schedule: ${error.message}` },
      { status: 500 }
    );
  }
}
