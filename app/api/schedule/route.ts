import { NextResponse, NextRequest } from 'next/server';
import { queryDb } from '@/lib/db';
import { Schedule } from '@/types/schema';
import { getCache, setCache } from '@/lib/cache';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Check cache first
    const cacheKey = 'schedule';
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('Returning cached schedule data');
      return NextResponse.json(cached);
    }

    console.log('Fetching schedule from DuckDB...');
    const result = await queryDb(`
      SELECT * FROM main.schedule 
      WHERE game_id NOT LIKE '006%'
    `);
    
    console.log('Raw query result:', result[0]);
    console.log('Total games:', result.length);

    // Transform the data to match the expected format
    const transformedResult = result.map((game: Schedule) => ({
      game_id: game.game_id,
      game_date: game.game_date,
      home_team_id: game.home_team_id,
      away_team_id: game.away_team_id,
      home_team_abbreviation: game.home_team_abbreviation,
      away_team_abbreviation: game.away_team_abbreviation,
      home_team_score: game.home_team_score,
      away_team_score: game.away_team_score,
      status: game.status,
      homeTeam: {
        teamId: game.home_team_abbreviation,
        teamName: game.home_team_abbreviation,
        teamAbbreviation: game.home_team_abbreviation,
        score: game.home_team_score,
        players: []
      },
      awayTeam: {
        teamId: game.away_team_abbreviation,
        teamName: game.away_team_abbreviation,
        teamAbbreviation: game.away_team_abbreviation,
        score: game.away_team_score,
        players: []
      },
      boxScoreLoaded: false
    }));

    // Cache the transformed result
    setCache(cacheKey, transformedResult);

    return NextResponse.json(transformedResult);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}
